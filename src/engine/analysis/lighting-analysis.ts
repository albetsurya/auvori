/**
 * Stage C — Heuristic YCbCr skin confidence & Rec.709 lighting analysis.
 *
 * Combines:
 * - Stage A Face ROIs & landmarks (if detected)
 * - YCbCr chrominance skin likelihood (`computeSkinWeight` from portrait-mask.ts)
 *   — explicitly labeled and modeled as heuristic skin detection, NOT AI skin segmentation
 * - Stage B Subject mask (PP-HumanSeg or U²-Netp)
 * - 64-bin Rec.709 luminance histogram, subject vs background luminance,
 *   highlight clipping ratio, dark shadow ratio, and confidence gating.
 */

import {
  ANALYSIS_MODEL_VERSION,
  type AnalysisConfig,
  type FaceDetection,
  type LightingStats,
  type MaskBuffer,
} from './analysis-types';
import { computeSkinWeight } from './portrait-mask';

function sampleMaskBilinear(mask: MaskBuffer, u: number, v: number): number {
  if (mask.source === 'none' || mask.width <= 0 || mask.height <= 0) return 0;
  const x = Math.max(0, Math.min(mask.width - 1, u * (mask.width - 1)));
  const y = Math.max(0, Math.min(mask.height - 1, v * (mask.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, mask.width - 1);
  const y1 = Math.min(y0 + 1, mask.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const w = mask.width;
  const m00 = mask.data[y0 * w + x0];
  const m10 = mask.data[y0 * w + x1];
  const m01 = mask.data[y1 * w + x0];
  const m11 = mask.data[y1 * w + x1];
  return (m00 * (1 - fx) + m10 * fx) * (1 - fy) + (m01 * (1 - fx) + m11 * fx) * fy;
}

function computeFaceRoiSkinBoost(u: number, v: number, faces: FaceDetection[]): number {
  let maxBoost = 0;
  for (const face of faces) {
    // Expand face bbox slightly downward for neck/jawline and horizontally for temples/ears.
    const cx = face.bbox.x + face.bbox.width * 0.5;
    const cy = face.bbox.y + face.bbox.height * 0.55;
    const rx = Math.max(face.bbox.width * 0.72, 0.02);
    const ry = Math.max(face.bbox.height * 0.85, 0.02);
    const dx = (u - cx) / rx;
    const dy = (v - cy) / ry;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1.35) {
      const w = Math.exp(-d2 * 1.45);
      if (w > maxBoost) maxBoost = w;
    }
  }
  return maxBoost;
}

export function serializeAnalysisConfig(config: AnalysisConfig): string {
  return JSON.stringify({
    yunetScoreThreshold: Number(config.yunetScoreThreshold.toFixed(4)),
    yunetNmsThreshold: Number(config.yunetNmsThreshold.toFixed(4)),
    yunetMaxSide: config.yunetMaxSide,
    segmentationModel: config.segmentationModel,
    analysisMaxDim: config.analysisMaxDim,
    skinMinConfidence: Number(config.skinMinConfidence.toFixed(4)),
    preferredBackend: config.preferredBackend ?? 'auto',
    modelVersion: ANALYSIS_MODEL_VERSION,
  });
}

export interface StageCSignalsResult {
  skinConfidenceMask: MaskBuffer;
  skinCoverageRatio: number;
  lighting: LightingStats;
  overallConfidence: number;
  confidentForSubjectMask: boolean;
  confidentForAdaptivePortrait: boolean;
}

export function analyzeSkinAndLighting(params: {
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  faces: FaceDetection[];
  subjectMask: MaskBuffer;
  subjectMaskConfidence: number;
  config: AnalysisConfig;
}): StageCSignalsResult {
  const { rgba, width, height, faces, subjectMask, subjectMaskConfidence, config } = params;
  const maxDim = Math.max(32, config.analysisMaxDim);
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const aw = Math.max(8, Math.round(width * scale));
  const ah = Math.max(8, Math.round(height * scale));
  const totalPixels = aw * ah;

  const skinData = new Float32Array(totalPixels);
  const histogram = new Float32Array(64);
  const lumaSamples = new Float32Array(totalPixels);

  let sumLum = 0;
  let sumChroma = 0;
  let clipCount = 0;
  let shadowCount = 0;

  let subjLumNum = 0;
  let subjLumDen = 0;
  let bgLumNum = 0;
  let bgLumDen = 0;

  const scaleX = aw > 1 ? (width - 1) / (aw - 1) : 0;
  const scaleY = ah > 1 ? (height - 1) / (ah - 1) : 0;

  // First pass collects RGB on analysis grid, luma stats, and raw chroma to detect monochrome photos.
  const sampledRgb = new Float32Array(totalPixels * 3);
  for (let y = 0; y < ah; y++) {
    const sy = Math.min(height - 1, Math.round(y * scaleY));
    const v = ah > 1 ? y / (ah - 1) : 0;
    for (let x = 0; x < aw; x++) {
      const sx = Math.min(width - 1, Math.round(x * scaleX));
      const srcIdx = (sy * width + sx) * 4;
      const r = rgba[srcIdx] / 255;
      const g = rgba[srcIdx + 1] / 255;
      const b = rgba[srcIdx + 2] / 255;

      const idx = y * aw + x;
      const p = idx * 3;
      sampledRgb[p] = r;
      sampledRgb[p + 1] = g;
      sampledRgb[p + 2] = b;

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaSamples[idx] = luma;
      sumLum += luma;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      sumChroma += maxC - minC;

      if (luma >= 0.92) clipCount++;
      if (luma <= 0.12) shadowCount++;

      const bin = Math.min(63, Math.max(0, Math.floor(luma * 64)));
      histogram[bin]++;

      const subjW =
        subjectMask.source !== 'none' && subjectMaskConfidence >= 0.35
          ? sampleMaskBilinear(subjectMask, aw > 1 ? x / (aw - 1) : 0, v)
          : 0;
      subjLumNum += luma * subjW;
      subjLumDen += subjW;
      const bgW = 1 - subjW;
      bgLumNum += luma * bgW;
      bgLumDen += bgW;
    }
  }

  for (let i = 0; i < 64; i++) {
    histogram[i] /= totalPixels;
  }

  const meanLuminance = sumLum / totalPixels;
  const meanChroma = sumChroma / totalPixels;
  const isMonochrome = meanChroma < 0.03;

  // Histogram-based quantiles avoid allocating + sorting full arrays on main/worker path.
  const quantileFromHist = (q: number): number => {
    let cum = 0;
    for (let i = 0; i < 64; i++) {
      const next = cum + histogram[i];
      if (next >= q) {
        const frac = histogram[i] > 1e-9 ? (q - cum) / histogram[i] : 0.5;
        return (i + Math.max(0, Math.min(1, frac))) / 64;
      }
      cum = next;
    }
    return 1;
  };
  const medianLuminance = quantileFromHist(0.5);
  const dynamicRange = Math.max(0, quantileFromHist(0.95) - quantileFromHist(0.05));

  const hasConfidentSubject =
    subjectMask.source !== 'none' &&
    subjectMaskConfidence >= 0.45 &&
    subjLumDen >= totalPixels * 0.015;
  const subjectLuminance = hasConfidentSubject ? subjLumNum / Math.max(subjLumDen, 1e-6) : null;
  const backgroundLuminance =
    bgLumDen >= totalPixels * 0.02 ? bgLumNum / Math.max(bgLumDen, 1e-6) : meanLuminance;
  const subjectBackgroundRatio =
    subjectLuminance !== null ? subjectLuminance / Math.max(backgroundLuminance, 0.02) : 1.0;

  const highlightClippingRatio = clipCount / totalPixels;
  const darkShadowRatio = shadowCount / totalPixels;
  const isLowLight = medianLuminance < 0.24 || darkShadowRatio > 0.55;
  const isBacklitPortrait =
    faces.length > 0 &&
    subjectLuminance !== null &&
    backgroundLuminance > subjectLuminance + 0.14;

  // Second pass computes heuristic YCbCr skin confidence combined with face ROI & subject mask.
  let skinSum = 0;
  let skinMin = 1;
  let skinMax = 0;
  let skinConfidentPixels = 0;
  const skinThreshold = config.skinMinConfidence;

  for (let y = 0; y < ah; y++) {
    const v = ah > 1 ? y / (ah - 1) : 0;
    for (let x = 0; x < aw; x++) {
      const u = aw > 1 ? x / (aw - 1) : 0;
      const idx = y * aw + x;
      const p = idx * 3;
      const rawYCbCrSkin = isMonochrome
        ? 0
        : computeSkinWeight(sampledRgb[p], sampledRgb[p + 1], sampledRgb[p + 2]);

      const faceBoost = faces.length > 0 ? computeFaceRoiSkinBoost(u, v, faces) : 0;
      const subjW =
        subjectMask.source !== 'none' ? sampleMaskBilinear(subjectMask, u, v) : 0;

      let combinedSkin = rawYCbCrSkin;
      if (isMonochrome) {
        // Monochrome portraits lack Cb/Cr chroma; gate conservatively inside detected face ROI only.
        combinedSkin = faces.length > 0 ? faceBoost * 0.45 : 0;
      } else if (faces.length > 0) {
        const roiPrior = Math.max(faceBoost, subjW * 0.5);
        // Amplify genuine skin inside face/subject ROI; damp warm background wood/wall false alarms.
        combinedSkin = rawYCbCrSkin * (0.3 + 0.7 * roiPrior) + faceBoost * rawYCbCrSkin * 0.25;
      } else if (subjectMask.source !== 'none') {
        combinedSkin = rawYCbCrSkin * (0.25 + 0.75 * subjW);
      }

      const clamped = combinedSkin < 0 ? 0 : combinedSkin > 1 ? 1 : combinedSkin;
      skinData[idx] = clamped;
      skinSum += clamped;
      if (clamped < skinMin) skinMin = clamped;
      if (clamped > skinMax) skinMax = clamped;
      if (clamped >= skinThreshold) skinConfidentPixels++;
    }
  }

  const skinConfidenceMask: MaskBuffer = {
    width: aw,
    height: ah,
    data: skinData,
    min: totalPixels > 0 ? skinMin : 0,
    max: totalPixels > 0 ? skinMax : 0,
    mean: totalPixels > 0 ? skinSum / totalPixels : 0,
    foregroundRatio: skinConfidentPixels / totalPixels,
    source: 'heuristic-ycbcr-skin',
  };
  const skinCoverageRatio = skinConfidentPixels / totalPixels;

  const lighting: LightingStats = {
    histogram,
    meanLuminance,
    medianLuminance,
    subjectLuminance,
    backgroundLuminance,
    subjectBackgroundRatio,
    highlightClippingRatio,
    darkShadowRatio,
    dynamicRange,
    isLowLight,
    isBacklitPortrait,
    isMonochrome,
  };

  // Confidence gating across Stage A + Stage B + Stage C.
  const topFaceConf = faces.length > 0 ? faces[0].confidence : 0;
  let overallConfidence: number;
  if (faces.length > 0) {
    overallConfidence = Math.min(
      0.99,
      0.5 * topFaceConf + 0.4 * subjectMaskConfidence + 0.1 * Math.min(1, skinCoverageRatio * 4),
    );
  } else {
    overallConfidence = Math.min(0.85, subjectMaskConfidence * 0.85);
  }

  const confidentForSubjectMask =
    subjectMask.source !== 'none' && subjectMaskConfidence >= 0.50;
  const confidentForAdaptivePortrait =
    faces.length > 0 && overallConfidence >= 0.50 && subjectMaskConfidence >= 0.55;

  return {
    skinConfidenceMask,
    skinCoverageRatio,
    lighting,
    overallConfidence,
    confidentForSubjectMask,
    confidentForAdaptivePortrait,
  };
}
