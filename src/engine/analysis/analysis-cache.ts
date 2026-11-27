/**
 * Revision-aware LRU cache for Phase 3 Adaptive Analysis results.
 * Keys strictly incorporate sourceId, sourceRevision, dimensions,
 * transformRevision (crop/rotation/flip), modelVersion, and analysisConfigKey.
 * Preset intensity and color/filter slider adjustments NEVER invalidate this cache.
 */

import type { AnalysisConfig, AnalysisResult } from './analysis-types';
import { serializeAnalysisConfig } from './lighting-analysis';

export interface AnalysisCacheKeyParts {
  sourceId: string;
  sourceRevision: number;
  width: number;
  height: number;
  transformRevision: string;
  modelVersion: string;
  config: AnalysisConfig;
}

export function buildAnalysisCacheKey(parts: AnalysisCacheKeyParts): string {
  const cfgKey = serializeAnalysisConfig(parts.config);
  return `${parts.sourceId}::rev=${parts.sourceRevision}::${parts.width}x${parts.height}::tx=${parts.transformRevision}::mv=${parts.modelVersion}::cfg=${cfgKey}`;
}

const MAX_ANALYSIS_CACHE_ENTRIES = 12;
const analysisCache = new Map<string, AnalysisResult>();

export function getCachedAnalysisResult(parts: AnalysisCacheKeyParts): AnalysisResult | null {
  const key = buildAnalysisCacheKey(parts);
  const hit = analysisCache.get(key);
  if (!hit) return null;
  // Refresh LRU recency order.
  analysisCache.delete(key);
  analysisCache.set(key, hit);
  return hit;
}

export function setCachedAnalysisResult(parts: AnalysisCacheKeyParts, result: AnalysisResult): void {
  const key = buildAnalysisCacheKey(parts);
  if (analysisCache.has(key)) {
    analysisCache.delete(key);
  } else if (analysisCache.size >= MAX_ANALYSIS_CACHE_ENTRIES) {
    const oldest = analysisCache.keys().next().value;
    if (oldest !== undefined) {
      analysisCache.delete(oldest);
    }
  }
  analysisCache.set(key, result);
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
}

export function getAnalysisCacheSize(): number {
  return analysisCache.size;
}
