import { ColorRecipe } from '../types';
import {
  AdaptiveFlashMode,
  AdaptiveRenderMap,
  ResolvedRelightingParams
} from '../engine/analysis/adaptive-relighting';
import { getCachedPortraitMask, PortraitMaskCacheKey, setCachedPortraitMask } from '../engine/analysis/mask-cache';
import { computePortraitMaskFromRgba, PortraitMaskResult } from '../engine/analysis/portrait-mask';
import { applyRecipeToPixelBuffer, isNeutralRecipe } from '../engine/core/pixel-grade';

export interface WorkerAdaptiveMapPayload {
  width: number;
  height: number;
  rgbaBuffer: ArrayBuffer;
  mode: AdaptiveFlashMode;
  cacheKey: string;
}

export interface WorkerRenderPayload {
  id: number;
  type: 'RENDER_CANVAS2D';
  bitmap?: ImageBitmap;
  rgbaBuffer?: ArrayBuffer;
  width: number;
  height: number;
  recipe: ColorRecipe;
  cacheKey: PortraitMaskCacheKey;
  adaptiveMap?: WorkerAdaptiveMapPayload | null;
  relightingParams?: ResolvedRelightingParams | null;
  includeGrain?: boolean;
}

export interface WorkerMaskPayload {
  id: number;
  type: 'COMPUTE_PORTRAIT_MASK';
  bitmap?: ImageBitmap;
  rgbaBuffer?: ArrayBuffer;
  width: number;
  height: number;
  cacheKey: PortraitMaskCacheKey;
}

export interface WorkerThumbnailItem {
  presetId: string;
  recipe: ColorRecipe;
}

export interface WorkerThumbnailBatchPayload {
  id: number;
  batchId: number;
  type: 'RENDER_THUMBNAIL_BATCH';
  bitmap?: ImageBitmap;
  rgbaBuffer?: ArrayBuffer;
  width: number;
  height: number;
  items: WorkerThumbnailItem[];
}

export interface WorkerCancelBatchPayload {
  type: 'CANCEL_BATCH';
  batchId: number;
}

export type ImageWorkerRequest =
  | WorkerRenderPayload
  | WorkerMaskPayload
  | WorkerThumbnailBatchPayload
  | WorkerCancelBatchPayload;

export type ImageWorkerResponse =
  | {
      id: number;
      type: 'RENDER_DONE';
      width: number;
      height: number;
      bitmap?: ImageBitmap;
      rgbaBuffer?: ArrayBuffer;
      maskMethod?: PortraitMaskResult['method'];
      maskConfidence?: number;
      maskFromCache?: boolean;
      durationMs: number;
    }
  | {
      id: number;
      type: 'MASK_DONE';
      mw: number;
      mh: number;
      maskBuffer: ArrayBuffer;
      confidence: number;
      method: PortraitMaskResult['method'];
      fromCache: boolean;
      durationMs: number;
    }
  | {
      id: number;
      batchId: number;
      type: 'THUMBNAIL_ITEM';
      presetId: string;
      blob: Blob;
    }
  | {
      id: number;
      batchId: number;
      type: 'THUMBNAIL_BATCH_DONE';
      cancelled: boolean;
    }
  | {
      id: number;
      type: 'ERROR';
      error: string;
    };

let latestCancelledBatchId = 0;

function extractRgbaFromSource(
  width: number,
  height: number,
  bitmap?: ImageBitmap,
  rgbaBuffer?: ArrayBuffer
): Uint8ClampedArray {
  if (rgbaBuffer) {
    return new Uint8ClampedArray(rgbaBuffer);
  }
  if (!bitmap || typeof OffscreenCanvas === 'undefined') {
    throw new Error('Worker requires OffscreenCanvas or RGBA buffer input');
  }
  const off = new OffscreenCanvas(width, height);
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to acquire 2D context in image worker');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

async function encodeThumbnailBlob(
  rgba: Uint8ClampedArray,
  w: number,
  h: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d');
    if (ctx) {
      const imgData = new ImageData(new Uint8ClampedArray(rgba), w, h);
      ctx.putImageData(imgData, 0, 0);
      return off.convertToBlob({ type: 'image/jpeg', quality: 0.78 });
    }
  }
  return new Blob([rgba.buffer as ArrayBuffer], { type: 'application/octet-stream' });
}

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'CANCEL_BATCH') {
    latestCancelledBatchId = Math.max(latestCancelledBatchId, msg.batchId);
    return;
  }

  try {
    if (msg.type === 'COMPUTE_PORTRAIT_MASK') {
      const t0 = performance.now();
      try {
        const hit = getCachedPortraitMask(msg.cacheKey);
        if (hit) {
          const copy = new Float32Array(hit.mask);
          const resp: ImageWorkerResponse = {
            id: msg.id,
            type: 'MASK_DONE',
            mw: hit.mw,
            mh: hit.mh,
            maskBuffer: copy.buffer,
            confidence: hit.confidence,
            method: hit.method,
            fromCache: true,
            durationMs: performance.now() - t0
          };
          (self as unknown as Worker).postMessage(resp, [copy.buffer]);
          return;
        }

        const data = extractRgbaFromSource(msg.width, msg.height, msg.bitmap, msg.rgbaBuffer);
        const computed = computePortraitMaskFromRgba(data, msg.width, msg.height);
        setCachedPortraitMask(msg.cacheKey, computed);

        const copy = new Float32Array(computed.mask);
        const resp: ImageWorkerResponse = {
          id: msg.id,
          type: 'MASK_DONE',
          mw: computed.mw,
          mh: computed.mh,
          maskBuffer: copy.buffer,
          confidence: computed.confidence,
          method: computed.method,
          fromCache: false,
          durationMs: performance.now() - t0
        };
        (self as unknown as Worker).postMessage(resp, [copy.buffer]);
      } finally {
        msg.bitmap?.close();
      }
      return;
    }

    if (msg.type === 'RENDER_CANVAS2D') {
      const t0 = performance.now();
      try {
        const data = extractRgbaFromSource(msg.width, msg.height, msg.bitmap, msg.rgbaBuffer);

        let portraitMask: PortraitMaskResult | null = null;
        if (!isNeutralRecipe(msg.recipe)) {
          const needsMask = msg.recipe.bgDarken > 0.25 || msg.recipe.bgBokeh > 0.25;
          if (needsMask) {
            const hit = getCachedPortraitMask(msg.cacheKey);
            if (hit) {
              portraitMask = {
                mw: hit.mw,
                mh: hit.mh,
                mask: hit.mask,
                confidence: hit.confidence,
                method: hit.method,
                fromCache: true
              };
            } else {
              const computed = computePortraitMaskFromRgba(data, msg.width, msg.height);
              setCachedPortraitMask(msg.cacheKey, computed);
              portraitMask = { ...computed, fromCache: false };
            }
          }

          const adaptiveMap: AdaptiveRenderMap | null = msg.adaptiveMap
            ? {
                width: msg.adaptiveMap.width,
                height: msg.adaptiveMap.height,
                rgbaData: new Uint8Array(msg.adaptiveMap.rgbaBuffer),
                mode: msg.adaptiveMap.mode,
                cacheKey: msg.adaptiveMap.cacheKey
              }
            : null;

          applyRecipeToPixelBuffer(data, msg.width, msg.height, msg.recipe, {
            portraitMask,
            adaptiveMap,
            relightingParams: msg.relightingParams ?? null,
            includeGrain: msg.includeGrain
          });
        }

        if (typeof OffscreenCanvas !== 'undefined') {
          const out = new OffscreenCanvas(msg.width, msg.height);
          const ctx = out.getContext('2d');
          if (ctx) {
            ctx.putImageData(new ImageData(new Uint8ClampedArray(data), msg.width, msg.height), 0, 0);
            const outBitmap = out.transferToImageBitmap();
            const resp: ImageWorkerResponse = {
              id: msg.id,
              type: 'RENDER_DONE',
              width: msg.width,
              height: msg.height,
              bitmap: outBitmap,
              maskMethod: portraitMask?.method,
              maskConfidence: portraitMask?.confidence,
              maskFromCache: portraitMask?.fromCache,
              durationMs: performance.now() - t0
            };
            (self as unknown as Worker).postMessage(resp, [outBitmap]);
            return;
          }
        }

        const outBuf = new Uint8ClampedArray(data);
        const resp: ImageWorkerResponse = {
          id: msg.id,
          type: 'RENDER_DONE',
          width: msg.width,
          height: msg.height,
          rgbaBuffer: outBuf.buffer,
          maskMethod: portraitMask?.method,
          maskConfidence: portraitMask?.confidence,
          maskFromCache: portraitMask?.fromCache,
          durationMs: performance.now() - t0
        };
        (self as unknown as Worker).postMessage(resp, [outBuf.buffer]);
      } finally {
        msg.bitmap?.close();
      }
      return;
    }

    if (msg.type === 'RENDER_THUMBNAIL_BATCH') {
      try {
        const baseRgba = extractRgbaFromSource(msg.width, msg.height, msg.bitmap, msg.rgbaBuffer);
        const anyPortrait = msg.items.some(
          (item) => item.recipe.bgDarken > 0.25 || item.recipe.bgBokeh > 0.25
        );
        const sharedMask = anyPortrait
          ? computePortraitMaskFromRgba(baseRgba, msg.width, msg.height)
          : null;

        let cancelled = false;
        for (const item of msg.items) {
          if (msg.batchId <= latestCancelledBatchId) {
            cancelled = true;
            break;
          }
          const copy = new Uint8ClampedArray(baseRgba);
          if (!isNeutralRecipe(item.recipe)) {
            applyRecipeToPixelBuffer(copy, msg.width, msg.height, item.recipe, {
              portraitMask: sharedMask
            });
          }
          const blob = await encodeThumbnailBlob(copy, msg.width, msg.height);
          const itemResp: ImageWorkerResponse = {
            id: msg.id,
            batchId: msg.batchId,
            type: 'THUMBNAIL_ITEM',
            presetId: item.presetId,
            blob
          };
          (self as unknown as Worker).postMessage(itemResp);
        }

        const doneResp: ImageWorkerResponse = {
          id: msg.id,
          batchId: msg.batchId,
          type: 'THUMBNAIL_BATCH_DONE',
          cancelled
        };
        (self as unknown as Worker).postMessage(doneResp);
      } finally {
        msg.bitmap?.close();
      }
    }
  } catch (err) {
    const errResp: ImageWorkerResponse = {
      id: (msg as { id?: number }).id ?? 0,
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err)
    };
    (self as unknown as Worker).postMessage(errResp);
  }
};
