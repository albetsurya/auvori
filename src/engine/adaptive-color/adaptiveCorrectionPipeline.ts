import { computeSkinWeight } from '../analysis/portrait-mask';
import {
  clamp01,
  hsvToRgb,
  linearToSrgb,
  rgbToHsv,
  smoothstep,
  softHighlightCompress,
  srgbToLinear
} from './colorSpace';
import { solveAdaptiveCorrections } from './correctionSolver';
import { validateAdaptiveCorrections } from './correctionValidator';
import { analyzeImageRgba, createEmptyImageAnalysisReport } from './imageAnalyzer';
import {
  ADAPTIVE_COLOR_VERSION,
  AdaptiveColorAnalyzeOptions,
  AdaptiveColorRenderParams,
  AdaptiveCorrectionParameters,
  AdaptiveCorrectionResult,
  DEFAULT_ADAPTIVE_COLOR_CONFIG,
  NEUTRAL_ADAPTIVE_PARAMETERS
} from './types';

const nowMs = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function buildNeutralAdaptiveCorrectionResult(
  width = 0,
  height = 0,
  warning = 'empty-or-invalid-image'
): AdaptiveCorrectionResult {
  return {
    version: ADAPTIVE_COLOR_VERSION,
    sourceSignature: `empty:${width}x${height}`,
    parameters: { ...NEUTRAL_ADAPTIVE_PARAMETERS },
    confidence: {
      overall: 0,
      exposure: 0,
      whiteBalance: 0,
      skin: 0,
      foliage: 0
    },
    analysis: createEmptyImageAnalysisReport(width, height),
    warnings: warning ? [warning] : [],
    timingsMs: { analysis: 0, solver: 0, total: 0 }
  };
}

/**
 * Pure, deterministic end-to-end Adaptive Color Correction analysis + solver + validator.
 * Runs identically in browser main thread, Web Workers, and Node unit tests.
 */
export function analyzeAndSolveAdaptiveColorFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: AdaptiveColorAnalyzeOptions
): AdaptiveCorrectionResult {
  const t0 = nowMs();
  if (!rgba || width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return buildNeutralAdaptiveCorrectionResult(Math.max(0, width | 0), Math.max(0, height | 0));
  }

  const analysis = analyzeImageRgba(rgba, width, height, options);
  const tAnalysis = nowMs();

  if (analysis.validPixelRatio <= 1e-4) {
    return {
      version: ADAPTIVE_COLOR_VERSION,
      sourceSignature: options?.sourceSignature ?? `${width}x${height}`,
      parameters: { ...NEUTRAL_ADAPTIVE_PARAMETERS },
      confidence: { overall: 0, exposure: 0, whiteBalance: 0, skin: 0, foliage: 0 },
      analysis,
      warnings: ['empty-or-transparent-image'],
      timingsMs: {
        analysis: tAnalysis - t0,
        solver: 0,
        total: tAnalysis - t0
      }
    };
  }

  const solved = solveAdaptiveCorrections(analysis, options?.config);
  const validated = validateAdaptiveCorrections(
    solved.parameters,
    analysis,
    solved.notes,
    options?.config
  );
  const tEnd = nowMs();

  return {
    version: ADAPTIVE_COLOR_VERSION,
    sourceSignature: options?.sourceSignature ?? `${width}x${height}`,
    parameters: validated.parameters,
    confidence: solved.confidence,
    analysis,
    warnings: validated.warnings,
    timingsMs: {
      analysis: tAnalysis - t0,
      solver: tEnd - tAnalysis,
      total: tEnd - t0
    }
  };
}

export function hasActiveAdaptiveColor(params: AdaptiveColorRenderParams | undefined): boolean {
  if (!params || !Number.isFinite(params.strength) || params.strength <= 1e-4) return false;
  return (
    Math.abs(params.exposure) > 1e-4 ||
    Math.abs(params.highlights) > 1e-4 ||
    Math.abs(params.shadows) > 1e-4 ||
    Math.abs(params.contrast) > 1e-4 ||
    Math.abs(params.temperature) > 1e-4 ||
    Math.abs(params.tint) > 1e-4 ||
    Math.abs(params.vibrance) > 1e-4 ||
    Math.abs(params.saturation) > 1e-4 ||
    params.greenCorrection > 1e-4 ||
    Math.abs(params.blackPoint) > 1e-4 ||
    Math.abs(params.whitePoint) > 1e-4
  );
}

/**
 * Packages solved adaptive correction parameters with user strength percentage [0..100].
 * Does not re-run analysis; safe to call on every strength slider drag event.
 */
export function toAdaptiveColorRenderParams(
  parameters: AdaptiveCorrectionParameters,
  strengthPct: number
): AdaptiveColorRenderParams | undefined {
  const k = clamp01(strengthPct / 100);
  if (k <= 1e-4) return undefined;
  const out: AdaptiveColorRenderParams = {
    ...parameters,
    strength: k
  };
  return hasActiveAdaptiveColor(out) ? out : undefined;
}

/**
 * Canonical per-pixel Adaptive Color Correction kernel (sRGB [0..1] -> sRGB [0..1]).
 * Matches GLSL `applyAdaptiveColorCorrection` in `color-grading.frag` bit-for-bit.
 * Blends original and corrected results in linear light space according to `params.strength`.
 */
export function applyAdaptiveColorToPixel(
  rIn: number,
  gIn: number,
  bIn: number,
  params: AdaptiveColorRenderParams
): [number, number, number] {
  const k = clamp01(params.strength);
  if (k <= 1e-4) return [rIn, gIn, bIn];

  const r0 = clamp01(rIn);
  const g0 = clamp01(gIn);
  const b0 = clamp01(bIn);

  const linOrigR = srgbToLinear(r0);
  const linOrigG = srgbToLinear(g0);
  const linOrigB = srgbToLinear(b0);

  // 1. Skin-protected White Balance in linear RGB
  const skinPre = computeSkinWeight(r0, g0, b0);
  const wbProtect = 1 - skinPre * 0.48;
  const gainR = Math.max(0.5, 1 + params.temperature * 0.26 * wbProtect + params.tint * 0.10 * wbProtect);
  const gainG = Math.max(0.5, 1 - params.tint * 0.18 * wbProtect);
  const gainB = Math.max(0.5, 1 - params.temperature * 0.28 * wbProtect + params.tint * 0.10 * wbProtect);

  let lr = Math.max(0, linOrigR * gainR);
  let lg = Math.max(0, linOrigG * gainG);
  let lb = Math.max(0, linOrigB * gainB);

  // 2. Exposure in linear RGB with ratio-preserving soft highlight shoulder
  if (Math.abs(params.exposure) > 1e-4) {
    const expMult = Math.pow(2, params.exposure);
    lr *= expMult;
    lg *= expMult;
    lb *= expMult;
    const maxLin = Math.max(lr, lg, lb);
    if (maxLin > 0.72) {
      const comp = softHighlightCompress(maxLin, 0.72);
      const sc = comp / maxLin;
      lr *= sc;
      lg *= sc;
      lb *= sc;
    }
  }

  let cr = linearToSrgb(lr);
  let cg = linearToSrgb(lg);
  let cb = linearToSrgb(lb);

  // 3. Black Point & White Point tonal depth anchoring
  if (Math.abs(params.blackPoint) > 1e-4 || Math.abs(params.whitePoint) > 1e-4) {
    const lumBW = clamp01(0.2126 * cr + 0.7152 * cg + 0.0722 * cb);
    if (params.blackPoint < -1e-4) {
      const toeMask = (1 - lumBW) * (1 - lumBW);
      const scaleB = Math.max(0.65, 1 + params.blackPoint * 3.2 * toeMask);
      cr *= scaleB;
      cg *= scaleB;
      cb *= scaleB;
    } else if (params.blackPoint > 1e-4) {
      const toeMask = (1 - lumBW) * (1 - lumBW);
      const liftB = params.blackPoint * 0.45 * toeMask;
      cr = clamp01(cr + liftB);
      cg = clamp01(cg + liftB);
      cb = clamp01(cb + liftB);
    }

    if (params.whitePoint > 1e-4) {
      const hlMaskW = smoothstep(0.45, 1.0, lumBW);
      const scaleW = 1 + params.whitePoint * 1.45 * hlMaskW;
      cr = softHighlightCompress(cr * scaleW, 0.84);
      cg = softHighlightCompress(cg * scaleW, 0.84);
      cb = softHighlightCompress(cb * scaleW, 0.84);
    } else if (params.whitePoint < -1e-4) {
      const hlMaskW = smoothstep(0.55, 1.0, lumBW);
      const scaleW = Math.max(0.75, 1 + params.whitePoint * 1.5 * hlMaskW);
      cr *= scaleW;
      cg *= scaleW;
      cb *= scaleW;
    }
  }

  // 4. Luminance-aware Shadows & Highlights (ratio-preserving)
  const lum = clamp01(0.2126 * cr + 0.7152 * cg + 0.0722 * cb);
  if (Math.abs(params.shadows) > 1e-4 && lum > 1e-4) {
    const shMask = (1 - lum) * (1 - lum);
    if (params.shadows > 0) {
      const lift = params.shadows * 0.22 * Math.sqrt(lum) * shMask;
      const sc = (lum + lift) / lum;
      cr *= sc;
      cg *= sc;
      cb *= sc;
      const maxC = Math.max(cr, cg, cb);
      if (maxC > 0.84) {
        const comp = softHighlightCompress(maxC, 0.84) / maxC;
        cr *= comp;
        cg *= comp;
        cb *= comp;
      }
    } else {
      const drop = Math.max(0.5, 1 + params.shadows * 0.30 * shMask);
      cr *= drop;
      cg *= drop;
      cb *= drop;
    }
  }

  if (Math.abs(params.highlights) > 1e-4) {
    const hlMask = lum * lum;
    if (params.highlights < 0) {
      const pull = Math.max(0.45, 1 + params.highlights * 0.34 * hlMask);
      cr *= pull;
      cg *= pull;
      cb *= pull;
    } else {
      const add = params.highlights * 0.14 * hlMask;
      cr = softHighlightCompress(cr + add, 0.84);
      cg = softHighlightCompress(cg + add, 0.84);
      cb = softHighlightCompress(cb + add, 0.84);
    }
  }

  // 5. Smooth Monotonic Midtone Contrast (skin-hue preserving)
  if (Math.abs(params.contrast) > 1e-4) {
    const cK = params.contrast * 1.35;
    const sR = clamp01(cr + cK * cr * (1 - cr) * (2 * cr - 1));
    const sG = clamp01(cg + cK * cg * (1 - cg) * (2 * cg - 1));
    const sB = clamp01(cb + cK * cb * (1 - cb) * (2 * cb - 1));
    const cLum = clamp01(0.2126 * cr + 0.7152 * cg + 0.0722 * cb);
    const tLum = clamp01(cLum + cK * cLum * (1 - cLum) * (2 * cLum - 1));
    const lRatio = cLum > 1e-4 ? tLum / cLum : 1;
    const lR = clamp01(cr * lRatio);
    const lG = clamp01(cg * lRatio);
    const lB = clamp01(cb * lRatio);
    const skinMid = computeSkinWeight(cr, cg, cb);
    const lumaBlend = 0.25 + skinMid * 0.50;
    cr = sR + (lR - sR) * lumaBlend;
    cg = sG + (lG - sG) * lumaBlend;
    cb = sB + (lB - sB) * lumaBlend;
  }

  // 6. Natural Foliage Green Correction (skin-masked)
  if (params.greenCorrection > 0.005) {
    const { h, s, v } = rgbToHsv(cr, cg, cb);
    if (s > 0.08 && v > 1e-4) {
      const skinPost = computeSkinWeight(cr, cg, cb);
      const greenBell = smoothstep(68, 96, h) * (1 - smoothstep(142, 168, h));
      const satGate = smoothstep(0.08, 0.24, s);
      const gWeight = greenBell * satGate * (1 - skinPost) * params.greenCorrection;
      if (gWeight > 0.002) {
        let hNew = h;
        if (h < 120) {
          hNew = h + (122 - h) * (0.28 * gWeight);
        } else if (h > 134) {
          hNew = h + (128 - h) * (0.24 * gWeight);
        }
        const sNew = clamp01(s * (1 - gWeight * 0.24 * smoothstep(0.22, 0.75, s)));
        const vNew = clamp01(v * (1 - gWeight * 0.06 * smoothstep(0.35, 0.90, v)));
        [cr, cg, cb] = hsvToRgb(hNew, sNew, vNew);
      }
    }
  }

  // 7. Skin-Protected Vibrance & Saturation
  if (Math.abs(params.vibrance) > 1e-4 || Math.abs(params.saturation) > 1e-4) {
    const skinPost = computeSkinWeight(cr, cg, cb);
    const gray = clamp01(0.2126 * cr + 0.7152 * cg + 0.0722 * cb);
    const maxC = Math.max(cr, cg, cb);
    const minC = Math.min(cr, cg, cb);
    const curSat = maxC > 1e-5 ? (maxC - minC) / maxC : 0;
    const darkGuard = smoothstep(0.03, 0.14, gray);
    const vibBoost = params.vibrance * (1 - curSat) * (1 - skinPost * 0.55) * darkGuard;
    const satScale = 1 + params.saturation * (1 - skinPost * 0.45);
    const effSat = Math.max(0, satScale * (1 + vibBoost));
    cr = clamp01(gray + (cr - gray) * effSat);
    cg = clamp01(gray + (cg - gray) * effSat);
    cb = clamp01(gray + (cb - gray) * effSat);
  }

  // 8. Linear-light Strength Blending between Original and Fully Corrected
  if (k >= 1 - 1e-4) {
    return [clamp01(cr), clamp01(cg), clamp01(cb)];
  }
  const linCorrR = srgbToLinear(cr);
  const linCorrG = srgbToLinear(cg);
  const linCorrB = srgbToLinear(cb);

  return [
    linearToSrgb(linOrigR + (linCorrR - linOrigR) * k),
    linearToSrgb(linOrigG + (linCorrG - linOrigG) * k),
    linearToSrgb(linOrigB + (linCorrB - linOrigB) * k)
  ];
}

/**
 * Convenience helper applying Adaptive Color Correction across an RGBA buffer (in-place).
 * Used primarily in unit tests and standalone buffer checks.
 */
export function applyAdaptiveColorToBuffer(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  params: AdaptiveColorRenderParams
): void {
  if (!hasActiveAdaptiveColor(params) || w <= 0 || h <= 0) return;
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const [r, g, b] = applyAdaptiveColorToPixel(
      data[idx] / 255,
      data[idx + 1] / 255,
      data[idx + 2] / 255,
      params
    );
    data[idx] = Math.round(clamp01(r) * 255);
    data[idx + 1] = Math.round(clamp01(g) * 255);
    data[idx + 2] = Math.round(clamp01(b) * 255);
  }
}

export { DEFAULT_ADAPTIVE_COLOR_CONFIG };
