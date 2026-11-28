import type { AdaptiveCorrectionResult } from './types';

const MAX_CACHE_ENTRIES = 16;
const cacheStore = new Map<string, AdaptiveCorrectionResult>();

export interface AdaptiveColorCacheKeyParts {
  sourceId: string;
  sourceRevision: number;
  transformRevision: string | number;
  analysisMaxDim: number;
  version: string;
}

export function buildAdaptiveColorCacheKey(parts: AdaptiveColorCacheKeyParts): string {
  return `${parts.sourceId}::rev=${parts.sourceRevision}::tx=${parts.transformRevision}::dim=${parts.analysisMaxDim}::v=${parts.version}`;
}

export function getCachedAdaptiveColorResult(
  parts: AdaptiveColorCacheKeyParts
): AdaptiveCorrectionResult | null {
  const key = buildAdaptiveColorCacheKey(parts);
  const hit = cacheStore.get(key);
  if (!hit) return null;
  cacheStore.delete(key);
  cacheStore.set(key, hit);
  return hit;
}

export function setCachedAdaptiveColorResult(
  parts: AdaptiveColorCacheKeyParts,
  result: AdaptiveCorrectionResult
): void {
  const key = buildAdaptiveColorCacheKey(parts);
  if (cacheStore.has(key)) {
    cacheStore.delete(key);
  } else if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const oldest = cacheStore.keys().next().value;
    if (oldest !== undefined) cacheStore.delete(oldest);
  }
  cacheStore.set(key, result);
}

export function clearAdaptiveColorCache(): void {
  cacheStore.clear();
}

export function getAdaptiveColorCacheSize(): number {
  return cacheStore.size;
}
