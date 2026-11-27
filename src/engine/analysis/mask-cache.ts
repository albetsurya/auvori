export type ImageSourceLike =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas;

export interface PortraitMaskCacheKey {
  sourceId: string;
  sourceRevision: number;
  width: number;
  height: number;
  transformRevision: number;
}

export type PortraitMaskMethod = 'heuristic-skin' | 'heuristic-ellipse' | 'ai-segmentation';

export interface PortraitMaskCacheEntry {
  key: PortraitMaskCacheKey;
  serializedKey: string;
  mw: number;
  mh: number;
  mask: Float32Array;
  confidence: number;
  method: PortraitMaskMethod;
  createdAt: number;
}

export interface MaskCacheStats {
  size: number;
  hits: number;
  misses: number;
}

const MAX_CACHE_ENTRIES = 16;
const cacheStore = new Map<string, PortraitMaskCacheEntry>();
const sourceIdMap = new WeakMap<object, string>();
let nextAutoSourceSeq = 1;
let totalHits = 0;
let totalMisses = 0;

/**
 * Assigns or retrieves a stable session-unique ID for an image/canvas/bitmap object.
 */
export function assignSourceId(source: ImageSourceLike): string {
  const existing = sourceIdMap.get(source as object);
  if (existing) return existing;
  const id = `src_${nextAutoSourceSeq++}`;
  sourceIdMap.set(source as object, id);
  return id;
}

export function serializeMaskCacheKey(key: PortraitMaskCacheKey): string {
  return `${key.sourceId}:${key.sourceRevision}:${key.width}x${key.height}:${key.transformRevision}`;
}

export function getCachedPortraitMask(key: PortraitMaskCacheKey): PortraitMaskCacheEntry | null {
  const serialized = serializeMaskCacheKey(key);
  const entry = cacheStore.get(serialized);
  if (!entry) {
    totalMisses++;
    return null;
  }
  // Refresh LRU order
  cacheStore.delete(serialized);
  cacheStore.set(serialized, entry);
  totalHits++;
  return entry;
}

export function setCachedPortraitMask(
  key: PortraitMaskCacheKey,
  data: Omit<PortraitMaskCacheEntry, 'key' | 'serializedKey' | 'createdAt'>
): PortraitMaskCacheEntry {
  const serialized = serializeMaskCacheKey(key);
  if (cacheStore.has(serialized)) {
    cacheStore.delete(serialized);
  } else if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey !== undefined) cacheStore.delete(oldestKey);
  }

  const entry: PortraitMaskCacheEntry = {
    key: { ...key },
    serializedKey: serialized,
    mw: data.mw,
    mh: data.mh,
    mask: data.mask,
    confidence: data.confidence,
    method: data.method,
    createdAt: Date.now()
  };
  cacheStore.set(serialized, entry);
  return entry;
}

export function clearMaskCache(): void {
  cacheStore.clear();
  totalHits = 0;
  totalMisses = 0;
}

export function getMaskCacheStats(): MaskCacheStats {
  return {
    size: cacheStore.size,
    hits: totalHits,
    misses: totalMisses
  };
}
