import { ColorRecipe, HslMix } from '../../types';
import { assignSourceId, getCachedPortraitMask, setCachedPortraitMask } from '../analysis/mask-cache';
import { computePortraitMaskFromRgba, PortraitMaskResult } from '../analysis/portrait-mask';
import { buildEffectiveHsl, clamp01, isNeutralRecipe } from '../core/pixel-grade';
import { IPhotoRenderer, RenderFrameRequest, RenderFrameResult } from './renderer.types';

import fullscreenVertSrc from '../shaders/fullscreen.vert?raw';
import baseFragSrc from '../shaders/base.frag?raw';
import bokehFragSrc from '../shaders/bokeh.frag?raw';
import portraitFragSrc from '../shaders/portrait.frag?raw';
import colorGradingFragSrc from '../shaders/color-grading.frag?raw';

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

  // Offscreen FBO pool
  private portraitFbo: FboTarget | null = null;
  private bokehFboA: FboTarget | null = null;
  private bokehFboB: FboTarget | null = null;
  private gradeFbo: FboTarget | null = null;

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

      this.sourceTex = this.createLinearTex(gl);
      this.maskTex = this.createLinearTex(gl);

      // Initialize dummy 1x1 mask texture so samplers remain bound safely even without active mask
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
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
        return null;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
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
      if (!this.stagingCanvas) {
        this.stagingCanvas = this.createCanvas(w, h);
      }
      if (this.stagingCanvas.width !== w || this.stagingCanvas.height !== h) {
        this.stagingCanvas.width = w;
        this.stagingCanvas.height = h;
      }
      const sCtx = this.stagingCanvas.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (sCtx) {
        sCtx.drawImage(source as CanvasImageSource, 0, 0, w, h);
        uploadTarget = this.stagingCanvas as TexImageSource;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, uploadTarget);

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
      // Sample source into compact <=128px staging buffer to avoid large full-res readback
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
      this.uploadedMaskKey = serializedMaskKey;
      this.uploadedMaskW = maskRes.mw;
      this.uploadedMaskH = maskRes.mh;
    }

    return maskRes;
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

    // 1. Optional bokeh downsample + separable 2-pass blur (runs on un-smoothed raw source)
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

      // Splat weighted colors into bokehFboA
      gl.uniform1i(getUniform(gl, bp, 'uMode'), 0);
      gl.uniform1f(getUniform(gl, bp, 'uNormalize'), 0.0);
      this.drawPass(bp, this.bokehFboA, bw, bh, false);

      // 2 passes separable horizontal + vertical box filter
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

      bokehTex = this.bokehFboA.tex;
    }

    // 2. Optional edge-preserving skin smoothing & foreground micro-sharpening prepass
    const skinSmoothStrength = Math.min(0.46, (recipe.skinRosy / 45) * 0.46);
    const sharpenAmt = clamp01(recipe.sharpen / 35);
    const needsPortraitPrepass = skinSmoothStrength > 0.015 || sharpenAmt > 0.015;
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

      this.drawPass(pp, this.portraitFbo, w, h, false);
      gradeInputTex = this.portraitFbo.tex;
    }

    // 3. Full 13-stage editorial color grading shader into gradeFbo -> display canvas
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

    gl.uniform2i(getUniform(gl, gp, 'uSize'), w, h);
    gl.uniform2i(getUniform(gl, gp, 'uMaskSize'), this.uploadedMaskW, this.uploadedMaskH);
    gl.uniform2i(getUniform(gl, gp, 'uBokehSize'), bw, bh);
    gl.uniform1i(getUniform(gl, gp, 'uHasMask'), needsPortraitMask ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uHasBokeh'), hasBokeh ? 1 : 0);
    gl.uniform1i(getUniform(gl, gp, 'uIncludeGrain'), request.includeGrain === false ? 0 : 1);

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

    this.drawPass(gp, this.gradeFbo, w, h, false);

    // 4. Present right-side-up onto visible WebGL canvas and blit to target canvas
    this.renderToScreenAndCopy(this.gradeFbo.tex, request.targetCanvas, w, h);

    return {
      width: w,
      height: h,
      backend: this.backend,
      durationMs: performance.now() - t0,
      maskMethod: maskRes?.method,
      maskConfidence: maskRes?.confidence,
      maskFromCache: maskRes?.fromCache
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
    // Flip Y on default framebuffer presentation so canvas top row aligns with DOM Y=0
    this.drawPass(bp, null, w, h, true);
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

      if (this.sourceTex) gl.deleteTexture(this.sourceTex);
      if (this.maskTex) gl.deleteTexture(this.maskTex);
      if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
      if (this.quadVao) gl.deleteVertexArray(this.quadVao);

      [this.baseProg, this.bokehProg, this.portraitProg, this.gradeProg].forEach((p) => {
        if (p) gl.deleteProgram(p.program);
      });
    }
    this.portraitFbo = null;
    this.bokehFboA = null;
    this.bokehFboB = null;
    this.gradeFbo = null;
    this.sourceTex = null;
    this.maskTex = null;
    this.quadVbo = null;
    this.quadVao = null;
    this.baseProg = null;
    this.bokehProg = null;
    this.portraitProg = null;
    this.gradeProg = null;
    this.gl = null;
    this.glCanvas = null;
  }
}
