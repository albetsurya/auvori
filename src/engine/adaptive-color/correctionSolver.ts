import { clamp, clamp01, smoothstep } from './colorSpace';
import {
  AdaptiveColorConfig,
  AdaptiveCorrectionConfidence,
  AdaptiveCorrectionParameters,
  DEFAULT_ADAPTIVE_COLOR_CONFIG,
  ImageAnalysisReport,
  NEUTRAL_ADAPTIVE_PARAMETERS
} from './types';

export interface SolverRawOutput {
  parameters: AdaptiveCorrectionParameters;
  confidence: AdaptiveCorrectionConfidence;
  notes: string[];
}

/**
 * Dynamically derives normalized Adaptive Color Correction parameters from image statistics.
 * Never uses a static preset recipe; responds smoothly to exposure, tonal range, color cast,
 * saturation balance, foliage greens, low-key mood, and skin-tone protection.
 */
export function solveAdaptiveCorrections(
  analysis: ImageAnalysisReport,
  configPartial?: Partial<AdaptiveColorConfig>
): SolverRawOutput {
  if (analysis.validPixelRatio <= 1e-4 || analysis.analyzedWidth <= 0 || analysis.analyzedHeight <= 0) {
    return {
      parameters: { ...NEUTRAL_ADAPTIVE_PARAMETERS },
      confidence: { overall: 0, exposure: 0, whiteBalance: 0, skin: 0, foliage: 0 },
      notes: ['empty-or-transparent-image']
    };
  }

  const config: AdaptiveColorConfig = configPartial
    ? {
        ...DEFAULT_ADAPTIVE_COLOR_CONFIG,
        ...configPartial,
        bounds: configPartial.bounds
          ? { ...DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds, ...configPartial.bounds }
          : DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds
      }
    : DEFAULT_ADAPTIVE_COLOR_CONFIG;

  const { exposure: exp, histogram, whiteBalance: wb, color, skin } = analysis;
  const p = histogram.percentiles;
  const notes: string[] = [];

  // ── 1. Exposure Correction ─────────────────────────────────────────────────
  const targetMid = config.targetMidtoneLuminance;
  const midDiff = targetMid - exp.medianLuminance;
  const meanDiff = 0.47 - exp.meanLuminance;
  const combinedLumaDeficit = midDiff * 0.68 + meanDiff * 0.32;

  let exposureEV = 0;
  if (combinedLumaDeficit > 0.04) {
    // Underexposed: scale smoothly, restrained by highlight headroom, noise risk, and low-key mood
    const strength = smoothstep(0.04, 0.36, combinedLumaDeficit);
    const hlHeadroom = 1 - 0.72 * smoothstep(0.015, 0.12, exp.highlightClippingRatio) - 0.45 * smoothstep(0.78, 0.95, p.p95);
    const noiseDamp = 1 - 0.42 * smoothstep(0.02, 0.12, exp.deepShadowRatio - 0.35);
    const lowKeyDamp = exp.isLowKeyCinematic ? 0.22 : 1.0;

    if (exp.isLowKeyCinematic) {
      notes.push('low-key-cinematic-preserved');
    }

    exposureEV = 0.72 * strength * Math.max(0.18, hlHeadroom) * Math.max(0.55, noiseDamp) * lowKeyDamp;

    // Backlit portrait: if face/skin is dark while overall background is bright, prefer shadow fill over global EV
    if (skin.confidence > 0.35 && skin.meanLuminance < 0.36 && exp.meanLuminance > 0.44) {
      exposureEV *= 0.45;
      notes.push('backlit-skin-shadow-priority');
    }
  } else if (combinedLumaDeficit < -0.05 || exp.highlightClippingRatio > 0.06) {
    // Overexposed: carefully pull back exposure without darkening well-exposed midtones too hard
    const overSeverity = Math.max(
      smoothstep(0.05, 0.34, -combinedLumaDeficit),
      smoothstep(0.05, 0.28, exp.overexposedRatio) * 0.75,
      smoothstep(0.04, 0.22, exp.highlightClippingRatio) * 0.65
    );
    exposureEV = -0.68 * overSeverity;
  }

  // ── 2. Highlights & Shadows ────────────────────────────────────────────────
  let highlights = 0;
  const hlSeverity = Math.max(
    smoothstep(0.82, 0.97, p.p95) * 0.75,
    smoothstep(0.015, 0.18, exp.highlightClippingRatio),
    smoothstep(0.10, 0.42, exp.overexposedRatio) * 0.85
  );
  if (hlSeverity > 0.04) {
    highlights = -0.78 * hlSeverity;
  } else if (p.p95 < 0.66 && exp.meanLuminance < 0.42 && !exp.isLowKeyCinematic) {
    highlights = 0.16 * smoothstep(0.66, 0.38, p.p95);
  }

  let shadows = 0;
  const darkNeed = Math.max(
    smoothstep(0.18, 0.03, p.p15),
    smoothstep(0.12, 0.48, exp.underexposedRatio) * 0.85
  );
  if (darkNeed > 0.04) {
    // Anti-HDR guard: keep shadow lift measured when image is low-key or already flat
    const flatGuard = smoothstep(0.28, 0.64, exp.dynamicRange);
    const lowKeyGuard = exp.isLowKeyCinematic ? 0.32 : 1.0;
    shadows = 0.68 * darkNeed * (0.45 + 0.55 * flatGuard) * lowKeyGuard;
  } else if (p.p10 > 0.22 && exp.midtoneSpread < 0.24) {
    // Slightly hazy lifted shadows can take a very gentle shadow anchor
    shadows = -0.16 * smoothstep(0.22, 0.36, p.p10);
  }

  // Backlit portrait skin shadow lift
  if (skin.confidence > 0.35 && skin.meanLuminance < 0.38 && exp.meanLuminance > 0.40) {
    const skinDeficit = smoothstep(0.40, 0.18, skin.meanLuminance);
    shadows = Math.max(shadows, 0.48 * skinDeficit);
  }

  // ── 3. Black Point & White Point ───────────────────────────────────────────
  let blackPoint = 0;
  if (p.p02 > 0.055 && exp.shadowClippingRatio < 0.05) {
    // Milky / lifted black floor -> deepen black point cleanly
    blackPoint = -0.065 * smoothstep(0.055, 0.16, p.p02);
  } else if (exp.shadowClippingRatio > 0.16 && !exp.isLowKeyCinematic && exp.dynamicRange > 0.72) {
    // Harshly crushed blacks -> subtle non-gray toe recovery
    blackPoint = 0.025 * smoothstep(0.16, 0.38, exp.shadowClippingRatio);
  }

  let whitePoint = 0;
  if (p.p98 < 0.88 && exp.highlightClippingRatio < 0.01 && exposureEV >= -0.05) {
    // Dull whites with ample highlight headroom -> extend clean white point
    const headroom = smoothstep(0.88, 0.62, p.p98);
    whitePoint = 0.065 * headroom * (exp.isLowKeyCinematic ? 0.45 : 1.0);
  } else if (exp.highlightClippingRatio > 0.06) {
    whitePoint = -0.04 * smoothstep(0.06, 0.22, exp.highlightClippingRatio);
  }

  // ── 4. Contrast Correction ─────────────────────────────────────────────────
  let contrast = 0;
  if (exp.dynamicRange < 0.56 || exp.midtoneSpread < 0.24) {
    // Low-contrast / hazy scene -> restore pleasant tonal depth
    const flatScore = Math.max(
      smoothstep(0.56, 0.24, exp.dynamicRange),
      smoothstep(0.24, 0.10, exp.midtoneSpread) * 0.85
    );
    contrast = 0.34 * flatScore;
  } else if (exp.dynamicRange > 0.78 && exp.shadowClippingRatio + exp.highlightClippingRatio > 0.08) {
    // High-contrast scene -> avoid crushing blacks or clipping whites
    const harshScore = smoothstep(0.78, 0.94, exp.dynamicRange);
    contrast = -0.14 * harshScore;
  } else {
    // Balanced scene -> gentle midtone micro-polish
    contrast = 0.06 * (1 - smoothstep(0.60, 0.82, exp.dynamicRange));
  }

  // ── 5. White Balance Correction ────────────────────────────────────────────
  let temperature = 0;
  let tint = 0;

  if (!color.isMonochrome && wb.confidence > 0.05) {
    // Positive warmCast means image is too warm -> negative temperature cools it
    // Negative warmCast means image is too cool -> positive temperature warms it
    let rawTempCorr = -wb.estimatedWarmCast * 0.42;
    let rawTintCorr = -wb.estimatedTintCast * 0.38;

    // Preserve intentional warm lighting (sunset, candle, golden hour)
    if (rawTempCorr < 0 && wb.intentionalWarmthScore > 0.15) {
      rawTempCorr *= 1 - 0.68 * wb.intentionalWarmthScore;
      notes.push('intentional-warmth-preserved');
    }

    // Protect portrait skin from shifting yellow or cool-chalky
    if (skin.confidence > 0.35) {
      if (rawTempCorr > 0 && skin.warmBias > 0.08) {
        rawTempCorr *= 1 - 0.55 * smoothstep(0.08, 0.26, skin.warmBias);
      }
      // Also restrain cooling on skin if skin isn't overly warm
      if (rawTempCorr < 0 && skin.warmBias < 0.04) {
        rawTempCorr *= 0.55;
      }
    }

    const wbScale = 0.25 + 0.75 * wb.confidence;
    temperature = rawTempCorr * wbScale;
    tint = rawTintCorr * wbScale;

    if (wb.confidence < 0.40) {
      notes.push('low-wb-confidence-damped');
    }
  }

  // ── 6. Vibrance & Saturation ───────────────────────────────────────────────
  let vibrance = 0;
  let saturation = 0;

  if (!color.isMonochrome) {
    if (color.oversaturatedRatio > 0.12 || color.p90Saturation > 0.70) {
      // Oversaturated photo -> tame global saturation gracefully
      const overSat = Math.max(
        smoothstep(0.12, 0.35, color.oversaturatedRatio),
        smoothstep(0.70, 0.90, color.p90Saturation) * 0.8
      );
      saturation = -0.26 * overSat;
      vibrance = -0.06 * overSat;
    } else if (color.meanSaturation < 0.24) {
      // Muted / low-saturation photo -> prioritize vibrance so muted colors bloom without clipping skin
      const mutedNeed = smoothstep(0.24, 0.07, color.meanSaturation);
      vibrance = 0.44 * mutedNeed * (0.45 + 0.55 * color.vibrancePotential);
      saturation = 0.10 * mutedNeed;
    } else {
      // Balanced saturation -> subtle vibrance polish
      vibrance = 0.12 * color.vibrancePotential * (1 - smoothstep(0.35, 0.60, color.meanSaturation));
    }

    // Skin orange saturation guard
    if (skin.confidence > 0.35 && skin.meanSaturation > 0.42) {
      const skinOver = smoothstep(0.42, 0.65, skin.meanSaturation);
      saturation = Math.min(saturation, -0.06 * skinOver);
      vibrance *= 1 - 0.5 * skinOver;
    }
  } else {
    notes.push('monochrome-chroma-locked');
  }

  // ── 7. Green Foliage Correction ────────────────────────────────────────────
  let greenCorrection = 0;
  const foliageConfidence = color.isMonochrome
    ? 0
    : clamp01(smoothstep(0.04, 0.22, color.greenFoliageRatio));

  if (!color.isMonochrome && foliageConfidence > 0.08) {
    const neonSignal = smoothstep(0.01, 0.10, color.neonGreenRatio);
    const broadGreen = smoothstep(0.06, 0.28, color.greenFoliageRatio);
    greenCorrection = clamp01(broadGreen * 0.35 + neonSignal * 0.52);
  }

  // ── 8. Confidence Aggregation ──────────────────────────────────────────────
  const exposureConfidence = clamp01(
    (1 - 0.4 * smoothstep(0.25, 0.70, exp.highlightClippingRatio + exp.shadowClippingRatio)) *
      smoothstep(0.05, 0.35, analysis.validPixelRatio)
  );
  const overallConfidence = clamp01(
    exposureConfidence * 0.45 +
      (color.isMonochrome ? 0.35 : wb.confidence * 0.35) +
      Math.max(skin.confidence, foliageConfidence, 0.4) * 0.20
  );

  return {
    parameters: {
      exposure: exposureEV,
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
    confidence: {
      overall: overallConfidence,
      exposure: exposureConfidence,
      whiteBalance: color.isMonochrome ? 0 : wb.confidence,
      skin: skin.confidence,
      foliage: foliageConfidence
    },
    notes
  };
}
