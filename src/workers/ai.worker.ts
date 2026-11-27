/**
 * P1-ready AI inference worker scaffold (Face Detection, Subject Segmentation, Skin Segmentation).
 * Runs off the main thread and exposes runtime backend capability detection (WebGPU / WASM)
 * and offline model cache readiness without loading heavyweight runtimes in P0.
 */

export type AiBackendCapability = 'webgpu' | 'wasm';

export type AiWorkerRequest =
  | { id: number; type: 'PROBE_CAPABILITIES' }
  | { id: number; type: 'CHECK_MODEL_CACHE'; cacheName?: string };

export type AiWorkerResponse =
  | {
      id: number;
      type: 'CAPABILITIES';
      preferredBackend: AiBackendCapability;
      hasWebGPU: boolean;
      hasCacheStorage: boolean;
      modelsLoaded: boolean;
    }
  | {
      id: number;
      type: 'MODEL_CACHE_STATUS';
      supported: boolean;
      cachedUrls: string[];
    };

self.onmessage = async (event: MessageEvent<AiWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'PROBE_CAPABILITIES') {
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const hasCacheStorage = typeof caches !== 'undefined';
    const resp: AiWorkerResponse = {
      id: msg.id,
      type: 'CAPABILITIES',
      preferredBackend: hasWebGPU ? 'webgpu' : 'wasm',
      hasWebGPU,
      hasCacheStorage,
      modelsLoaded: false
    };
    (self as unknown as Worker).postMessage(resp);
    return;
  }

  if (msg.type === 'CHECK_MODEL_CACHE') {
    if (typeof caches === 'undefined') {
      const resp: AiWorkerResponse = { id: msg.id, type: 'MODEL_CACHE_STATUS', supported: false, cachedUrls: [] };
      (self as unknown as Worker).postMessage(resp);
      return;
    }
    const cache = await caches.open(msg.cacheName || 'auvori-ai-models-v1');
    const keys = await cache.keys();
    const resp: AiWorkerResponse = {
      id: msg.id,
      type: 'MODEL_CACHE_STATUS',
      supported: true,
      cachedUrls: keys.map((req) => req.url)
    };
    (self as unknown as Worker).postMessage(resp);
  }
};
