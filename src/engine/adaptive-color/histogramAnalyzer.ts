import { clamp01 } from './colorSpace';
import type { HistogramAnalysis, LuminancePercentiles } from './types';

export const HISTOGRAM_BINS = 256;

export function quantileFromNormalizedHistogram(hist: Float32Array, q: number): number {
  const target = clamp01(q);
  const n = hist.length;
  if (n === 0) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) total += hist[i];
  if (total <= 1e-9) return 0;

  let cum = 0;
  for (let i = 0; i < n; i++) {
    const val = hist[i] / total;
    const next = cum + val;
    if (next >= target) {
      const frac = val > 1e-9 ? (target - cum) / val : 0.5;
      return clamp01((i + clamp01(frac)) / n);
    }
    cum = next;
  }
  return 1;
}

export interface HistogramAccumulator {
  lum: Float32Array;
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  weightSum: number;
  rClipWeight: number;
  gClipWeight: number;
  bClipWeight: number;
}

export function createHistogramAccumulator(): HistogramAccumulator {
  return {
    lum: new Float32Array(HISTOGRAM_BINS),
    red: new Float32Array(HISTOGRAM_BINS),
    green: new Float32Array(HISTOGRAM_BINS),
    blue: new Float32Array(HISTOGRAM_BINS),
    weightSum: 0,
    rClipWeight: 0,
    gClipWeight: 0,
    bClipWeight: 0
  };
}

export function accumulateHistogramSample(
  acc: HistogramAccumulator,
  rSrgb: number,
  gSrgb: number,
  bSrgb: number,
  lumPerc: number,
  weight = 1
): void {
  if (weight <= 0) return;
  const maxBin = HISTOGRAM_BINS - 1;
  const lBin = Math.min(maxBin, Math.max(0, Math.floor(clamp01(lumPerc) * HISTOGRAM_BINS)));
  const rBin = Math.min(maxBin, Math.max(0, Math.floor(clamp01(rSrgb) * HISTOGRAM_BINS)));
  const gBin = Math.min(maxBin, Math.max(0, Math.floor(clamp01(gSrgb) * HISTOGRAM_BINS)));
  const bBin = Math.min(maxBin, Math.max(0, Math.floor(clamp01(bSrgb) * HISTOGRAM_BINS)));

  acc.lum[lBin] += weight;
  acc.red[rBin] += weight;
  acc.green[gBin] += weight;
  acc.blue[bBin] += weight;
  acc.weightSum += weight;

  if (rSrgb >= 0.98) acc.rClipWeight += weight;
  if (gSrgb >= 0.98) acc.gClipWeight += weight;
  if (bSrgb >= 0.98) acc.bClipWeight += weight;
}

export function finalizeHistogramAnalysis(acc: HistogramAccumulator): HistogramAnalysis {
  const denom = acc.weightSum > 1e-9 ? acc.weightSum : 1;

  const luminance = new Float32Array(HISTOGRAM_BINS);
  const red = new Float32Array(HISTOGRAM_BINS);
  const green = new Float32Array(HISTOGRAM_BINS);
  const blue = new Float32Array(HISTOGRAM_BINS);

  if (acc.weightSum > 1e-9) {
    for (let i = 0; i < HISTOGRAM_BINS; i++) {
      luminance[i] = acc.lum[i] / denom;
      red[i] = acc.red[i] / denom;
      green[i] = acc.green[i] / denom;
      blue[i] = acc.blue[i] / denom;
    }
  }

  const percentiles: LuminancePercentiles =
    acc.weightSum > 1e-9
      ? {
          p01: quantileFromNormalizedHistogram(luminance, 0.01),
          p02: quantileFromNormalizedHistogram(luminance, 0.02),
          p05: quantileFromNormalizedHistogram(luminance, 0.05),
          p10: quantileFromNormalizedHistogram(luminance, 0.10),
          p15: quantileFromNormalizedHistogram(luminance, 0.15),
          p25: quantileFromNormalizedHistogram(luminance, 0.25),
          p50: quantileFromNormalizedHistogram(luminance, 0.50),
          p75: quantileFromNormalizedHistogram(luminance, 0.75),
          p90: quantileFromNormalizedHistogram(luminance, 0.90),
          p95: quantileFromNormalizedHistogram(luminance, 0.95),
          p98: quantileFromNormalizedHistogram(luminance, 0.98),
          p99: quantileFromNormalizedHistogram(luminance, 0.99)
        }
      : {
          p01: 0,
          p02: 0,
          p05: 0,
          p10: 0,
          p15: 0,
          p25: 0,
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
          p98: 0,
          p99: 0
        };

  return {
    bins: HISTOGRAM_BINS,
    luminance,
    red,
    green,
    blue,
    percentiles,
    channelFloors: {
      r: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(red, 0.03) : 0,
      g: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(green, 0.03) : 0,
      b: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(blue, 0.03) : 0
    },
    channelCeilings: {
      r: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(red, 0.97) : 0,
      g: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(green, 0.97) : 0,
      b: acc.weightSum > 1e-9 ? quantileFromNormalizedHistogram(blue, 0.97) : 0
    },
    channelClipping: {
      r: acc.weightSum > 1e-9 ? acc.rClipWeight / denom : 0,
      g: acc.weightSum > 1e-9 ? acc.gClipWeight / denom : 0,
      b: acc.weightSum > 1e-9 ? acc.bClipWeight / denom : 0
    }
  };
}
