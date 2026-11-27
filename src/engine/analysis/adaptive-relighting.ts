/**
 * Phase 4 Direct Flash Adaptive Relighting Engine (Layers A, B, C & D shared parameters & map builder).
 *
 * Pure, DOM-free computation used identically by WebGL2 shaders, Worker Canvas2D fallback,
 * synchronous reference Canvas2D, and full-resolution export.
 */

import type { RelightingRecipe } from '../../types';
import { blurFloatMap } from './portrait-mask';
import type { AnalysisResult, MaskBuffer } from './analysis-types';

export type AdaptiveFlashMode =
  | 'adaptive-portrait'
  | 'conservative-subject'
  | 'fallback-signature';

export interface ResolvedRelightingParams {
  active: boolean;
  mode: AdaptiveFlashMode;
  isPortrait: boolean;
  /** Scene-calibrated subject exposure lift strength [0..0.48]. */
  subjectLift: number;
  /** Controlled midtone/upper-midtone specular crispness [0..0.28]. */
  flashSpecular: number;
  /** Scene-calibrated background falloff/attenuation [0..0.52]. */
  backgroundFalloff: number;
  /** Highlight & white-garment protection factor [0..1]. */
  skinHighlightGuard: number;
  /** Deep black clothing / hair detail floor protection factor [0..1]. */
  shadowFloorGuard: number;
  /** Conservative warm stability preventing chalky skin whitening [0..1]. */
  skinWarmBalance: number;
  /** Transparent non-technical UX status key & label. */
  statusKind: 'ready-portrait' | 'ready-subject' | 'fallback-low-confidence' | 'fallback-offline';
  statusLabel: string;
}

export interface AdaptiveRenderMap {
  width: number;
  height: number;
  /** RGBA Uint8Array: R = refinedSubjectMask, G = landmarkLightFalloff, B = protectedSkinMask, A = 255 */
  rgbaData: Uint8Array;
  mode: AdaptiveFlashMode;
  cacheKey: string;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Resolves Layer A scene lighting & Layer B confidence gating into deterministic
 * relighting scalars shared across GPU and CPU renderers.
 */
export function resolveAdaptiveRelighting(
  relighting: RelightingRecipe | undefined,
  analysis: AnalysisResult | null | undefined,
): ResolvedRelightingParams {
  if (!relighting) {
    return {
      active: false,
      mode: 'fallback-signature',
      isPortrait: false,
      subjectLift: 0,
      flashSpecular: 0,
      backgroundFalloff: 0,
      skinHighlightGuard: 0.85,
      shadowFloorGuard: 0.88,
      skinWarmBalance: 0,
      statusKind: 'fallback-low-confidence',
      statusLabel: 'Signature Fallback',
    };
  }

  const rawLift = Math.max(0, Math.min(45, relighting.subjectLift)) / 45;
  const rawSpec = Math.max(0, Math.min(35, relighting.flashSpecular)) / 35;
  const rawBg = Math.max(0, Math.min(50, relighting.backgroundFalloff)) / 50;
  const hlGuard = clamp01(relighting.skinHighlightGuard);
  const shGuard = clamp01(relighting.shadowFloorGuard);

  // Degraded / offline without AI model cache -> honest signature fallback
  if (!analysis || analysis.status !== 'complete' || analysis.backend === 'heuristic-only') {
    return {
      active: false,
      mode: 'fallback-signature',
      isPortrait: false,
      subjectLift: 0,
      flashSpecular: 0,
      backgroundFalloff: 0,
      skinHighlightGuard: hlGuard,
      shadowFloorGuard: shGuard,
      skinWarmBalance: 0,
      statusKind: 'fallback-offline',
      statusLabel: 'Signature Fallback · Offline Mode',
    };
  }

  const lighting = analysis.lighting;
  const subjLum = lighting.subjectLuminance ?? lighting.meanLuminance;
  const bgLum = lighting.backgroundLuminance;
  const clip = lighting.highlightClippingRatio;

  // Confident human portrait mode (YuNet faces + confident PP-HumanSeg / subject mask)
  if (
    analysis.faces.length > 0 &&
    analysis.confidentForAdaptivePortrait &&
    analysis.subjectMask.source !== 'none'
  ) {
    // Layer A: scene-adaptive lift & background modulation
    // - Bright sunlit scenes get heavily moderated flash lift to avoid blowing out skin/whites.
    // - Backlit or low-light scenes get measured fill-flash lift & controlled ambient separation.
    const brightRoll = 1 - 0.58 * smoothstep(0.48, 0.76, subjLum) - 0.30 * smoothstep(0.14, 0.42, clip);
    const lowLightGain = lighting.isLowLight ? 1.24 : lighting.isBacklitPortrait ? 1.14 : 0.94;
    const liftMod = Math.max(0.24, Math.min(1.28, brightRoll * lowLightGain));

    // Gentle optical flash falloff: restrain on already bright walls/daylight and very dark scenes
    // to prevent gray-washed walls or sticker edge halos.
    const brightBgDamp = 1 - 0.84 * smoothstep(0.66, 0.90, bgLum);
    const darkBgDamp = 0.40 + 0.60 * smoothstep(0.06, 0.36, bgLum);
    const backlitFactor = lighting.isBacklitPortrait ? 1.08 : 0.92;
    const bgMod = Math.max(0.08, Math.min(0.95, darkBgDamp * brightBgDamp * backlitFactor));

    const specBrightDamp = 1 - 0.48 * smoothstep(0.54, 0.84, subjLum);

    return {
      active: rawLift > 0.002 || rawBg > 0.002 || rawSpec > 0.002,
      mode: 'adaptive-portrait',
      isPortrait: true,
      subjectLift: rawLift * 0.42 * liftMod,
      flashSpecular: rawSpec * 0.22 * specBrightDamp,
      backgroundFalloff: rawBg * 0.34 * bgMod,
      skinHighlightGuard: hlGuard,
      shadowFloorGuard: shGuard,
      skinWarmBalance: lighting.isMonochrome ? 0 : 1,
      statusKind: 'ready-portrait',
      statusLabel: 'Adaptive Flash Ready',
    };
  }

  // No face detected, but confident subject silhouette exists (e.g. non-human object / back-turned person)
  if (analysis.confidentForSubjectMask && analysis.subjectMask.source !== 'none') {
    const brightDamp = 1 - 0.72 * smoothstep(0.46, 0.78, subjLum) - 0.38 * smoothstep(0.12, 0.40, clip);
    const liftMod = Math.max(0.14, Math.min(0.85, brightDamp));
    const brightBgDamp = 1 - 0.88 * smoothstep(0.58, 0.88, bgLum);
    const darkBgDamp = 0.42 + 0.58 * smoothstep(0.06, 0.40, bgLum);
    const bgMod = Math.max(0.06, Math.min(0.82, darkBgDamp * brightBgDamp));

    return {
      active: rawLift > 0.002 || rawBg > 0.002 || rawSpec > 0.002,
      mode: 'conservative-subject',
      isPortrait: false,
      subjectLift: rawLift * 0.24 * liftMod,
      flashSpecular: rawSpec * 0.15 * Math.max(0.35, brightDamp),
      backgroundFalloff: rawBg * 0.24 * bgMod,
      skinHighlightGuard: hlGuard,
      shadowFloorGuard: shGuard,
      skinWarmBalance: 0,
      statusKind: 'ready-subject',
      statusLabel: 'Subject Flash Ready',
    };
  }

  // Low subject confidence / empty landscape -> no local relighting
  return {
    active: false,
    mode: 'fallback-signature',
    isPortrait: false,
    subjectLift: 0,
    flashSpecular: 0,
    backgroundFalloff: 0,
    skinHighlightGuard: hlGuard,
    shadowFloorGuard: shGuard,
    skinWarmBalance: 0,
    statusKind: 'fallback-low-confidence',
    statusLabel: 'Signature Fallback · Balanced Tone',
  };
}

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
  return (
    (mask.data[y0 * w + x0] * (1 - fx) + mask.data[y0 * w + x1] * fx) * (1 - fy) +
    (mask.data[y1 * w + x0] * (1 - fx) + mask.data[y1 * w + x1] * fx) * fy
  );
}

/**
 * Fast O(N) Guided Image Filter (He et al. 2010) using separable box averages.
 * Snaps coarse AI mask boundaries tightly onto true hair, hijab, and garment edges
 * in source luminance to prevent bright/dark edge halos.
 */
function guidedRefineSubjectMask(
  rawMask: Float32Array,
  guideLum: Float32Array,
  w: number,
  h: number,
  radius = 3,
  eps = 0.012,
): Float32Array {
  const n = w * h;
  const meanI = blurFloatMap(guideLum, w, h, radius, 1);
  const meanP = blurFloatMap(rawMask, w, h, radius, 1);

  const ii = new Float32Array(n);
  const ip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ii[i] = guideLum[i] * guideLum[i];
    ip[i] = guideLum[i] * rawMask[i];
  }
  const corrI = blurFloatMap(ii, w, h, radius, 1);
  const corrIP = blurFloatMap(ip, w, h, radius, 1);

  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = Math.max(0, corrI[i] - meanI[i] * meanI[i]);
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    const ai = covIP / (varI + eps);
    a[i] = ai;
    b[i] = meanP[i] - ai * meanI[i];
  }

  const meanA = blurFloatMap(a, w, h, radius, 1);
  const meanB = blurFloatMap(b, w, h, radius, 1);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = clamp01(meanA[i] * guideLum[i] + meanB[i]);
  }
  return out;
}

const adaptiveMapCache = new Map<string, AdaptiveRenderMap>();
const MAX_ADAPTIVE_MAP_CACHE = 12;

export function buildAdaptiveRenderMapKey(analysis: AnalysisResult, falloffRadius: number): string {
  return `${analysis.sourceId}::rev=${analysis.sourceRevision}::${analysis.width}x${analysis.height}::tx=${analysis.transformRevision}::cfg=${analysis.analysisConfigKey}::rad=${falloffRadius.toFixed(2)}`;
}

export function getCachedAdaptiveRenderMap(
  analysis: AnalysisResult,
  falloffRadius = 1.15,
): AdaptiveRenderMap | null {
  const key = buildAdaptiveRenderMapKey(analysis, falloffRadius);
  const hit = adaptiveMapCache.get(key);
  if (!hit) return null;
  adaptiveMapCache.delete(key);
  adaptiveMapCache.set(key, hit);
  return hit;
}

/**
 * Builds or retrieves a cached RGBA8 adaptive relighting map shared across GPU WebGL2
 * and CPU Worker Canvas2D renderers.
 *
 * Channels:
 * - R: edge-refined AI subject mask [0..255]
 * - G: multi-face / subject-structure flash irradiance falloff [0..255]
 * - B: gated YCbCr + face ROI skin mask [0..255] (0 when non-portrait / monochrome)
 * - A: 255
 */
export function buildAdaptiveRenderMap(
  analysis: AnalysisResult,
  guideRgba: Uint8ClampedArray | Uint8Array | null,
  guideW: number,
  guideH: number,
  falloffRadius = 1.15,
): AdaptiveRenderMap {
  const key = buildAdaptiveRenderMapKey(analysis, falloffRadius);
  const hit = adaptiveMapCache.get(key);
  if (hit) {
    adaptiveMapCache.delete(key);
    adaptiveMapCache.set(key, hit);
    return hit;
  }

  const mode: AdaptiveFlashMode =
    analysis.status !== 'complete' || analysis.backend === 'heuristic-only'
      ? 'fallback-signature'
      : analysis.faces.length > 0 && analysis.confidentForAdaptivePortrait
        ? 'adaptive-portrait'
        : analysis.confidentForSubjectMask
          ? 'conservative-subject'
          : 'fallback-signature';

  if (mode === 'fallback-signature' || analysis.subjectMask.source === 'none') {
    const neutral: AdaptiveRenderMap = {
      width: 1,
      height: 1,
      rgbaData: new Uint8Array([255, 0, 0, 255]),
      mode: 'fallback-signature',
      cacheKey: key,
    };
    return neutral;
  }

  // Work cleanly on the analysis-grid resolution (256..320 max side) matching luminance edge fidelity
  const targetMax = Math.max(analysis.subjectMask.width, analysis.subjectMask.height, 256);
  const scale = Math.min(1, targetMax / Math.max(analysis.width, analysis.height));
  const mw = Math.max(32, Math.round(analysis.width * scale));
  const mh = Math.max(32, Math.round(analysis.height * scale));
  const total = mw * mh;

  const rawSubj = new Float32Array(total);
  const rawSkin = new Float32Array(total);
  const allowSkin = mode === 'adaptive-portrait' && !analysis.lighting.isMonochrome;

  for (let y = 0; y < mh; y++) {
    const v = mh > 1 ? y / (mh - 1) : 0;
    for (let x = 0; x < mw; x++) {
      const u = mw > 1 ? x / (mw - 1) : 0;
      const idx = y * mw + x;
      rawSubj[idx] = sampleMaskBilinear(analysis.subjectMask, u, v);
      rawSkin[idx] = allowSkin ? sampleMaskBilinear(analysis.skinConfidenceMask, u, v) : 0;
    }
  }

  let refinedSubj = rawSubj;
  if (guideRgba && guideW > 8 && guideH > 8) {
    const guideLum = new Float32Array(total);
    const sxScale = mw > 1 ? (guideW - 1) / (mw - 1) : 0;
    const syScale = mh > 1 ? (guideH - 1) / (mh - 1) : 0;
    for (let y = 0; y < mh; y++) {
      const sy = Math.min(guideH - 1, Math.round(y * syScale));
      for (let x = 0; x < mw; x++) {
        const sx = Math.min(guideW - 1, Math.round(x * sxScale));
        const p = (sy * guideW + sx) * 4;
        guideLum[y * mw + x] =
          (0.299 * guideRgba[p] + 0.587 * guideRgba[p + 1] + 0.114 * guideRgba[p + 2]) / 255;
      }
    }
    const guided = guidedRefineSubjectMask(rawSubj, guideLum, mw, mh, 5, 0.0025);
    // Snap fuzzy AI tails sharply onto true silhouette edges to prevent outer wall glow halos
    refinedSubj = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const snapped = smoothstep(0.20, 0.78, guided[i]);
      refinedSubj[i] = clamp01(snapped * 0.92 + rawSubj[i] * 0.08);
    }
  }

  // Build spatial light falloff anchored on face landmarks (or salient subject centroid if no face)
  const anchors: { cx: number; cy: number; rx: number; ry: number; weight: number }[] = [];
  const aspect = mw / Math.max(1, mh);
  const radScale = Math.max(0.6, Math.min(1.8, falloffRadius));

  if (analysis.faces.length > 0 && mode === 'adaptive-portrait') {
    for (const face of analysis.faces) {
      const eyeMidX = 0.5 * (face.landmarks.rightEye.x + face.landmarks.leftEye.x);
      const eyeMidY = 0.5 * (face.landmarks.rightEye.y + face.landmarks.leftEye.y);
      const anchorX = 0.5 * (eyeMidX + face.landmarks.nose.x);
      const anchorY = 0.65 * face.landmarks.nose.y + 0.35 * eyeMidY + face.bbox.height * 0.16;
      const rx = Math.max(face.bbox.width * 2.25 * radScale, 0.22);
      const ry = Math.max(face.bbox.height * 3.15 * radScale, 0.30);
      anchors.push({
        cx: clamp01(anchorX),
        cy: clamp01(anchorY),
        rx,
        ry,
        weight: Math.max(0.75, face.confidence),
      });
    }
  } else {
    // Subject structure centroid fallback for non-face subjects (e.g. coffee cup or back-turned person)
    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < mh; y++) {
      const v = mh > 1 ? y / (mh - 1) : 0.5;
      for (let x = 0; x < mw; x++) {
        const w = refinedSubj[y * mw + x];
        if (w > 0.25) {
          sumW += w;
          sumX += (mw > 1 ? x / (mw - 1) : 0.5) * w;
          sumY += v * w;
        }
      }
    }
    const cx = sumW > 1e-3 ? sumX / sumW : 0.5;
    const cy = sumW > 1e-3 ? sumY / sumW : 0.5;
    const spread = Math.sqrt(Math.max(0.04, analysis.subjectMask.foregroundRatio));
    anchors.push({
      cx,
      cy,
      rx: Math.max(0.24, spread * 0.95 * radScale),
      ry: Math.max(0.26, spread * 1.05 * radScale),
      weight: 1,
    });
  }

  const rgbaData = new Uint8Array(total * 4);
  for (let y = 0; y < mh; y++) {
    const v = mh > 1 ? y / (mh - 1) : 0;
    for (let x = 0; x < mw; x++) {
      const u = mw > 1 ? x / (mw - 1) : 0;
      const i = y * mw + x;

      const sVal = refinedSubj[i];
      let anchorFalloff = 0;
      for (const a of anchors) {
        const dx = ((u - a.cx) * Math.max(0.75, aspect)) / Math.max(a.rx, 0.08);
        const dy = (v - a.cy) / Math.max(a.ry, 0.08);
        const d2 = dx * dx + dy * dy;
        const w = Math.exp(-d2 * 0.95) * a.weight;
        if (w > anchorFalloff) anchorFalloff = w;
      }

      // Couple directional landmark falloff with refined subject structure so light
      // respects the subject silhouette instead of creating an unanchored center spot.
      const structuredFalloff =
        mode === 'adaptive-portrait'
          ? clamp01((0.38 + 0.62 * anchorFalloff) * (0.20 + 0.80 * sVal))
          : clamp01((0.45 + 0.55 * anchorFalloff) * sVal);

      // Gentle skin mask softening coupled inside subject bounds
      const skVal = allowSkin ? clamp01(rawSkin[i] * (0.35 + 0.65 * sVal)) : 0;

      const o = i * 4;
      rgbaData[o] = Math.round(sVal * 255);
      rgbaData[o + 1] = Math.round(structuredFalloff * 255);
      rgbaData[o + 2] = Math.round(skVal * 255);
      rgbaData[o + 3] = 255;
    }
  }

  const map: AdaptiveRenderMap = {
    width: mw,
    height: mh,
    rgbaData,
    mode,
    cacheKey: key,
  };

  if (adaptiveMapCache.size >= MAX_ADAPTIVE_MAP_CACHE) {
    const oldest = adaptiveMapCache.keys().next().value;
    if (oldest !== undefined) adaptiveMapCache.delete(oldest);
  }
  adaptiveMapCache.set(key, map);
  return map;
}
