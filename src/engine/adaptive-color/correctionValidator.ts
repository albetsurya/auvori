import { clamp, finiteOr, smoothstep } from './colorSpace';
import {
  AdaptiveColorConfig,
  AdaptiveCorrectionParameters,
  DEFAULT_ADAPTIVE_COLOR_CONFIG,
  ImageAnalysisReport
} from './types';

export interface ValidatedCorrectionOutput {
  parameters: AdaptiveCorrectionParameters;
  warnings: string[];
}

function clampBound(val: number, range: [number, number]): { value: number; clamped: boolean } {
  const safe = finiteOr(val, 0);
  const clampedVal = clamp(safe, range[0], range[1]);
  return { value: clampedVal, clamped: Math.abs(clampedVal - safe) > 1e-6 };
}

/**
 * Validates and clamps solved correction parameters against configurable safety limits,
 * cross-parameter clipping budgets, skin-tone safety rules, and monochrome locks.
 */
export function validateAdaptiveCorrections(
  raw: AdaptiveCorrectionParameters,
  analysis: ImageAnalysisReport,
  initialNotes: string[] = [],
  configPartial?: Partial<AdaptiveColorConfig>
): ValidatedCorrectionOutput {
  const bounds = configPartial?.bounds
    ? { ...DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds, ...configPartial.bounds }
    : DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds;

  const warnings = [...initialNotes];
  const addWarning = (w: string) => {
    if (!warnings.includes(w)) warnings.push(w);
  };

  // 1. Finite & per-parameter configurable bounds clamping
  const expB = clampBound(raw.exposure, bounds.exposure);
  const hlB = clampBound(raw.highlights, bounds.highlights);
  const shB = clampBound(raw.shadows, bounds.shadows);
  const ctB = clampBound(raw.contrast, bounds.contrast);
  const tempB = clampBound(raw.temperature, bounds.temperature);
  const tintB = clampBound(raw.tint, bounds.tint);
  const vibB = clampBound(raw.vibrance, bounds.vibrance);
  const satB = clampBound(raw.saturation, bounds.saturation);
  const grnB = clampBound(raw.greenCorrection, bounds.greenCorrection);
  const bpB = clampBound(raw.blackPoint, bounds.blackPoint);
  const wpB = clampBound(raw.whitePoint, bounds.whitePoint);

  if (
    expB.clamped ||
    hlB.clamped ||
    shB.clamped ||
    ctB.clamped ||
    tempB.clamped ||
    tintB.clamped ||
    vibB.clamped ||
    satB.clamped ||
    grnB.clamped ||
    bpB.clamped ||
    wpB.clamped
  ) {
    addWarning('parameter-bounds-clamped');
  }

  let exposure = expB.value;
  let highlights = hlB.value;
  let shadows = shB.value;
  let contrast = ctB.value;
  let temperature = tempB.value;
  let tint = tintB.value;
  let vibrance = vibB.value;
  let saturation = satB.value;
  let greenCorrection = grnB.value;
  let blackPoint = bpB.value;
  let whitePoint = wpB.value;

  const { exposure: expStats, color, skin } = analysis;
  const p = analysis.histogram.percentiles;

  // 2. Monochrome safety lock
  if (color.isMonochrome) {
    temperature = 0;
    tint = 0;
    vibrance = 0;
    saturation = 0;
    greenCorrection = 0;
  }

  // 3. Joint highlight clipping guard
  if ((exposure > 0.08 || whitePoint > 0.02) && (expStats.highlightClippingRatio > 0.025 || p.p95 > 0.88)) {
    const clipGate = 1 - 0.65 * smoothstep(0.025, 0.14, expStats.highlightClippingRatio);
    exposure *= clipGate;
    if (whitePoint > 0) whitePoint *= clipGate * 0.5;
    highlights = Math.min(highlights, -0.18 * smoothstep(0.02, 0.12, expStats.highlightClippingRatio));
    addWarning('highlight-clip-protection');
  }

  // 4. Joint shadow / black-crush guard (prevent gray-washed blacks AND crushed blacks)
  if (contrast > 0.22 && blackPoint < -0.03) {
    blackPoint *= 0.65;
  }
  if (shadows > 0.45 && contrast < 0 && blackPoint > 0.01) {
    // Avoid flat HDR look: keep blacks anchored if shadows are heavily lifted
    blackPoint = 0;
    addWarning('anti-hdr-black-anchor');
  }

  // 5. Low-light noise floor guard
  if (expStats.deepShadowRatio > 0.42 && exposure > 0.38) {
    exposure = Math.min(exposure, 0.38);
    addWarning('low-light-noise-guard');
  }

  // 6. Skin-tone safety envelope
  if (skin.confidence > 0.35) {
    temperature = clamp(temperature, -0.26, 0.24);
    tint = clamp(tint, -0.16, 0.16);
    saturation = clamp(saturation, bounds.saturation[0], 0.14);
    if (skin.meanLuminance > 0.72 && exposure > 0.10) {
      exposure = 0.10;
      addWarning('skin-highlight-protected');
    }
  }

  return {
    parameters: {
      exposure,
      highlights,
      shadows,
      contrast,
      temperature,
      tint,
      vibrance,
      saturation,
      greenCorrection,
      blackPoint,
      whitePoint
    },
    warnings
  };
}
