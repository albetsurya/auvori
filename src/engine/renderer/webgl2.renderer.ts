import { ColorRecipe, HslMix } from '../../types';
import {
  AdaptiveRenderMap,
  buildAdaptiveRenderMap,
  getCachedAdaptiveRenderMap,
  resolveAdaptiveRelighting,
  resolveHighlightRecoveryStrength,
  resolveShadowDenoiseStrength
} from '../analysis/adaptive-relighting';
import { assignSourceId, getCachedPortraitMask, setCachedPortraitMask } from '../analysis/mask-cache';
import { computePortraitMaskFromRgba, PortraitMaskResult } from '../analysis/portrait-mask';
import {
  buildEffectiveHsl,
  clamp01,
  hasActiveColorGrading,
  hasActiveOpticalEffects,
  hasActiveRelighting,
  isNeutralRecipe
} from '../core/pixel-grade';
import { buildMonotoneToneCurveKnots, isNeutralToneCurve } from '../core/tone-curve';
import { IPhotoRenderer, RenderFrameRequest, RenderFrameResult } from './renderer.types';

import fullscreenVertSrc from '../shaders/fullscreen.vert?raw';
import baseFragSrc from '../shaders/base.frag?raw';
import bokehFragSrc from '../shaders/bokeh.frag?raw';
import portraitFragSrc from '../shaders/portrait.frag?raw';
import colorGradingFragSrc from '../shaders/color-grading.frag?raw';
import effectsFragSrc from '../shaders/effects.frag?raw';
import effectsCompositeFragSrc from '../shaders/effects-composite.frag?raw';

interface FboTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
  isFloat: boolean;
}

interface ProgramHandle {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

function resolveSourceSize(source: RenderFrameRequest['source']): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): ProgramHandle {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error('Unable to allocate WebGL program');
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown shader link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return { program, uniforms: new Map() };
}

function getUniform(gl: WebGL2RenderingContext, handle: ProgramHandle, name: string): WebGLUniformLocation | null {
  if (!handle.uniforms.has(name)) {
    handle.uniforms.set(name, gl.getUniformLocation(handle.program, name));
  }
  return handle.uniforms.get(name) ?? null;
}

/**
 * High-speed GPU WebGL2 renderer implementing exact mathematical parity with Auvori's pixel engine.
 * Caches uploaded source textures, mask textures, and offscreen FBOs so slider scrubbing runs purely on GPU.
 */
export class WebGL2Renderer implements IPhotoRenderer {
  readonly backend = 'webgl2' as const;

  private glCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadVbo: WebGLBuffer | null = null;
  private baseProg: ProgramHandle | null = null;
  private bokehProg: ProgramHandle | null = null;
  private portraitProg: ProgramHandle | null = null;
  private gradeProg: ProgramHandle | null = null;
  private effectsProg: ProgramHandle | null = null;
  private effectsCompositeProg: ProgramHandle | null = null;

  private supportsFloatFbo = false;
  private maxTextureSize = 4096;
  private contextLost = false;
  private initFailed = false;

  // Texture caches keyed by revision to prevent redundant CPU->GPU uploads while dragging sliders
  private sourceTex: WebGLTexture | null = null;
  private uploadedSourceKey = '';
  private uploadedSourceW = 0;
  private uploadedSourceH = 0;

  private maskTex: WebGLTexture | null = null;
  private uploadedMaskKey = '';
  private uploadedMaskW = 1;
  private uploadedMaskH = 1;

  private adaptiveTex: WebGLTexture | null = null;
  private uploadedAdaptiveKey = '';
  private uploadedAdaptiveW = 1;
  private uploadedAdaptiveH = 1;

  // Offscreen FBO pool
  private portraitFbo: FboTarget | null = null;
  private bokehFboA: FboTarget | null = null;
  private bokehFboB: FboTarget | null = null;
  private gradeFbo: FboTarget | null = null;
  private effectsFboA: FboTarget | null = null;
  private effectsFboB: FboTarget | null = null;
  private finalFbo: FboTarget | null = null;

  // Downsample canvas used only when uploading scaled preview sources or sampling portrait mask
  private stagingCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

  constructor(canvas?: HTMLCanvasElement | OffscreenCanvas) {
    this.ensureInitialized(canvas);
  }

  isSupported(): boolean {
    return !this.initFailed && !this.contextLost && this.gl !== null;
  }

  getMaxTextureSize(): number {
    return this.maxTextureSize;
  }

  /**
   * Returns the internal WebGL canvas after rendering, allowing direct Blob encoding without intermediate copy.
   */
  getInternalCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.glCanvas;
  }

  private createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    return new OffscreenCanvas(w, h);
  }

  private ensureInitialized(providedCanvas?: HTMLCanvasElement | OffscreenCanvas): void {
    if (this.gl || this.initFailed) return;
    try {
      const canvas = providedCanvas ?? this.createCanvas(2, 2);
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      }) as WebGL2RenderingContext | null;

      if (!gl) {
        this.initFailed = true;
        return;
      }

      if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          this.contextLost = true;
        });
      }

      this.glCanvas = canvas;
      this.gl = gl;
      this.maxTextureSize = Math.min(8192, (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 4096);
      this.supportsFloatFbo = Boolean(
        gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
      );

      // Fullscreen quad triangle strip (-1..1)
      this.quadVao = gl.createVertexArray();
      this.quadVbo = gl.createBuffer();
      gl.bindVertexArray(this.quadVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.baseProg = createProgram(gl, fullscreenVertSrc, baseFragSrc);
      this.bokehProg = createProgram(gl, fullscreenVertSrc, bokehFragSrc);
      this.portraitProg = createProgram(gl, fullscreenVertSrc, portraitFragSrc);
      this.gradeProg = createProgram(gl, fullscreenVertSrc, colorGradingFragSrc);
      this.effectsProg = createProgram(gl, fullscreenVertSrc, effectsFragSrc);
      this.effectsCompositeProg = createProgram(gl, fullscreenVertSrc, effectsCompositeFragSrc);

      this.sourceTex = this.createLinearTex(gl);
      this.maskTex = this.createLinearTex(gl);
      this.adaptiveTex = this.createLinearTex(gl);

      // Initialize dummy 1x1 mask & adaptive textures so samplers remain bound safely
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));

      gl.bindTexture(gl.TEXTURE_2D, this.adaptiveTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 0, 0, 255])
      );
    } catch {
      this.dispose();
      this.initFailed = true;
    }
  }

  private createLinearTex(gl: WebGL2RenderingContext): WebGLTexture {
    const tex = gl.createTexture();
    if (!tex) throw new Error('Unable to create WebGL texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private ensureFbo(current: FboTarget | null, w: number, h: number, preferFloat: boolean): FboTarget {
    const gl = this.gl!;
    const useFloat = preferFloat && this.supportsFloatFbo;
    if (current && current.width === w && current.height === h && current.isFloat === useFloat) {
      return current;
    }

    if (current) {
      gl.deleteFramebuffer(current.fbo);
      gl.deleteTexture(current.tex);
    }

    const createForFormat = (asFloat: boolean): FboTarget | null => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = this.createLinearTex(gl);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (asFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }

      const fbo = gl.createFramebuffer();
      if (!fbo) {
        gl.deleteTexture(tex);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return null;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
        return null;
      }
      return { fbo, tex, width: w, height: h, isFloat: asFloat };
    };

    if (useFloat) {
      const f = createForFormat(true);
      if (f) return f;
      this.supportsFloatFbo = false;
    }

    const fallback = createForFormat(false);
    if (!fallback) throw new Error('Unable to allocate WebGL2 FBO');
    return fallback;
  }

  private uploadSourceTexture(
    source: RenderFrameRequest['source'],
    srcW: number,
    srcH: number,
    w: number,
    h: number,
    sourceKey: string
  ): void {
    const gl = this.gl!;
    if (this.uploadedSourceKey === sourceKey && this.uploadedSourceW === w && this.uploadedSourceH === h) {
      return;
    }

    let uploadTarget: TexImageSource = source as TexImageSource;
    if (srcW !== w || srcH !== h) {
      const stagingCanvas = this.createCanvas(w, h);
      const sCtx = stagingCanvas.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (sCtx) {
        sCtx.imageSmoothingQuality = 'high';
        sCtx.drawImage(source as CanvasImageSource, 0, 0, w, h);
        uploadTarget = stagingCanvas as TexImageSource;
      }
    }

    if (this.sourceTex && (this.uploadedSourceW !== w || this.uploadedSourceH !== h)) {
      gl.deleteTexture(this.sourceTex);
      this.sourceTex = this.createLinearTex(gl);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, uploadTarget);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.uploadedSourceKey = sourceKey;
    this.uploadedSourceW = w;
    this.uploadedSourceH = h;
  }

  private resolveAndUploadMask(
    request: RenderFrameRequest,
    w: number,
    h: number,
    sourceId: string
  ): PortraitMaskResult {
    const cacheKey = {
      sourceId,
      sourceRevision: request.sourceRevision,
      width: w,
      height: h,
      transformRevision: request.transformRevision
    };
    const serializedMaskKey = `${sourceId}:${request.sourceRevision}:${w}x${h}:${request.transformRevision}`;

    let maskRes: PortraitMaskResult | null = request.portraitMask ?? null;
    if (!maskRes) {
      const hit = getCachedPortraitMask(cacheKey);
      if (hit) {
        maskRes = {
          mw: hit.mw,
          mh: hit.mh,
          mask: hit.mask,
          confidence: hit.confidence,
          method: hit.method,
          fromCache: true
        };
      }
    }

    if (!maskRes) {
      const maxSample = 112;
      const scale = Math.min(1, maxSample / Math.max(w, h));
      const sw = Math.max(16, Math.round(w * scale));
      const sh = Math.max(16, Math.round(h * scale));
      const sampleCanvas = this.createCanvas(sw, sh);
      const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true }) as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      let sampleData: Uint8ClampedArray;
      if (sCtx) {
        sCtx.drawImage(request.source as CanvasImageSource, 0, 0, sw, sh);
        sampleData = sCtx.getImageData(0, 0, sw, sh).data;
      } else {
        sampleData = new Uint8ClampedArray(sw * sh * 4);
      }
      const computed = computePortraitMaskFromRgba(sampleData, sw, sh);
      setCachedPortraitMask(cacheKey, computed);
      maskRes = { ...computed, fromCache: false };
    }

    if (this.uploadedMaskKey !== serializedMaskKey) {
      const gl = this.gl!;
      const bytes = new Uint8Array(maskRes.mask.length);
      for (let i = 0; i < maskRes.mask.length; i++) {
        bytes[i] = Math.round(clamp01(maskRes.mask[i]) * 255);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        maskRes.mw,
        maskRes.mh,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        bytes
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.uploadedMaskKey = serializedMaskKey;
      this.uploadedMaskW = maskRes.mw;
      this.uploadedMaskH = maskRes.mh;
    }

    return maskRes;
  }

  private sampleGuideRgba(
    source: RenderFrameRequest['source'],
    w: number,
    h: number
  ): { data: Uint8ClampedArray; width: number; height: number } {
    const maxSample = 320;
    const scale = Math.min(1, maxSample / Math.max(w, h));
    const gw = Math.max(32, Math.round(w * scale));
    const gh = Math.max(32, Math.round(h * scale));
    const sampleCanvas = this.createCanvas(gw, gh);
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!sCtx) {
      return { data: new Uint8ClampedArray(gw * gh * 4), width: gw, height: gh };
    }
    sCtx.drawImage(source as CanvasImageSource, 0, 0, gw, gh);
    return { data: sCtx.getImageData(0, 0, gw, gh).data, width: gw, height: gh };
  }

  private drawPass(
    prog: ProgramHandle,
    target: FboTarget | null,
    w: number,
    h: number,
    flipY: boolean
  ): void {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.program);
    gl.uniform1f(getUniform(gl, prog, 'uFlipY'), flipY ? 1.0 : 0.0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private bindHslUniforms(gl: WebGL2RenderingContext, prog: ProgramHandle, hslMix: HslMix | undefined): void {
    gl.uniform1i(getUniform(gl, prog, 'uHasHsl'), hslMix ? 1 : 0);
    if (!hslMix) return;
    gl.uniform3f(getUniform(gl, prog, 'uHslRed'), hslMix.red.h, hslMix.red.s, hslMix.red.l);
    gl.uniform3f(getUniform(gl, prog, 'uHslOrange'), hslMix.orange.h, hslMix.orange.s, hslMix.orange.l);
    gl.uniform3f(getUniform(gl, prog, 'uHslYellow'), hslMix.yellow.h, hslMix.yellow.s, hslMix.yellow.l);
    gl.uniform3f(getUniform(gl, prog, 'uHslGreen'), hslMix.green.h, hslMix.green.s, hslMix.green.l);
    gl.uniform3f(getUniform(gl, prog, 'uHslAqua'), hslMix.aqua.h, hslMix.aqua.s, hslMix.aqua.l);
    gl.uniform3f(getUniform(gl, prog, 'uHslBlue'), hslMix.blue.h, hslMix.blue.s, hslMix.blue.l);
  }

  async render(request: RenderFrameRequest): Promise<RenderFrameResult> {
    const t0 = performance.now();
    if (!this.isSupported() || !this.gl || !this.glCanvas) {
      throw new Error('WebGL2Renderer is not available');
    }

    const { width: srcW, height: srcH } = resolveSourceSize(request.source);
    if (!srcW || !srcH) {
      return { width: 0, height: 0, backend: this.backend, durationMs: 0 };
    }

    let w = srcW;
    let h = srcH;
    const capDim = Math.min(request.maxDimension ?? this.maxTextureSize, this.maxTextureSize);
    if (Math.max(w, h) > capDim) {
      const scale = capDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const gl = this.gl;
    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.glCanvas.width = w;
      this.glCanvas.height = h;
    }

    const sourceId = request.sourceId || assignSourceId(request.source);
    const sourceKey = `${sourceId}:${request.sourceRevision}:${request.transformRevision}:${w}x${h}`;
    this.uploadSourceTexture(request.source, srcW, srcH, w, h, sourceKey);

    const recipe: ColorRecipe = request.recipe;
    if (isNeutralRecipe(recipe)) {
      this.renderToScreenAndCopy(this.sourceTex!, request.targetCanvas, w, h);
      return { width: w, height: h, backend: this.backend, durationMs: performance.now() - t0 };
    }

    const needsPortraitMask = recipe.bgDarken > 0.25 || recipe.bgBokeh > 0.25;
    let maskRes: PortraitMaskResult | null = null;
    if (needsPortraitMask) {
      maskRes = this.resolveAndUploadMask(request, w, h, sourceId);
    }

    const rlParams = resolveAdaptiveRelighting(recipe.relighting, request.analysisResult);
    const hasRelight = Boolean(
      rlParams.active &&
        hasActiveRelighting(recipe.relighting) &&
        request.analysisResult &&
        this.adaptiveTex
    );
    let adaptiveMap: AdaptiveRenderMap | null = null;
    if (hasRelight && request.analysisResult) {
      const falloffRad = recipe.relighting?.falloffRadius ?? 1.15;
      adaptiveMap = getCachedAdaptiveRenderMap(request.analysisResult, falloffRad);
      if (!adaptiveMap) {
        const guideSample = this.sampleGuideRgba(request.source, w, h);
        adaptiveMap = buildAdaptiveRenderMap(
          request.analysisResult,
          guideSample.data,
          guideSample.width,
          guideSample.height,
          falloffRad
        );
      }
      if (adaptiveMap.mode === 'fallback-signature') {
        adaptiveMap = null;
      } else if (this.uploadedAdaptiveKey !== adaptiveMap.cacheKey) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.adaptiveTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          adaptiveMap.width,
          adaptiveMap.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          adaptiveMap.rgbaData
        );
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.uploadedAdaptiveKey = adaptiveMap.cacheKey;
        this.uploadedAdaptiveW = adaptiveMap.width;
        this.uploadedAdaptiveH = adaptiveMap.height;
      }
    }

    // 1. Optional bokeh downsample + separable 2-pass blur
    const minDim = Math.min(w, h);
    const hasBokeh = Boolean(maskRes && recipe.bgBokeh > 0.5);
    let bokehTex: WebGLTexture = this.sourceTex!;
    let bw = 1;
    let bh = 1;

    if (hasBokeh && this.bokehProg) {
      const scale = Math.max(w, h) > 220 ? 0.5 : 1;
      bw = Math.max(16, Math.round(w * scale));
      bh = Math.max(16, Math.round(h * scale));
      const bokehRadius = Math.max(1, (recipe.bgBokeh / 40) * minDim * 0.0052);
      const scaledR = Math.min(48, Math.max(1, Math.round(bokehRadius * scale)));

      this.bokehFboA = this.ensureFbo(this.bokehFboA, bw, bh, true);
      this.bokehFboB = this.ensureFbo(this.bokehFboB, bw, bh, true);

      const bp = this.bokehProg;
      gl.useProgram(bp.program);
      gl.uniform2i(getUniform(gl, bp, 'uSourceSize'), w, h);
      gl.uniform2i(getUniform(gl, bp, 'uMaskSize'), this.uploadedMaskW, this.uploadedMaskH);
      gl.uniform2i(getUniform(gl, bp, 'uBufSize'), bw, bh);
      gl.uniform1i(getUniform(gl, bp, 'uRadius'), scaledR);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
      gl.uniform1i(getUniform(gl, bp, 'uSourceTex'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.uniform1i(getUniform(gl, bp, 'uMaskTex'), 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.uniform1i(getUniform(gl, bp, 'uInputTex'), 2);

      gl.uniform1i(getUniform(gl, bp, 'uMode'), 0);
      gl.uniform1f(getUniform(gl, bp, 'uNormalize'), 0.0);
      this.drawPass(bp, this.bokehFboA, bw, bh, false);

      for (let pass = 0; pass < 2; pass++) {
        gl.uniform1i(getUniform(gl, bp, 'uMode'), 1);
        gl.uniform1f(getUniform(gl, bp, 'uNormalize'), 0.0);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.bokehFboA.tex);
        gl.uniform1i(getUniform(gl, bp, 'uInputTex'), 2);
        this.drawPass(bp, this.bokehFboB, bw, bh, false);

        gl.uniform1i(getUniform(gl, bp, 'uMode'), 2);
        gl.uniform1f(getUniform(gl, bp, 'uNormalize'), pass === 1 ? 1.0 : 0.0);
        gl.bindTexture(gl.TEXTURE_2D, this.bokehFboB.tex);
        gl.uniform1i(getUniform(gl, bp, 'uInputTex'), 2);
        this.drawPass(bp, this.bokehFboA, bw, bh, false);
      }

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);

      bokehTex = this.bokehFboA.tex;
    }

    // 2. Optional edge-preserving skin smoothing, shadow stabilization & foreground sharpening prepass
    const skinSmoothStrength = Math.min(0.46, (recipe.skinRosy / 45) * 0.46);
    const sharpenAmt = clamp01(recipe.sharpen / 35);
    const shadowDenoiseAmt = resolveShadowDenoiseStrength(recipe.relighting, rlParams);
    const hlRecoveryAmt = resolveHighlightRecoveryStrength(recipe.relighting, rlParams);
    const needsPortraitPrepass =
      skinSmoothStrength > 0.015 || sharpenAmt > 0.015 || shadowDenoiseAmt > 0.015;
    let gradeInputTex: WebGLTexture = this.sourceTex!;

    if (needsPortraitPrepass && this.portraitProg) {
      this.portraitFbo = this.ensureFbo(this.portraitFbo, w, h, true);
      const pp = this.portraitProg;
      const skinStep = Math.max(1, Math.round(minDim / 520));

      gl.useProgram(pp.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
      gl.uniform1i(getUniform(gl, pp, 'uSourceTex'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.uniform1i(getUniform(gl, pp, 'uMaskTex'), 1);

      gl.uniform2i(getUniform(gl, pp, 'uSize'), w, h);
      gl.uniform2i(getUniform(gl, pp, 'uMaskSize'), this.uploadedMaskW, this.uploadedMaskH);
      gl.uniform1i(getUniform(gl, pp, 'uHasMask'), needsPortraitMask ? 1 : 0);
      gl.uniform1i(getUniform(gl, pp, 'uSkinStep'), skinStep);
      gl.uniform1f(getUniform(gl, pp, 'uSkinSmoothStrength'), skinSmoothStrength);
      gl.uniform1f(getUniform(gl, pp, 'uSharpenAmt'), sharpenAmt);
      gl.uniform1f(getUniform(gl, pp, 'uShadowDenoiseAmt'), shadowDenoiseAmt);

      this.drawPass(pp, this.portraitFbo, w, h, false);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gradeInputTex = this.portraitFbo.tex;
    }

    const hasEffects = hasActiveOpticalEffects(recipe.effects);

    // 3. Full editorial color grading (+ optional Tone Curve + 3-Way Grading)
    const gp = this.gradeProg!;
    this.gradeFbo = this.ensureFbo(this.gradeFbo, w, h, false);
    gl.useProgram(gp.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gradeInputTex);
    gl.uniform1i(getUniform(gl, gp, 'uSourceTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(getUniform(gl, gp, 'uMaskTex'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, bokehTex);
    gl.uniform1i(getUniform(gl, gp, 'uBokehTex'), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.adaptiveTex);
    gl.uniform1i(getUniform(gl, gp, 'uAdaptiveTex'), 3);

    gl.uniform2i(getUniform(gl, gp, 'uSize'), w, h);
    gl.uniform2i(getUniform(gl, gp, 'uMaskSize'), this.uploadedMaskW, this.uploadedMaskH);
    gl.uniform2i(getUniform(gl, gp, 'uBokehSize'), bw, bh);
    gl.uniform2i(getUniform(gl, gp, 'uAdaptiveSize'), this.uploadedAdaptiveW, this.uploadedAdaptiveH);
    gl.uniform1i(getUniform(gl, gp, 'uHasMask'), needsPortraitMask ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uHasBokeh'), hasBokeh ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uIncludeGrain'), request.includeGrain === false ? 0 : 1);
    gl.uniform1i(getUniform(gl, gp, 'uApplyFinalStages'), hasEffects ? 0 : 1);

    const activeRelight = Boolean(adaptiveMap && rlParams.active);
    gl.uniform1i(getUniform(gl, gp, 'uHasRelighting'), activeRelight ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uRlProfile'), rlParams.profile === 'night-cinema' ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uRlIsPortrait'), rlParams.isPortrait ? 1 : 0);
    gl.uniform1f(getUniform(gl, gp, 'uRlSubjectLift'), activeRelight ? rlParams.subjectLift : 0);
    gl.uniform1f(getUniform(gl, gp, 'uRlFlashSpecular'), activeRelight ? rlParams.flashSpecular : 0);
    gl.uniform1f(getUniform(gl, gp, 'uRlBgFalloff'), activeRelight ? rlParams.backgroundFalloff : 0);
    gl.uniform1f(getUniform(gl, gp, 'uRlSkinHighlightGuard'), rlParams.skinHighlightGuard);
    gl.uniform1f(getUniform(gl, gp, 'uRlShadowFloorGuard'), rlParams.shadowFloorGuard);
    gl.uniform1f(getUniform(gl, gp, 'uRlSkinWarmBalance'), rlParams.skinWarmBalance);
    gl.uniform1f(getUniform(gl, gp, 'uRlHighlightRecovery'), hlRecoveryAmt);
    gl.uniform1f(getUniform(gl, gp, 'uRlBgCoolShift'), activeRelight ? rlParams.bgCoolShift : 0);

    gl.uniform1f(getUniform(gl, gp, 'uDehazeK'), clamp01(recipe.dehaze / 50) * 0.34);
    gl.uniform1f(getUniform(gl, gp, 'uExpMult'), Math.pow(2, recipe.exposure / 55));
    gl.uniform1f(
      getUniform(gl, gp, 'uContrastAmt'),
      Math.max(-0.48, Math.min(0.48, (recipe.contrast + recipe.dehaze * 0.22) / 92))
    );
    gl.uniform1f(getUniform(gl, gp, 'uHlFactor'), recipe.highlights / 100);
    gl.uniform1f(getUniform(gl, gp, 'uShFactor'), recipe.shadows / 100);
    gl.uniform1f(getUniform(gl, gp, 'uWhiteFactor'), recipe.whites / 100);
    gl.uniform1f(getUniform(gl, gp, 'uBlackFactor'), recipe.blacks / 100);

    gl.uniform1f(getUniform(gl, gp, 'uTempR'), (recipe.temperature * 0.62) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uTempB'), (-recipe.temperature * 0.7) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uTintG'), (-recipe.tint * 0.52) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uTintRB'), (recipe.tint * 0.22) / 255);

    gl.uniform1f(getUniform(gl, gp, 'uSatMult'), Math.max(0, 1 + recipe.saturation / 50));
    gl.uniform1f(getUniform(gl, gp, 'uVibFactor'), recipe.vibrance / 100);
    gl.uniform1f(getUniform(gl, gp, 'uSCyan'), (recipe.shadowCyan * 0.62) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uSWarm'), (recipe.shadowWarm * 0.58) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uSkinBoost'), (recipe.skinBright * 0.42) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uRosyAmt'), clamp01(recipe.skinRosy / 45));
    gl.uniform1f(getUniform(gl, gp, 'uBgDarkAmt'), clamp01(recipe.bgDarken / 50));
    gl.uniform1f(getUniform(gl, gp, 'uBokehAmtScale'), clamp01(recipe.bgBokeh / 26));
    gl.uniform1f(getUniform(gl, gp, 'uFadeLift'), (recipe.fade * 0.82) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uGrainAmt'), (recipe.grain * 1.1) / 255);
    gl.uniform1f(getUniform(gl, gp, 'uVigStrength'), recipe.vignette / 100);

    const hslMix = recipe.hsl && buildEffectiveHsl(recipe.hsl, 1);
    this.bindHslUniforms(gl, gp, hslMix);

    const hasCurve = Boolean(recipe.toneCurve && !isNeutralToneCurve(recipe.toneCurve));
    gl.uniform1i(getUniform(gl, gp, 'uHasToneCurve'), hasCurve ? 1 : 0);
    if (hasCurve && recipe.toneCurve) {
      const knots = buildMonotoneToneCurveKnots(recipe.toneCurve);
      gl.uniform1fv(getUniform(gl, gp, 'uCurveY[0]'), knots.y);
      gl.uniform1fv(getUniform(gl, gp, 'uCurveM[0]'), knots.m);
    }

    const hasCg = hasActiveColorGrading(recipe.colorGrading);
    gl.uniform1i(getUniform(gl, gp, 'uHasColorGrading'), hasCg ? 1 : 0);
    if (hasCg && recipe.colorGrading) {
      const cg = recipe.colorGrading;
      gl.uniform3f(getUniform(gl, gp, 'uCgShadow'), cg.shadowTint[0], cg.shadowTint[1], cg.shadowTint[2]);
      gl.uniform3f(getUniform(gl, gp, 'uCgMidtone'), cg.midtoneTint[0], cg.midtoneTint[1], cg.midtoneTint[2]);
      gl.uniform3f(getUniform(gl, gp, 'uCgHighlight'), cg.highlightTint[0], cg.highlightTint[1], cg.highlightTint[2]);
      gl.uniform1f(getUniform(gl, gp, 'uCgBalance'), cg.balance);
    }

    this.drawPass(gp, this.gradeFbo, w, h, false);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    let outputTex = this.gradeFbo.tex;

    // 3b. Optional Optical Highlight Bloom & Analog Halation + Final Stages
    if (hasEffects && recipe.effects && this.effectsProg && this.effectsCompositeProg) {
      const fx = recipe.effects;
      const fxScale = Math.max(w, h) > 220 ? 0.5 : 1;
      const ew = Math.max(16, Math.round(w * fxScale));
      const eh = Math.max(16, Math.round(h * fxScale));
      const scaledR = Math.min(48, Math.max(1, Math.round(minDim * 0.012 * fxScale)));
      const step = Math.max(1, Math.round(minDim / 140));

      this.effectsFboA = this.ensureFbo(this.effectsFboA, ew, eh, true);
      this.effectsFboB = this.ensureFbo(this.effectsFboB, ew, eh, true);
      this.finalFbo = this.ensureFbo(this.finalFbo, w, h, false);

      const ep = this.effectsProg;
      gl.useProgram(ep.program);
      gl.uniform2i(getUniform(gl, ep, 'uSourceSize'), w, h);
      gl.uniform2i(getUniform(gl, ep, 'uBufSize'), ew, eh);
      gl.uniform1i(getUniform(gl, ep, 'uRadius'), scaledR);
      gl.uniform1i(getUniform(gl, ep, 'uStep'), step);
      gl.uniform1f(getUniform(gl, ep, 'uBloomStrength'), fx.bloomStrength);
      gl.uniform1f(getUniform(gl, ep, 'uBloomThreshold'), fx.bloomThreshold);
      gl.uniform1f(getUniform(gl, ep, 'uHalationStrength'), fx.halationStrength);
      gl.uniform1f(getUniform(gl, ep, 'uHalationThreshold'), fx.halationThreshold);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gradeFbo.tex);
      gl.uniform1i(getUniform(gl, ep, 'uSourceTex'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.uniform1i(getUniform(gl, ep, 'uInputTex'), 1);

      gl.uniform1i(getUniform(gl, ep, 'uMode'), 0);
      this.drawPass(ep, this.effectsFboA, ew, eh, false);

      for (let pass = 0; pass < 2; pass++) {
        gl.uniform1i(getUniform(gl, ep, 'uMode'), 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.effectsFboA.tex);
        gl.uniform1i(getUniform(gl, ep, 'uInputTex'), 1);
        this.drawPass(ep, this.effectsFboB, ew, eh, false);

        gl.uniform1i(getUniform(gl, ep, 'uMode'), 2);
        gl.bindTexture(gl.TEXTURE_2D, this.effectsFboB.tex);
        gl.uniform1i(getUniform(gl, ep, 'uInputTex'), 1);
        this.drawPass(ep, this.effectsFboA, ew, eh, false);
      }

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);

      const cp = this.effectsCompositeProg;
      gl.useProgram(cp.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gradeFbo.tex);
      gl.uniform1i(getUniform(gl, cp, 'uGradeTex'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.effectsFboA.tex);
      gl.uniform1i(getUniform(gl, cp, 'uEffectsTex'), 1);

      gl.uniform2i(getUniform(gl, cp, 'uSize'), w, h);
      gl.uniform2i(getUniform(gl, cp, 'uEffectsSize'), ew, eh);
      gl.uniform1i(getUniform(gl, cp, 'uIncludeGrain'), request.includeGrain === false ? 0 : 1);
      gl.uniform1f(getUniform(gl, cp, 'uBloomK'), (fx.bloomStrength / 40) * 0.42);
      gl.uniform1f(getUniform(gl, cp, 'uHalK'), (fx.halationStrength / 35) * 0.58);
      gl.uniform1f(getUniform(gl, cp, 'uFadeLift'), (recipe.fade * 0.82) / 255);
      gl.uniform1f(getUniform(gl, cp, 'uVigStrength'), recipe.vignette / 100);
      gl.uniform1f(getUniform(gl, cp, 'uGrainAmt'), (recipe.grain * 1.1) / 255);

      this.drawPass(cp, this.finalFbo, w, h, false);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      outputTex = this.finalFbo.tex;
    }

    // 4. Present right-side-up onto visible WebGL canvas and blit to target canvas
    this.renderToScreenAndCopy(outputTex, request.targetCanvas, w, h);

    return {
      width: w,
      height: h,
      backend: this.backend,
      durationMs: performance.now() - t0,
      maskMethod: maskRes?.method,
      maskConfidence: maskRes?.confidence,
      maskFromCache: maskRes?.fromCache,
      adaptiveMode: adaptiveMap ? adaptiveMap.mode : recipe.relighting ? rlParams.mode : undefined
    };
  }

  private renderToScreenAndCopy(
    tex: WebGLTexture,
    targetCanvas: HTMLCanvasElement | OffscreenCanvas,
    w: number,
    h: number
  ): void {
    const gl = this.gl!;
    const bp = this.baseProg!;
    gl.useProgram(bp.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(getUniform(gl, bp, 'uTex'), 0);
    this.drawPass(bp, null, w, h, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);
    gl.bindVertexArray(null);
    gl.flush();

    if (targetCanvas !== this.glCanvas) {
      if (targetCanvas.width !== w || targetCanvas.height !== h) {
        targetCanvas.width = w;
        targetCanvas.height = h;
      }
      const ctx = targetCanvas.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      ctx?.drawImage(this.glCanvas as CanvasImageSource, 0, 0, w, h);
    }
  }

  dispose(): void {
    const gl = this.gl;
    if (gl) {
      const delFbo = (t: FboTarget | null) => {
        if (!t) return;
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.tex);
      };
      delFbo(this.portraitFbo);
      delFbo(this.bokehFboA);
      delFbo(this.bokehFboB);
      delFbo(this.gradeFbo);
      delFbo(this.effectsFboA);
      delFbo(this.effectsFboB);
      delFbo(this.finalFbo);

      if (this.sourceTex) gl.deleteTexture(this.sourceTex);
      if (this.maskTex) gl.deleteTexture(this.maskTex);
      if (this.adaptiveTex) gl.deleteTexture(this.adaptiveTex);
      if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
      if (this.quadVao) gl.deleteVertexArray(this.quadVao);

      [
        this.baseProg,
        this.bokehProg,
        this.portraitProg,
        this.gradeProg,
        this.effectsProg,
        this.effectsCompositeProg
      ].forEach((p) => {
        if (p) gl.deleteProgram(p.program);
      });
    }
    this.portraitFbo = null;
    this.bokehFboA = null;
    this.bokehFboB = null;
    this.gradeFbo = null;
    this.effectsFboA = null;
    this.effectsFboB = null;
    this.finalFbo = null;
    this.sourceTex = null;
    this.maskTex = null;
    this.adaptiveTex = null;
    this.quadVbo = null;
    this.quadVao = null;
    this.baseProg = null;
    this.bokehProg = null;
    this.portraitProg = null;
    this.gradeProg = null;
    this.effectsProg = null;
    this.effectsCompositeProg = null;
    this.gl = null;
    this.glCanvas = null;
  }
}
