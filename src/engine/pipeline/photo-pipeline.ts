import { ColorRecipe, Preset } from '../../types';
import {
  analyzeAndSolveAdaptiveColorFromRgba
} from '../adaptive-color/adaptiveCorrectionPipeline';
import {
  AdaptiveColorCacheKeyParts,
  buildAdaptiveColorCacheKey,
  getCachedAdaptiveColorResult,
  setCachedAdaptiveColorResult
} from '../adaptive-color/cache';
import {
  ADAPTIVE_COLOR_VERSION,
  AdaptiveColorConfig,
  AdaptiveCorrectionResult,
  DEFAULT_ADAPTIVE_COLOR_CONFIG
} from '../adaptive-color/types';
import {
  AdaptiveAnalyzeOutcome,
  AdaptiveAnalyzeRequest,
  AdaptiveAnalyzer,
} from '../analysis/adaptive-analysis';
import {
  AdaptiveRenderMap,
  buildAdaptiveRenderMap,
  getCachedAdaptiveRenderMap,
  resolveAdaptiveRelighting
} from '../analysis/adaptive-relighting';
import { AnalysisResult } from '../analysis/analysis-types';
import { assignSourceId, getCachedPortraitMask, ImageSourceLike, setCachedPortraitMask } from '../analysis/mask-cache';
import { computePortraitMaskFromRgba, PortraitMaskResult } from '../analysis/portrait-mask';
import { buildEffectiveRecipe, hasActiveRelighting, isNeutralRecipe } from '../core/pixel-grade';
import { Canvas2DRenderer } from '../renderer/canvas2d.renderer';
import { RenderFrameRequest, RenderFrameResult, RendererBackend } from '../renderer/renderer.types';
import { WebGL2Renderer } from '../renderer/webgl2.renderer';
import type { ImageWorkerRequest, ImageWorkerResponse, WorkerAdaptiveMapPayload } from '../../workers/image.worker';

export interface PhotoPipelineOptions {
  preferWebGL2?: boolean;
  preferWorkerFallback?: boolean;
}

export interface PreviewRequest {
  source: ImageSourceLike;
  sourceId: string;
  sourceRevision: number;
  transformRevision: number;
  recipe: ColorRecipe;
  targetCanvas: HTMLCanvasElement;
  maxDimension?: number;
  analysisResult?: AnalysisResult | null;
  includeGrain?: boolean;
}

export interface AdaptiveColorAnalyzeRequest {
  source: ImageSourceLike;
  sourceId?: string;
  sourceRevision: number;
  transformRevision: string | number;
  config?: Partial<AdaptiveColorConfig>;
}

export interface AdaptiveColorAnalyzeOutcome {
  result: AdaptiveCorrectionResult;
  fromCache: boolean;
  cancelled: boolean;
}

function getSourceDims(source: ImageSourceLike): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function computeTargetSize(srcW: number, srcH: number, maxDimension?: number): { w: number; h: number } {
  let w = srcW;
  let h = srcH;
  if (maxDimension && Math.max(w, h) > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

async function sourceToTransferPayload(
  source: ImageSourceLike,
  w: number,
  h: number
): Promise<{ bitmap?: ImageBitmap; rgbaBuffer?: ArrayBuffer; transfer: Transferable[] }> {
  const { width: srcW, height: srcH } = getSourceDims(source);
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap =
        srcW === w && srcH === h
          ? await createImageBitmap(source as ImageBitmapSource)
          : await createImageBitmap(source as ImageBitmapSource, {
              resizeWidth: w,
              resizeHeight: h,
              resizeQuality: 'medium'
            });
      return { bitmap, transfer: [bitmap] };
    } catch {
      // Fallback to staging canvas RGBA transfer below
    }
  }

  const staging = document.createElement('canvas');
  staging.width = w;
  staging.height = h;
  const ctx = staging.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to extract source image bytes');
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  const rgba = new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  return { rgbaBuffer: rgba.buffer, transfer: [rgba.buffer] };
}

interface PendingJob {
  resolve: (msg: ImageWorkerResponse) => void;
  reject: (err: Error) => void;
}

/**
 * Coordinates GPU WebGL2 primary rendering, Web Worker off-main-thread mask estimation,
 * Web Worker Canvas 2D fallback, chunked thumbnail generation, and job cancellation.
 */
export class PhotoPipeline {
  private glRenderer: WebGL2Renderer | null = null;
  private cpuRenderer: Canvas2DRenderer | null = null;
  private worker: Worker | null = null;
  private workerFailed = false;
  private adaptiveAnalyzer: AdaptiveAnalyzer | null = null;

  private readonly preferWebGL2: boolean;
  private readonly preferWorkerFallback: boolean;

  private jobSeq = 1;
  private latestPreviewJobId = 0;
  private latestAdaptiveColorSeq = 0;
  private activeBatchId = 0;
  private pendingJobs = new Map<number, PendingJob>();
  private inFlightAdaptiveColor = new Map<string, Promise<AdaptiveColorAnalyzeOutcome>>();

  // Coalescing slot for CPU Worker renders so rapid slider scrubbing skips stale intermediate frames
  private workerRenderInFlight = false;
  private queuedWorkerTask: {
    jobId: number;
    request: PreviewRequest;
    resolve: (res: RenderFrameResult) => void;
  } | null = null;

  constructor(options?: PhotoPipelineOptions) {
    this.preferWebGL2 = options?.preferWebGL2 ?? true;
    this.preferWorkerFallback = options?.preferWorkerFallback ?? true;

    if (this.preferWebGL2) {
      const gl = new WebGL2Renderer();
      if (gl.isSupported()) {
        this.glRenderer = gl;
      } else {
        gl.dispose();
      }
    }
  }

  getActiveBackend(): RendererBackend {
    if (this.glRenderer?.isSupported()) return 'webgl2';
    if (this.preferWorkerFallback && !this.workerFailed && typeof Worker !== 'undefined') {
      return 'worker-canvas2d';
    }
    return 'canvas2d';
  }

  getMaxGpuTextureSize(): number {
    return this.glRenderer?.isSupported() ? this.glRenderer.getMaxTextureSize() : 4096;
  }

  private getCpuFallbackRenderer(): Canvas2DRenderer {
    if (!this.cpuRenderer) this.cpuRenderer = new Canvas2DRenderer();
    return this.cpuRenderer;
  }

  private ensureWorker(): Worker | null {
    if (!this.preferWorkerFallback || this.workerFailed || typeof Worker === 'undefined') {
      return null;
    }
    if (this.worker) return this.worker;

    try {
      const w = new Worker(new URL('../../workers/image.worker.ts', import.meta.url), {
        type: 'module'
      });
      w.onmessage = (ev: MessageEvent<ImageWorkerResponse>) => {
        const msg = ev.data;
        if (msg.type === 'THUMBNAIL_ITEM' || msg.type === 'THUMBNAIL_BATCH_DONE') {
          this.onThumbnailMessage?.(msg);
          return;
        }
        const pending = this.pendingJobs.get(msg.id);
        if (!pending) return;
        this.pendingJobs.delete(msg.id);
        if (msg.type === 'ERROR') {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg);
        }
      };
      w.onerror = () => {
        this.workerFailed = true;
        for (const [, p] of this.pendingJobs) {
          p.reject(new Error('Image worker crashed'));
        }
        this.pendingJobs.clear();
        this.worker?.terminate();
        this.worker = null;
      };
      this.worker = w;
      return w;
    } catch {
      this.workerFailed = true;
      return null;
    }
  }

  private onThumbnailMessage: ((msg: ImageWorkerResponse) => void) | null = null;

  private callWorker(req: ImageWorkerRequest, transfer: Transferable[]): Promise<ImageWorkerResponse> {
    const w = this.ensureWorker();
    if (!w) return Promise.reject(new Error('Worker unavailable'));
    return new Promise((resolve, reject) => {
      const id = 'id' in req ? req.id : 0;
      this.pendingJobs.set(id, { resolve, reject });
      w.postMessage(req, transfer);
    });
  }

  /**
   * Computes or fetches cached portrait mask (runs off main thread inside image.worker.ts when available).
   */
  async resolvePortraitMask(
    source: ImageSourceLike,
    sourceId: string,
    sourceRevision: number,
    transformRevision: number,
    targetW: number,
    targetH: number
  ): Promise<PortraitMaskResult> {
    const key = { sourceId, sourceRevision, width: targetW, height: targetH, transformRevision };
    const hit = getCachedPortraitMask(key);
    if (hit) {
      return {
        mw: hit.mw,
        mh: hit.mh,
        mask: hit.mask,
        confidence: hit.confidence,
        method: hit.method,
        fromCache: true
      };
    }

    // Downsample to <=112px before sending across worker boundary (identical to computePortraitMaskFromRgba maxSide)
    const sampleScale = Math.min(1, 112 / Math.max(targetW, targetH));
    const sw = Math.max(16, Math.round(targetW * sampleScale));
    const sh = Math.max(16, Math.round(targetH * sampleScale));

    const worker = this.ensureWorker();
    if (worker) {
      try {
        const id = ++this.jobSeq;
        const payload = await sourceToTransferPayload(source, sw, sh);
        const resp = await this.callWorker(
          {
            id,
            type: 'COMPUTE_PORTRAIT_MASK',
            bitmap: payload.bitmap,
            rgbaBuffer: payload.rgbaBuffer,
            width: sw,
            height: sh,
            cacheKey: key
          },
          payload.transfer
        );
        if (resp.type === 'MASK_DONE') {
          const mask = new Float32Array(resp.maskBuffer);
          const entry = {
            mw: resp.mw,
            mh: resp.mh,
            mask,
            confidence: resp.confidence,
            method: resp.method
          };
          setCachedPortraitMask(key, entry);
          return { ...entry, fromCache: false };
        }
      } catch {
        // Fall through to synchronous computation
      }
    }

    const staging = document.createElement('canvas');
    staging.width = sw;
    staging.height = sh;
    const ctx = staging.getContext('2d', { willReadFrequently: true });
    const data = ctx
      ? (ctx.drawImage(source as CanvasImageSource, 0, 0, sw, sh), ctx.getImageData(0, 0, sw, sh).data)
      : new Uint8ClampedArray(sw * sh * 4);
    const computed = computePortraitMaskFromRgba(data, sw, sh);
    setCachedPortraitMask(key, computed);
    return { ...computed, fromCache: false };
  }

  /**
   * Renders a frame through WebGL2 GPU primary path OR off-main-thread Worker Canvas 2D fallback,
   * cancelling stale overlapping slider jobs automatically.
   */
  async renderPreview(request: PreviewRequest): Promise<RenderFrameResult> {
    const jobId = ++this.latestPreviewJobId;
    const { width: srcW, height: srcH } = getSourceDims(request.source);
    if (!srcW || !srcH) {
      return { width: 0, height: 0, backend: this.getActiveBackend(), durationMs: 0 };
    }
    const { w, h } = computeTargetSize(srcW, srcH, request.maxDimension);
    const sourceId = request.sourceId || assignSourceId(request.source);
    const needsPortraitMask = !isNeutralRecipe(request.recipe) && (request.recipe.bgDarken > 0.25 || request.recipe.bgBokeh > 0.25);

    // Path A: WebGL2 Primary GPU Renderer
    if (this.glRenderer?.isSupported()) {
      let maskRes: PortraitMaskResult | null = null;
      if (needsPortraitMask) {
        maskRes = await this.resolvePortraitMask(
          request.source,
          sourceId,
          request.sourceRevision,
          request.transformRevision,
          w,
          h
        );
        if (jobId !== this.latestPreviewJobId) {
          return { width: w, height: h, backend: 'webgl2', durationMs: 0, cancelled: true };
        }
      }

      try {
        const frameReq: RenderFrameRequest = {
          source: request.source,
          sourceId,
          sourceRevision: request.sourceRevision,
          transformRevision: request.transformRevision,
          recipe: request.recipe,
          targetCanvas: request.targetCanvas,
          maxDimension: request.maxDimension,
          portraitMask: maskRes,
          analysisResult: request.analysisResult,
          includeGrain: request.includeGrain
        };
        return await this.glRenderer.render(frameReq);
      } catch {
        // WebGL runtime failure -> dispose GL and degrade cleanly to worker/Canvas2D
        this.glRenderer.dispose();
        this.glRenderer = null;
      }
    }

    // Path B: Worker Canvas 2D (coalescing queue prevents slider backlog on CPU devices)
    if (this.ensureWorker()) {
      return this.enqueueWorkerRender(jobId, request);
    }

    // Path C: Synchronous Canvas 2D last-resort fallback
    if (jobId !== this.latestPreviewJobId) {
      return { width: w, height: h, backend: 'canvas2d', durationMs: 0, cancelled: true };
    }
    return this.getCpuFallbackRenderer().render({
      source: request.source,
      sourceId,
      sourceRevision: request.sourceRevision,
      transformRevision: request.transformRevision,
      recipe: request.recipe,
      targetCanvas: request.targetCanvas,
      maxDimension: request.maxDimension,
      analysisResult: request.analysisResult,
      includeGrain: request.includeGrain
    });
  }

  private enqueueWorkerRender(jobId: number, request: PreviewRequest): Promise<RenderFrameResult> {
    return new Promise((resolve) => {
      if (this.queuedWorkerTask) {
        const dropped = this.queuedWorkerTask;
        dropped.resolve({
          width: dropped.request.targetCanvas.width,
          height: dropped.request.targetCanvas.height,
          backend: 'worker-canvas2d',
          durationMs: 0,
          cancelled: true
        });
      }
      this.queuedWorkerTask = { jobId, request, resolve };
      void this.drainWorkerRenderQueue();
    });
  }

  private async drainWorkerRenderQueue(): Promise<void> {
    if (this.workerRenderInFlight) return;
    this.workerRenderInFlight = true;

    try {
      while (this.queuedWorkerTask) {
        const task = this.queuedWorkerTask;
        this.queuedWorkerTask = null;

        if (task.jobId !== this.latestPreviewJobId) {
          task.resolve({
            width: task.request.targetCanvas.width,
            height: task.request.targetCanvas.height,
            backend: 'worker-canvas2d',
            durationMs: 0,
            cancelled: true
          });
          continue;
        }

        const req = task.request;
        const { width: srcW, height: srcH } = getSourceDims(req.source);
        const { w, h } = computeTargetSize(srcW, srcH, req.maxDimension);
        const sourceId = req.sourceId || assignSourceId(req.source);

        try {
          const transferPayload = await sourceToTransferPayload(req.source, w, h);

          let workerAdaptivePayload: WorkerAdaptiveMapPayload | null = null;
          const rlParams = resolveAdaptiveRelighting(req.recipe.relighting, req.analysisResult);
          if (
            rlParams.active &&
            hasActiveRelighting(req.recipe.relighting) &&
            req.analysisResult
          ) {
            const falloffRad = req.recipe.relighting?.falloffRadius ?? 1.15;
            let adaptiveMap: AdaptiveRenderMap | null = getCachedAdaptiveRenderMap(
              req.analysisResult,
              falloffRad
            );
            if (!adaptiveMap) {
              const gScale = Math.min(1, 320 / Math.max(srcW, srcH));
              const gw = Math.max(32, Math.round(srcW * gScale));
              const gh = Math.max(32, Math.round(srcH * gScale));
              const gCanvas = document.createElement('canvas');
              gCanvas.width = gw;
              gCanvas.height = gh;
              const gCtx = gCanvas.getContext('2d', { willReadFrequently: true });
              const gRgba = gCtx
                ? (gCtx.drawImage(req.source as CanvasImageSource, 0, 0, gw, gh),
                  gCtx.getImageData(0, 0, gw, gh).data)
                : null;
              adaptiveMap = buildAdaptiveRenderMap(
                req.analysisResult,
                gRgba,
                gw,
                gh,
                falloffRad
              );
            }
            if (adaptiveMap.mode !== 'fallback-signature') {
              const copy = new Uint8Array(adaptiveMap.rgbaData);
              workerAdaptivePayload = {
                width: adaptiveMap.width,
                height: adaptiveMap.height,
                rgbaBuffer: copy.buffer,
                mode: adaptiveMap.mode,
                cacheKey: adaptiveMap.cacheKey
              };
              transferPayload.transfer.push(copy.buffer);
            }
          }

          const id = ++this.jobSeq;
          const resp = await this.callWorker(
            {
              id,
              type: 'RENDER_CANVAS2D',
              bitmap: transferPayload.bitmap,
              rgbaBuffer: transferPayload.rgbaBuffer,
              width: w,
              height: h,
              recipe: req.recipe,
              cacheKey: {
                sourceId,
                sourceRevision: req.sourceRevision,
                width: w,
                height: h,
                transformRevision: req.transformRevision
              },
              adaptiveMap: workerAdaptivePayload,
              relightingParams: req.recipe.relighting ? rlParams : null,
              includeGrain: req.includeGrain
            },
            transferPayload.transfer
          );

          if (resp.type !== 'RENDER_DONE') {
            throw new Error('Unexpected worker response');
          }

          if (task.jobId !== this.latestPreviewJobId) {
            resp.bitmap?.close();
            task.resolve({
              width: w,
              height: h,
              backend: 'worker-canvas2d',
              durationMs: resp.durationMs,
              cancelled: true
            });
            continue;
          }

          const canvas = req.targetCanvas;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (resp.bitmap) {
              ctx.drawImage(resp.bitmap, 0, 0, w, h);
              resp.bitmap.close();
            } else if (resp.rgbaBuffer) {
              const imgData = new ImageData(new Uint8ClampedArray(resp.rgbaBuffer), w, h);
              ctx.putImageData(imgData, 0, 0);
            }
          } else {
            resp.bitmap?.close();
          }

          task.resolve({
            width: w,
            height: h,
            backend: 'worker-canvas2d',
            durationMs: resp.durationMs,
            maskMethod: resp.maskMethod,
            maskConfidence: resp.maskConfidence,
            maskFromCache: resp.maskFromCache,
            adaptiveMode: req.recipe.relighting
              ? resolveAdaptiveRelighting(req.recipe.relighting, req.analysisResult).mode
              : undefined,
            cancelled: false
          });
        } catch {
          const fallbackRes = await this.getCpuFallbackRenderer().render({
            source: req.source,
            sourceId,
            sourceRevision: req.sourceRevision,
            transformRevision: req.transformRevision,
            recipe: req.recipe,
            targetCanvas: req.targetCanvas,
            maxDimension: req.maxDimension,
            analysisResult: req.analysisResult,
            includeGrain: req.includeGrain
          });
          task.resolve(fallbackRes);
        }
      }
    } finally {
      this.workerRenderInFlight = false;
    }
  }

  /**
   * Generates all preset strip thumbnails in a single cancellable background worker batch.
   * Returns a map of presetId -> object/data URL without blocking the UI thread.
   */
  async generateThumbnails(
    source: ImageSourceLike,
    _sourceId: string,
    _sourceRevision: number,
    presets: Preset[],
    onItem?: (presetId: string, url: string) => void
  ): Promise<Record<string, string>> {
    const batchId = ++this.activeBatchId;
    const size = 128;
    const { width: srcW, height: srcH } = getSourceDims(source);
    if (!srcW || !srcH) return {};

    const minSide = Math.min(srcW, srcH);
    const sx = (srcW - minSide) / 2;
    const sy = (srcH - minSide) / 2;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = size;
    cropCanvas.height = size;
    const cCtx = cropCanvas.getContext('2d');
    if (!cCtx) return {};
    cCtx.drawImage(source as CanvasImageSource, sx, sy, minSide, minSide, 0, 0, size, size);

    const results: Record<string, string> = {};
    const worker = this.ensureWorker();

    if (worker) {
      worker.postMessage({ type: 'CANCEL_BATCH', batchId: batchId - 1 } satisfies ImageWorkerRequest);
      try {
        const id = ++this.jobSeq;
        const payload = await sourceToTransferPayload(cropCanvas, size, size);
        const batchDone = await new Promise<{ cancelled: boolean }>((resolve) => {
          this.onThumbnailMessage = (msg) => {
            if (msg.type === 'THUMBNAIL_ITEM' && msg.batchId === batchId) {
              const url = URL.createObjectURL(msg.blob);
              if (batchId === this.activeBatchId) {
                results[msg.presetId] = url;
                onItem?.(msg.presetId, url);
              } else {
                URL.revokeObjectURL(url);
              }
            } else if (msg.type === 'THUMBNAIL_BATCH_DONE' && msg.batchId === batchId) {
              this.onThumbnailMessage = null;
              resolve({ cancelled: msg.cancelled });
            }
          };

          worker.postMessage(
            {
              id,
              batchId,
              type: 'RENDER_THUMBNAIL_BATCH',
              bitmap: payload.bitmap,
              rgbaBuffer: payload.rgbaBuffer,
              width: size,
              height: size,
              items: presets.map((p) => ({ presetId: p.id, recipe: buildEffectiveRecipe(p.recipe, 100, { exposure: 0, contrast: 0, temperature: 0, saturation: 0, skinRosy: 0, bgDarken: 0, bgBokeh: 0, grain: 0 }) }))
            } satisfies ImageWorkerRequest,
            payload.transfer
          );
        });

        if (!batchDone.cancelled) {
          return results;
        }
      } catch {
        this.onThumbnailMessage = null;
      }
    }

    // Graceful cooperative fallback if worker unavailable
    const out = document.createElement('canvas');
    const cpu = this.getCpuFallbackRenderer();
    for (let i = 0; i < presets.length; i++) {
      if (batchId !== this.activeBatchId) break;
      const p = presets[i];
      await cpu.render({
        source: cropCanvas,
        sourceId: `thumb_${batchId}`,
        sourceRevision: batchId,
        transformRevision: 1,
        recipe: p.recipe,
        targetCanvas: out,
        maxDimension: size
      });
      const url = out.toDataURL('image/jpeg', 0.78);
      results[p.id] = url;
      onItem?.(p.id, url);
      if (i % 3 === 2) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return results;
  }

  private getAdaptiveAnalyzer(): AdaptiveAnalyzer {
    if (!this.adaptiveAnalyzer) {
      this.adaptiveAnalyzer = new AdaptiveAnalyzer();
    }
    return this.adaptiveAnalyzer;
  }

  getCachedAdaptiveAnalysis(
    req: Omit<AdaptiveAnalyzeRequest, 'cancelPrevious'>,
  ): AnalysisResult | null {
    return this.adaptiveAnalyzer?.getCached(req) ?? null;
  }

  analyzeAdaptive(req: AdaptiveAnalyzeRequest): Promise<AdaptiveAnalyzeOutcome> {
    return this.getAdaptiveAnalyzer().analyze(req);
  }

  cancelAdaptiveAnalysis(): void {
    this.adaptiveAnalyzer?.cancelPending();
  }

  probeAiCapabilities() {
    return this.getAdaptiveAnalyzer().probeCapabilities();
  }

  getCachedAdaptiveColor(
    req: AdaptiveColorAnalyzeRequest
  ): AdaptiveCorrectionResult | null {
    const sourceId = req.sourceId || assignSourceId(req.source);
    const analysisMaxDim = req.config?.analysisMaxDim ?? DEFAULT_ADAPTIVE_COLOR_CONFIG.analysisMaxDim;
    const keyParts: AdaptiveColorCacheKeyParts = {
      sourceId,
      sourceRevision: req.sourceRevision,
      transformRevision: req.transformRevision,
      analysisMaxDim,
      version: ADAPTIVE_COLOR_VERSION
    };
    return getCachedAdaptiveColorResult(keyParts);
  }

  async analyzeAdaptiveColor(
    req: AdaptiveColorAnalyzeRequest
  ): Promise<AdaptiveColorAnalyzeOutcome> {
    const seq = ++this.latestAdaptiveColorSeq;
    const { width: srcW, height: srcH } = getSourceDims(req.source);
    const sourceId = req.sourceId || assignSourceId(req.source);
    const analysisMaxDim = req.config?.analysisMaxDim ?? DEFAULT_ADAPTIVE_COLOR_CONFIG.analysisMaxDim;
    const keyParts: AdaptiveColorCacheKeyParts = {
      sourceId,
      sourceRevision: req.sourceRevision,
      transformRevision: req.transformRevision,
      analysisMaxDim,
      version: ADAPTIVE_COLOR_VERSION
    };

    const cached = getCachedAdaptiveColorResult(keyParts);
    if (cached) {
      return { result: cached, fromCache: true, cancelled: false };
    }

    const cacheKey = buildAdaptiveColorCacheKey(keyParts);
    const existing = this.inFlightAdaptiveColor.get(cacheKey);
    if (existing) {
      return existing;
    }

    const { w, h } = computeTargetSize(srcW, srcH, analysisMaxDim);

    const promise = (async (): Promise<AdaptiveColorAnalyzeOutcome> => {
      const worker = this.ensureWorker();
      if (worker && srcW > 0 && srcH > 0) {
        try {
          const id = ++this.jobSeq;
          const payload = await sourceToTransferPayload(req.source, w, h);
          const resp = await this.callWorker(
            {
              id,
              type: 'ANALYZE_ADAPTIVE_COLOR',
              bitmap: payload.bitmap,
              rgbaBuffer: payload.rgbaBuffer,
              width: w,
              height: h,
              sourceSignature: cacheKey,
              config: req.config
            },
            payload.transfer
          );
          if (resp.type === 'ADAPTIVE_COLOR_DONE') {
            setCachedAdaptiveColorResult(keyParts, resp.result);
            return {
              result: resp.result,
              fromCache: false,
              cancelled: seq !== this.latestAdaptiveColorSeq
            };
          }
        } catch {
          // Fallback to synchronous analysis on CPU below
        }
      }

      const staging = document.createElement('canvas');
      staging.width = w;
      staging.height = h;
      const ctx = staging.getContext('2d', { willReadFrequently: true });
      const data = ctx && srcW > 0 && srcH > 0
        ? (ctx.drawImage(req.source as CanvasImageSource, 0, 0, w, h), ctx.getImageData(0, 0, w, h).data)
        : new Uint8ClampedArray(0);
      const result = analyzeAndSolveAdaptiveColorFromRgba(data, w, h, {
        config: req.config,
        sourceSignature: cacheKey
      });
      setCachedAdaptiveColorResult(keyParts, result);
      return {
        result,
        fromCache: false,
        cancelled: seq !== this.latestAdaptiveColorSeq
      };
    })();

    this.inFlightAdaptiveColor.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightAdaptiveColor.delete(cacheKey);
    }
  }

  cancelAdaptiveColorAnalysis(): void {
    this.latestAdaptiveColorSeq++;
  }

  cancelThumbnailBatch(): void {
    this.activeBatchId++;
    this.worker?.postMessage({ type: 'CANCEL_BATCH', batchId: this.activeBatchId } satisfies ImageWorkerRequest);
  }

  dispose(): void {
    this.latestPreviewJobId++;
    this.cancelThumbnailBatch();
    this.adaptiveAnalyzer?.dispose();
    this.adaptiveAnalyzer = null;
    this.glRenderer?.dispose();
    this.glRenderer = null;
    this.cpuRenderer?.dispose();
    this.cpuRenderer = null;
    if (this.queuedWorkerTask) {
      this.queuedWorkerTask.resolve({
        width: 0,
        height: 0,
        backend: 'worker-canvas2d',
        durationMs: 0,
        cancelled: true
      });
      this.queuedWorkerTask = null;
    }
    for (const [, pending] of this.pendingJobs) {
      pending.reject(new Error('PhotoPipeline disposed'));
    }
    this.pendingJobs.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}
