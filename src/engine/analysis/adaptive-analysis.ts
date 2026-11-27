/**
 * Main-thread coordinator for Phase 3 Adaptive Analysis.
 *
 * Responsibilities:
 * - Lazy-spawns ai.worker.ts ONLY when analysis or warmup/probe is invoked.
 * - Enforces revision-aware LRU caching (srcId, sourceRevision, dims, transformRevision,
 *   modelVersion, analysisConfigKey) so intensity/filter slider updates never re-run AI.
 * - Deduplicates concurrent identical requests and cancels stale in-flight analysis jobs.
 */

import type { AiWorkerRequest, AiWorkerResponse } from '../../workers/ai.worker';
import {
  ANALYSIS_MODEL_VERSION,
  DEFAULT_ANALYSIS_CONFIG,
  type AiExecutionBackend,
  type AiModelId,
  type AnalysisConfig,
  type AnalysisResult,
} from './analysis-types';
import {
  type AnalysisCacheKeyParts,
  buildAnalysisCacheKey,
  getCachedAnalysisResult,
  setCachedAnalysisResult,
} from './analysis-cache';
import { assignSourceId, type ImageSourceLike } from './mask-cache';

export interface AdaptiveAnalyzeRequest {
  source: ImageSourceLike;
  sourceId?: string;
  sourceRevision: number;
  transformRevision: string | number;
  maxAnalysisDim?: number;
  config?: Partial<AnalysisConfig>;
  /** Cancel previous non-matching in-flight jobs (default: true). */
  cancelPrevious?: boolean;
}

export interface AdaptiveAnalyzeOutcome {
  result: AnalysisResult | null;
  fromCache: boolean;
  cancelled: boolean;
}

function getSourceDims(source: ImageSourceLike): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

async function prepareWorkerTransferPayload(
  source: ImageSourceLike,
  srcW: number,
  srcH: number,
  maxDim: number,
): Promise<{
  bitmap?: ImageBitmap;
  rgbaBuffer?: ArrayBuffer;
  analysisW: number;
  analysisH: number;
  transfer: Transferable[];
}> {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const analysisW = Math.max(1, Math.round(srcW * scale));
  const analysisH = Math.max(1, Math.round(srcH * scale));

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap =
        analysisW === srcW && analysisH === srcH
          ? await createImageBitmap(source as ImageBitmapSource)
          : await createImageBitmap(source as ImageBitmapSource, {
              resizeWidth: analysisW,
              resizeHeight: analysisH,
              resizeQuality: 'medium',
            });
      return { bitmap, analysisW, analysisH, transfer: [bitmap] };
    } catch {
      // Fallback to 2D canvas extraction below.
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = analysisW;
  canvas.height = analysisH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to extract RGBA buffer for Adaptive Analysis');
  ctx.drawImage(source as CanvasImageSource, 0, 0, analysisW, analysisH);
  const rgba = new Uint8ClampedArray(ctx.getImageData(0, 0, analysisW, analysisH).data);
  return { rgbaBuffer: rgba.buffer, analysisW, analysisH, transfer: [rgba.buffer] };
}

export class AdaptiveAnalyzer {
  private worker: Worker | null = null;
  private reqSeq = 1;
  private jobSeq = 1;
  private latestJobId = 0;

  private readonly pendingMisc = new Map<
    number,
    { resolve: (msg: AiWorkerResponse) => void; reject: (err: Error) => void }
  >();
  private readonly pendingJobs = new Map<
    number,
    {
      cacheKey: string;
      resolve: (outcome: AdaptiveAnalyzeOutcome) => void;
      reject: (err: Error) => void;
    }
  >();
  private readonly inFlightByKey = new Map<string, Promise<AdaptiveAnalyzeOutcome>>();

  private getOrCreateWorker(): Worker {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') {
      throw new Error('Web Worker API unavailable in current environment');
    }
    const w = new Worker(new URL('../../workers/ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'ANALYSIS_RESULT') {
        const job = this.pendingJobs.get(msg.jobId);
        if (job) {
          this.pendingJobs.delete(msg.jobId);
          job.resolve({ result: msg.result, fromCache: false, cancelled: false });
        }
        return;
      }
      if (msg.type === 'ANALYSIS_CANCELLED') {
        const job = this.pendingJobs.get(msg.jobId);
        if (job) {
          this.pendingJobs.delete(msg.jobId);
          job.resolve({ result: null, fromCache: false, cancelled: true });
        }
        return;
      }
      if (msg.type === 'ANALYSIS_ERROR') {
        const job = this.pendingJobs.get(msg.jobId);
        if (job) {
          this.pendingJobs.delete(msg.jobId);
          job.reject(new Error(msg.error));
        }
        return;
      }
      const misc = this.pendingMisc.get(msg.id);
      if (misc) {
        this.pendingMisc.delete(msg.id);
        misc.resolve(msg);
      }
    };
    w.onerror = (err) => {
      const e = new Error(err.message || 'AI worker error');
      for (const [, p] of this.pendingMisc) p.reject(e);
      for (const [, j] of this.pendingJobs) j.reject(e);
      this.pendingMisc.clear();
      this.pendingJobs.clear();
      this.worker = null;
    };
    this.worker = w;
    return w;
  }

  probeCapabilities(): Promise<Extract<AiWorkerResponse, { type: 'CAPABILITIES' }>> {
    const w = this.getOrCreateWorker();
    const id = this.reqSeq++;
    return new Promise((resolve, reject) => {
      this.pendingMisc.set(id, {
        resolve: (msg) => resolve(msg as Extract<AiWorkerResponse, { type: 'CAPABILITIES' }>),
        reject,
      });
      w.postMessage({ id, type: 'PROBE_CAPABILITIES' } satisfies AiWorkerRequest);
    });
  }

  checkModelCache(
    cacheName?: string,
  ): Promise<Extract<AiWorkerResponse, { type: 'MODEL_CACHE_STATUS' }>> {
    const w = this.getOrCreateWorker();
    const id = this.reqSeq++;
    return new Promise((resolve, reject) => {
      this.pendingMisc.set(id, {
        resolve: (msg) => resolve(msg as Extract<AiWorkerResponse, { type: 'MODEL_CACHE_STATUS' }>),
        reject,
      });
      w.postMessage({ id, type: 'CHECK_MODEL_CACHE', cacheName } satisfies AiWorkerRequest);
    });
  }

  warmupModels(options?: {
    modelIds?: AiModelId[];
    preferredBackend?: AiExecutionBackend;
  }): Promise<Extract<AiWorkerResponse, { type: 'WARMUP_DONE' }>> {
    const w = this.getOrCreateWorker();
    const id = this.reqSeq++;
    return new Promise((resolve, reject) => {
      this.pendingMisc.set(id, {
        resolve: (msg) => resolve(msg as Extract<AiWorkerResponse, { type: 'WARMUP_DONE' }>),
        reject,
      });
      w.postMessage({
        id,
        type: 'WARMUP_MODELS',
        modelIds: options?.modelIds,
        preferredBackend: options?.preferredBackend,
      } satisfies AiWorkerRequest);
    });
  }

  getCached(req: Omit<AdaptiveAnalyzeRequest, 'cancelPrevious'>): AnalysisResult | null {
    const { width, height } = getSourceDims(req.source);
    const sourceId = req.sourceId ?? assignSourceId(req.source);
    const config: AnalysisConfig = { ...DEFAULT_ANALYSIS_CONFIG, ...req.config };
    const keyParts: AnalysisCacheKeyParts = {
      sourceId,
      sourceRevision: req.sourceRevision,
      width,
      height,
      transformRevision: String(req.transformRevision),
      modelVersion: ANALYSIS_MODEL_VERSION,
      config,
    };
    return getCachedAnalysisResult(keyParts);
  }

  async analyze(req: AdaptiveAnalyzeRequest): Promise<AdaptiveAnalyzeOutcome> {
    const { width: srcW, height: srcH } = getSourceDims(req.source);
    const sourceId = req.sourceId ?? assignSourceId(req.source);
    const config: AnalysisConfig = { ...DEFAULT_ANALYSIS_CONFIG, ...req.config };
    const keyParts: AnalysisCacheKeyParts = {
      sourceId,
      sourceRevision: req.sourceRevision,
      width: srcW,
      height: srcH,
      transformRevision: String(req.transformRevision),
      modelVersion: ANALYSIS_MODEL_VERSION,
      config,
    };

    const cached = getCachedAnalysisResult(keyParts);
    if (cached) {
      return { result: cached, fromCache: true, cancelled: false };
    }

    const cacheKey = buildAnalysisCacheKey(keyParts);
    const existingFlight = this.inFlightByKey.get(cacheKey);
    if (existingFlight) {
      return existingFlight;
    }

    if (req.cancelPrevious !== false && this.worker && this.latestJobId > 0) {
      this.worker.postMessage({
        type: 'CANCEL_ANALYSIS',
        jobId: this.latestJobId,
      } satisfies AiWorkerRequest);
      for (const [prevJobId, prevJob] of this.pendingJobs) {
        if (prevJobId <= this.latestJobId && prevJob.cacheKey !== cacheKey) {
          this.pendingJobs.delete(prevJobId);
          prevJob.resolve({ result: null, fromCache: false, cancelled: true });
        }
      }
    }

    const promise = (async (): Promise<AdaptiveAnalyzeOutcome> => {
      const worker = this.getOrCreateWorker();
      const id = this.reqSeq++;
      const jobId = this.jobSeq++;
      this.latestJobId = jobId;

      const maxDim = Math.max(config.yunetMaxSide, config.analysisMaxDim, req.maxAnalysisDim ?? 640);
      const payload = await prepareWorkerTransferPayload(req.source, srcW, srcH, maxDim);

      const outcome = await new Promise<AdaptiveAnalyzeOutcome>((resolve, reject) => {
        this.pendingJobs.set(jobId, { cacheKey, resolve, reject });
        worker.postMessage(
          {
            id,
            jobId,
            type: 'RUN_ANALYSIS',
            sourceId,
            sourceRevision: req.sourceRevision,
            transformRevision: String(req.transformRevision),
            sourceWidth: srcW,
            sourceHeight: srcH,
            bitmap: payload.bitmap,
            rgbaBuffer: payload.rgbaBuffer,
            analysisWidth: payload.analysisW,
            analysisHeight: payload.analysisH,
            config,
          } satisfies AiWorkerRequest,
          payload.transfer,
        );
      });

      if (!outcome.cancelled && outcome.result && outcome.result.status !== 'failed') {
        setCachedAnalysisResult(keyParts, outcome.result);
      }
      return outcome;
    })();

    this.inFlightByKey.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightByKey.delete(cacheKey);
    }
  }

  cancelPending(): void {
    if (this.worker && this.latestJobId > 0) {
      this.worker.postMessage({
        type: 'CANCEL_ANALYSIS',
        jobId: this.latestJobId,
      } satisfies AiWorkerRequest);
    }
    for (const [jobId, job] of this.pendingJobs) {
      this.pendingJobs.delete(jobId);
      job.resolve({ result: null, fromCache: false, cancelled: true });
    }
  }

  dispose(): void {
    this.cancelPending();
    for (const [, misc] of this.pendingMisc) {
      misc.reject(new Error('AdaptiveAnalyzer disposed'));
    }
    this.pendingMisc.clear();
    this.inFlightByKey.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}
