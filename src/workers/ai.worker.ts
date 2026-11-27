/**
 * Off-main-thread AI analysis worker (Phase 3 Foundation).
 *
 * Preserves P0/P1 lightweight probe messages ('PROBE_CAPABILITIES', 'CHECK_MODEL_CACHE')
 * without eagerly importing onnxruntime-web. Lazily loads ORT Web (WebGPU via JSPI or
 * WASM SIMD fallback) and verified .onnx models into Cache Storage ('auvori-ai-models-v1')
 * only when Adaptive Analysis ('RUN_ANALYSIS' or 'WARMUP_MODELS') is requested.
 */

import {
  ANALYSIS_MODEL_VERSION,
  DEFAULT_ANALYSIS_CONFIG,
  type AiExecutionBackend,
  type AiModelId,
  type AnalysisConfig,
  type AnalysisResult,
  type FaceDetection,
  type MaskBuffer,
  type SegmentationModelId,
} from '../engine/analysis/analysis-types';
import {
  AI_MODEL_MANIFEST,
  MODEL_CACHE_NAME,
  loadVerifiedModelBytes,
} from '../engine/analysis/ai-models';
import { decodeYuNetOutputs, prepareYuNetInput } from '../engine/analysis/yunet-detector';
import {
  createEmptyMaskBuffer,
  decodePpHumanSegOutput,
  decodeU2NetpOutput,
  evaluateSubjectMaskConfidence,
  preparePpHumanSegInput,
  prepareU2NetpInput,
} from '../engine/analysis/saliency-segmenter';
import {
  analyzeSkinAndLighting,
  serializeAnalysisConfig,
} from '../engine/analysis/lighting-analysis';

export type AiBackendCapability = AiExecutionBackend;

export type AiWorkerRequest =
  | { id: number; type: 'PROBE_CAPABILITIES' }
  | { id: number; type: 'CHECK_MODEL_CACHE'; cacheName?: string }
  | {
      id: number;
      type: 'WARMUP_MODELS';
      modelIds?: AiModelId[];
      preferredBackend?: AiExecutionBackend;
    }
  | {
      id: number;
      jobId: number;
      type: 'RUN_ANALYSIS';
      sourceId: string;
      sourceRevision: number;
      transformRevision: string;
      sourceWidth: number;
      sourceHeight: number;
      bitmap?: ImageBitmap;
      rgbaBuffer?: ArrayBuffer;
      analysisWidth?: number;
      analysisHeight?: number;
      config?: Partial<AnalysisConfig>;
    }
  | { type: 'CANCEL_ANALYSIS'; jobId: number };

export type AiWorkerResponse =
  | {
      id: number;
      type: 'CAPABILITIES';
      preferredBackend: AiBackendCapability;
      hasWebGPU: boolean;
      hasJSPI: boolean;
      hasCacheStorage: boolean;
      modelsLoaded: boolean;
      loadedModels: AiModelId[];
      activeBackend: AiBackendCapability | null;
    }
  | {
      id: number;
      type: 'MODEL_CACHE_STATUS';
      supported: boolean;
      cachedUrls: string[];
    }
  | {
      id: number;
      type: 'WARMUP_DONE';
      ok: boolean;
      backend: AiExecutionBackend | 'heuristic-only';
      loadedModels: AiModelId[];
      error?: string;
    }
  | {
      id: number;
      jobId: number;
      type: 'ANALYSIS_RESULT';
      result: AnalysisResult;
    }
  | {
      id: number;
      jobId: number;
      type: 'ANALYSIS_CANCELLED';
    }
  | {
      id: number;
      jobId: number;
      type: 'ANALYSIS_ERROR';
      error: string;
    };

type OrtNamespace = typeof import('onnxruntime-web');
type OrtSession = import('onnxruntime-web').InferenceSession;
type OrtTensor = import('onnxruntime-web').Tensor;

interface SessionBundle {
  session: OrtSession;
  backend: AiExecutionBackend;
}

let cachedHasWebGPU: boolean | null = null;

async function detectWebGpuSupport(): Promise<boolean> {
  if (cachedHasWebGPU !== null) return cachedHasWebGPU;
  try {
    const nav = globalThis.navigator as { gpu?: { requestAdapter?: () => Promise<unknown | null> } };
    if (!nav?.gpu?.requestAdapter) {
      cachedHasWebGPU = false;
      return false;
    }
    const adapter = await nav.gpu.requestAdapter();
    cachedHasWebGPU = Boolean(adapter);
    return cachedHasWebGPU;
  } catch {
    cachedHasWebGPU = false;
    return false;
  }
}

function hasJspiSupport(): boolean {
  try {
    const wa = (globalThis as { WebAssembly?: { Suspending?: unknown } }).WebAssembly;
    return typeof wa?.Suspending === 'function';
  } catch {
    return false;
  }
}

let ortWasmModule: OrtNamespace | null = null;
let ortWebGpuModule: OrtNamespace | null = null;

function configureOrtEnv(ort: OrtNamespace): void {
  ort.env.wasm.numThreads =
    typeof self !== 'undefined' && (self as { crossOriginIsolated?: boolean }).crossOriginIsolated
      ? Math.min(4, navigator.hardwareConcurrency || 2)
      : 1;
  ort.env.wasm.proxy = false;
}

async function getOrtModule(backend: AiExecutionBackend): Promise<OrtNamespace> {
  if (backend === 'webgpu') {
    if (!ortWebGpuModule) {
      const mod = (await import('onnxruntime-web/jspi')) as unknown as OrtNamespace;
      configureOrtEnv(mod);
      ortWebGpuModule = mod;
    }
    return ortWebGpuModule;
  }
  if (!ortWasmModule) {
    const mod = (await import('onnxruntime-web/wasm')) as unknown as OrtNamespace;
    configureOrtEnv(mod);
    ortWasmModule = mod;
  }
  return ortWasmModule;
}

const sessionCache = new Map<string, SessionBundle>();
const sessionLoadingPromises = new Map<string, Promise<SessionBundle>>();
const modelBytesCache = new Map<AiModelId, Uint8Array>();

async function ensureModelBytes(
  modelId: AiModelId,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const mem = modelBytesCache.get(modelId);
  if (mem) return mem;
  const { bytes } = await loadVerifiedModelBytes(modelId, {
    cacheName: MODEL_CACHE_NAME,
    signal,
  });
  modelBytesCache.set(modelId, bytes);
  return bytes;
}

async function getOrCreateSession(
  modelId: AiModelId,
  targetBackend: AiExecutionBackend,
  signal?: AbortSignal,
): Promise<SessionBundle> {
  const key = `${modelId}::${targetBackend}`;
  const existing = sessionCache.get(key);
  if (existing) return existing;

  const inflight = sessionLoadingPromises.get(key);
  if (inflight) return inflight;

  const createPromise = (async (): Promise<SessionBundle> => {
    const bytes = await ensureModelBytes(modelId, signal);
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Try requested backend first; fall back cleanly to WASM if WebGPU session creation fails.
    if (targetBackend === 'webgpu' && hasJspiSupport()) {
      try {
        const ortGpu = await getOrtModule('webgpu');
        const session = await ortGpu.InferenceSession.create(bytes, {
          executionProviders: ['webgpu'],
          graphOptimizationLevel: 'all',
        });
        const bundle: SessionBundle = { session, backend: 'webgpu' };
        sessionCache.set(key, bundle);
        return bundle;
      } catch {
        // Fall through cleanly to WASM fallback below.
      }
    }

    const wasmKey = `${modelId}::wasm`;
    const existingWasm = sessionCache.get(wasmKey);
    if (existingWasm) return existingWasm;

    const ortCpu = await getOrtModule('wasm');
    const session = await ortCpu.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    const bundle: SessionBundle = { session, backend: 'wasm' };
    sessionCache.set(wasmKey, bundle);
    return bundle;
  })();

  sessionLoadingPromises.set(key, createPromise);
  try {
    return await createPromise;
  } finally {
    sessionLoadingPromises.delete(key);
  }
}

async function resolveDesiredBackend(preferred?: AiExecutionBackend): Promise<AiExecutionBackend> {
  if (preferred === 'wasm') return 'wasm';
  const hasGpu = await detectWebGpuSupport();
  if (hasGpu && hasJspiSupport()) return 'webgpu';
  return 'wasm';
}

function getLoadedModels(): AiModelId[] {
  const ids = new Set<AiModelId>();
  for (const key of sessionCache.keys()) {
    ids.add(key.split('::')[0] as AiModelId);
  }
  return Array.from(ids);
}

let latestJobId = 0;
const cancelledJobIds = new Set<number>();
const activeJobAborters = new Map<number, AbortController>();

function isJobCancelled(jobId: number): boolean {
  return cancelledJobIds.has(jobId) || jobId < latestJobId;
}

function extractAnalysisRgba(req: Extract<AiWorkerRequest, { type: 'RUN_ANALYSIS' }>): {
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
} {
  if (req.rgbaBuffer) {
    const w = req.analysisWidth ?? req.sourceWidth;
    const h = req.analysisHeight ?? req.sourceHeight;
    return { rgba: new Uint8ClampedArray(req.rgbaBuffer), width: w, height: h };
  }
  if (req.bitmap) {
    const bw = req.bitmap.width;
    const bh = req.bitmap.height;
    try {
      const canvas = new OffscreenCanvas(bw, bh);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable in ai.worker');
      ctx.drawImage(req.bitmap, 0, 0, bw, bh);
      const img = ctx.getImageData(0, 0, bw, bh);
      return { rgba: img.data, width: bw, height: bh };
    } finally {
      try {
        req.bitmap.close();
      } catch {
        // Ignore already-closed ImageBitmap.
      }
    }
  }
  throw new Error('RUN_ANALYSIS requires either bitmap or rgbaBuffer');
}

async function runOrtSession(
  bundle: SessionBundle,
  inputName: string,
  tensorData: Float32Array,
  dims: number[],
): Promise<Record<string, Float32Array>> {
  const ort = await getOrtModule(bundle.backend);
  const inputTensor: OrtTensor = new ort.Tensor('float32', tensorData, dims);
  let outputs: Record<string, OrtTensor> | null = null;
  try {
    outputs = await bundle.session.run({ [inputName]: inputTensor });
    const result: Record<string, Float32Array> = {};
    for (const [name, tensor] of Object.entries(outputs)) {
      result[name] = new Float32Array(tensor.data as Float32Array);
    }
    return result;
  } finally {
    try {
      inputTensor.dispose?.();
    } catch {
      // Ignore disposal errors.
    }
    if (outputs) {
      for (const t of Object.values(outputs)) {
        try {
          t.dispose?.();
        } catch {
          // Ignore disposal errors.
        }
      }
    }
  }
}

async function runStageBSegmentation(
  modelId: SegmentationModelId,
  desiredBackend: AiExecutionBackend,
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  signal: AbortSignal,
): Promise<{ mask: MaskBuffer; backend: AiExecutionBackend }> {
  const runOnBundle = async (bundle: SessionBundle) => {
    const spec = AI_MODEL_MANIFEST[modelId];
    if (modelId === 'pphumanseg-2023mar') {
      const prep = preparePpHumanSegInput(rgba, w, h);
      const outs = await runOrtSession(bundle, spec.inputName, prep.tensorData, prep.dims);
      return decodePpHumanSegOutput(outs[spec.outputNames[0]]);
    }
    const prep = prepareU2NetpInput(rgba, w, h);
    const outs = await runOrtSession(bundle, spec.inputName, prep.tensorData, prep.dims);
    return decodeU2NetpOutput(outs[spec.outputNames[0]]);
  };

  let bundle = await getOrCreateSession(modelId, desiredBackend, signal);
  try {
    const mask = await runOnBundle(bundle);
    return { mask, backend: bundle.backend };
  } catch (err) {
    if (bundle.backend === 'webgpu') {
      bundle = await getOrCreateSession(modelId, 'wasm', signal);
      const mask = await runOnBundle(bundle);
      return { mask, backend: 'wasm' };
    }
    throw err;
  }
}

async function handleRunAnalysis(
  req: Extract<AiWorkerRequest, { type: 'RUN_ANALYSIS' }>,
): Promise<void> {
  const tStart = performance.now();
  latestJobId = Math.max(latestJobId, req.jobId);
  const aborter = new AbortController();
  activeJobAborters.set(req.jobId, aborter);

  const config: AnalysisConfig = {
    ...DEFAULT_ANALYSIS_CONFIG,
    ...req.config,
  };
  const cfgKey = serializeAnalysisConfig(config);

  let decoded: { rgba: Uint8ClampedArray | Uint8Array; width: number; height: number } | null = null;
  try {
    decoded = extractAnalysisRgba(req);
    const { rgba, width: aw, height: ah } = decoded;
    if (aw <= 0 || ah <= 0 || req.sourceWidth <= 0 || req.sourceHeight <= 0) {
      throw new Error(`Invalid image dimensions (${req.sourceWidth}x${req.sourceHeight})`);
    }

    if (isJobCancelled(req.jobId)) {
      self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
      return;
    }

    let desiredBackend = await resolveDesiredBackend(config.preferredBackend);
    const modelsUsed: AiModelId[] = [];
    let segmentationModelUsed: SegmentationModelId | 'none' = 'none';
    let faces: FaceDetection[] = [];
    let subjectMask: MaskBuffer = createEmptyMaskBuffer(1, 1);
    let subjectMaskConfidence = 0;
    let effectiveBackend: AnalysisResult['backend'] = desiredBackend;
    let status: AnalysisResult['status'] = 'complete';
    const degradedReasons: string[] = [];

    let modelLoadMs = 0;
    let preprocessMs = 0;
    let faceDetectMs = 0;
    let segmentationMs = 0;

    // Stage A — YuNet face + landmark detection
    const tYunetLoad0 = performance.now();
    try {
      const yunetBundleInitial = await getOrCreateSession('yunet-2026may', desiredBackend, aborter.signal);
      modelLoadMs += performance.now() - tYunetLoad0;

      if (isJobCancelled(req.jobId)) {
        self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
        return;
      }

      const tPrep0 = performance.now();
      const yunetPrep = prepareYuNetInput(rgba, aw, ah, config.yunetMaxSide);
      preprocessMs += performance.now() - tPrep0;

      const tInf0 = performance.now();
      let activeBundle = yunetBundleInitial;
      let yunetOuts: Record<string, Float32Array>;
      try {
        yunetOuts = await runOrtSession(
          activeBundle,
          AI_MODEL_MANIFEST['yunet-2026may'].inputName,
          yunetPrep.tensorData,
          yunetPrep.dims,
        );
      } catch (err) {
        if (activeBundle.backend === 'webgpu') {
          activeBundle = await getOrCreateSession('yunet-2026may', 'wasm', aborter.signal);
          desiredBackend = 'wasm';
          yunetOuts = await runOrtSession(
            activeBundle,
            AI_MODEL_MANIFEST['yunet-2026may'].inputName,
            yunetPrep.tensorData,
            yunetPrep.dims,
          );
        } else {
          throw err;
        }
      }
      faceDetectMs = performance.now() - tInf0;
      effectiveBackend = activeBundle.backend;
      modelsUsed.push('yunet-2026may');

      faces = decodeYuNetOutputs(
        yunetOuts,
        yunetPrep,
        config.yunetScoreThreshold,
        config.yunetNmsThreshold,
      );
    } catch (err) {
      if (isJobCancelled(req.jobId)) {
        self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
        return;
      }
      status = 'degraded';
      degradedReasons.push(`YuNet unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (isJobCancelled(req.jobId)) {
      self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
      return;
    }

    // Stage B — Subject Segmentation (PP-HumanSeg for detected human portraits; U²-Netp for general objects)
    const segChoice: SegmentationModelId =
      config.segmentationModel === 'pphumanseg'
        ? 'pphumanseg-2023mar'
        : config.segmentationModel === 'u2netp'
          ? 'u2netp-v1'
          : faces.length > 0
            ? 'pphumanseg-2023mar'
            : 'u2netp-v1';

    const tSeg0 = performance.now();
    try {
      const segRes = await runStageBSegmentation(
        segChoice,
        effectiveBackend === 'webgpu' ? 'webgpu' : 'wasm',
        rgba,
        aw,
        ah,
        aborter.signal,
      );
      segmentationMs = performance.now() - tSeg0;
      subjectMask = segRes.mask;
      effectiveBackend = segRes.backend;
      segmentationModelUsed = segChoice;
      modelsUsed.push(segChoice);
      subjectMaskConfidence = evaluateSubjectMaskConfidence(subjectMask, faces);
    } catch (err) {
      if (isJobCancelled(req.jobId)) {
        self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
        return;
      }
      status = 'degraded';
      degradedReasons.push(`${segChoice} unavailable: ${err instanceof Error ? err.message : String(err)}`);
      if (modelsUsed.length === 0) {
        effectiveBackend = 'heuristic-only';
      }
    }

    if (isJobCancelled(req.jobId)) {
      self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
      return;
    }

    // Stage C — Heuristic YCbCr skin confidence + Face ROI + Subject mask + Lighting histogram
    const tStageC0 = performance.now();
    const stageC = analyzeSkinAndLighting({
      rgba,
      width: aw,
      height: ah,
      faces,
      subjectMask,
      subjectMaskConfidence,
      config,
    });
    const skinAndLightingMs = performance.now() - tStageC0;

    const result: AnalysisResult = {
      sourceId: req.sourceId,
      sourceRevision: req.sourceRevision,
      width: req.sourceWidth,
      height: req.sourceHeight,
      transformRevision: req.transformRevision,
      modelVersion: ANALYSIS_MODEL_VERSION,
      analysisConfigKey: cfgKey,
      config,
      backend: effectiveBackend,
      modelsUsed,
      segmentationModelUsed,
      status,
      degradedReason: degradedReasons.length > 0 ? degradedReasons.join('; ') : undefined,
      faces,
      subjectMask,
      subjectMaskConfidence,
      skinConfidenceMask: stageC.skinConfidenceMask,
      skinCoverageRatio: stageC.skinCoverageRatio,
      lighting: stageC.lighting,
      overallConfidence: stageC.overallConfidence,
      confidentForSubjectMask: stageC.confidentForSubjectMask,
      confidentForAdaptivePortrait: stageC.confidentForAdaptivePortrait,
      timingsMs: {
        total: performance.now() - tStart,
        modelLoad: modelLoadMs,
        preprocess: preprocessMs,
        faceDetect: faceDetectMs,
        segmentation: segmentationMs,
        skinAndLighting: skinAndLightingMs,
      },
      createdAt: Date.now(),
    };

    if (isJobCancelled(req.jobId)) {
      self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
      return;
    }

    self.postMessage({
      id: req.id,
      jobId: req.jobId,
      type: 'ANALYSIS_RESULT',
      result,
    } satisfies AiWorkerResponse);
  } catch (err) {
    if (isJobCancelled(req.jobId)) {
      self.postMessage({ id: req.id, jobId: req.jobId, type: 'ANALYSIS_CANCELLED' } satisfies AiWorkerResponse);
      return;
    }
    self.postMessage({
      id: req.id,
      jobId: req.jobId,
      type: 'ANALYSIS_ERROR',
      error: err instanceof Error ? err.message : String(err),
    } satisfies AiWorkerResponse);
  } finally {
    activeJobAborters.delete(req.jobId);
  }
}

self.onmessage = async (event: MessageEvent<AiWorkerRequest>) => {
  const req = event.data;

  if (req.type === 'PROBE_CAPABILITIES') {
    const hasWebGPU = await detectWebGpuSupport();
    const hasJSPI = hasJspiSupport();
    const preferredBackend: AiBackendCapability = hasWebGPU ? 'webgpu' : 'wasm';
    const loaded = getLoadedModels();
    let activeBackend: AiBackendCapability | null = null;
    for (const bundle of sessionCache.values()) {
      activeBackend = bundle.backend;
      break;
    }
    self.postMessage({
      id: req.id,
      type: 'CAPABILITIES',
      preferredBackend,
      hasWebGPU,
      hasJSPI,
      hasCacheStorage: typeof caches !== 'undefined',
      modelsLoaded: loaded.length > 0,
      loadedModels: loaded,
      activeBackend,
    } satisfies AiWorkerResponse);
    return;
  }

  if (req.type === 'CHECK_MODEL_CACHE') {
    const targetCache = req.cacheName ?? MODEL_CACHE_NAME;
    if (typeof caches === 'undefined') {
      self.postMessage({
        id: req.id,
        type: 'MODEL_CACHE_STATUS',
        supported: false,
        cachedUrls: [],
      } satisfies AiWorkerResponse);
      return;
    }
    try {
      const cache = await caches.open(targetCache);
      const keys = await cache.keys();
      self.postMessage({
        id: req.id,
        type: 'MODEL_CACHE_STATUS',
        supported: true,
        cachedUrls: keys.map((k) => k.url),
      } satisfies AiWorkerResponse);
    } catch {
      self.postMessage({
        id: req.id,
        type: 'MODEL_CACHE_STATUS',
        supported: false,
        cachedUrls: [],
      } satisfies AiWorkerResponse);
    }
    return;
  }

  if (req.type === 'CANCEL_ANALYSIS') {
    cancelledJobIds.add(req.jobId);
    const aborter = activeJobAborters.get(req.jobId);
    if (aborter) aborter.abort();
    return;
  }

  if (req.type === 'WARMUP_MODELS') {
    const ids = req.modelIds ?? ['yunet-2026may', 'pphumanseg-2023mar'];
    const backend = await resolveDesiredBackend(req.preferredBackend);
    try {
      let actualBackend: AiExecutionBackend = backend;
      for (const mId of ids) {
        const b = await getOrCreateSession(mId, backend);
        actualBackend = b.backend;
      }
      self.postMessage({
        id: req.id,
        type: 'WARMUP_DONE',
        ok: true,
        backend: actualBackend,
        loadedModels: getLoadedModels(),
      } satisfies AiWorkerResponse);
    } catch (err) {
      self.postMessage({
        id: req.id,
        type: 'WARMUP_DONE',
        ok: false,
        backend: 'heuristic-only',
        loadedModels: getLoadedModels(),
        error: err instanceof Error ? err.message : String(err),
      } satisfies AiWorkerResponse);
    }
    return;
  }

  if (req.type === 'RUN_ANALYSIS') {
    await handleRunAnalysis(req);
  }
};
