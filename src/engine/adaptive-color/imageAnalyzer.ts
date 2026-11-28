import { computeSkinWeight } from '../analysis/portrait-mask';
import {
  clamp,
  clamp01,
  linearLuminance,
  linearToSrgb,
  rgbToHsv,
  smoothstep,
  srgbToLinear
} from './colorSpace';
import {
  accumulateHistogramSample,
  createHistogramAccumulator,
  finalizeHistogramAnalysis
} from './histogramAnalyzer';
import {
  AdaptiveColorAnalyzeOptions,
  AdaptiveColorConfig,
  DEFAULT_ADAPTIVE_COLOR_CONFIG,
  ImageAnalysisReport
} from './types';

function mergeConfig(partial?: Partial<AdaptiveColorConfig>): AdaptiveColorConfig {
  if (!partial) return DEFAULT_ADAPTIVE_COLOR_CONFIG;
  return {
    ...DEFAULT_ADAPTIVE_COLOR_CONFIG,
    ...partial,
    bounds: partial.bounds
      ? { ...DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds, ...partial.bounds }
      : DEFAULT_ADAPTIVE_COLOR_CONFIG.bounds
  };
}

export function createEmptyImageAnalysisReport(width = 0, height = 0): ImageAnalysisReport {
  const acc = createHistogramAccumulator();
  return {
    width,
    height,
    analyzedWidth: 0,
    analyzedHeight: 0,
    validPixelRatio: 0,
    hasTransparency: false,
    histogram: finalizeHistogramAnalysis(acc),
    exposure: {
      meanLuminance: 0,
      medianLuminance: 0,
      meanLuminanceLinear: 0,
      medianLuminanceLinear: 0,
      underexposedRatio: 0,
      deepShadowRatio: 0,
      overexposedRatio: 0,
      highlightClippingRatio: 0,
      shadowClippingRatio: 0,
      dynamicRange: 0,
      midtoneSpread: 0,
      isLowKeyCinematic: false
    },
    whiteBalance: {
      estimatedWarmCast: 0,
      estimatedTintCast: 0,
      neutralCandidateRatio: 0,
      lightingConsistency: 1,
      intentionalWarmthScore: 0,
      confidence: 0
    },
    color: {
      meanSaturation: 0,
      p90Saturation: 0,
      vibrancePotential: 0,
      oversaturatedRatio: 0,
      isMonochrome: true,
      greenFoliageRatio: 0,
      neonGreenRatio: 0,
      blueCyanRatio: 0,
      orangeRedRatio: 0,
      yellowRatio: 0,
      colorfulness: 0
    },
    skin: {
      coverageRatio: 0,
      meanLuminance: 0,
      meanSaturation: 0,
      warmBias: 0,
      spatialCoherence: 0,
      hasFaceDetection: false,
      confidence: 0
    }
  };
}

/**
 * Deterministic reduced-resolution image analyzer operating directly on RGBA pixel buffers.
 * Accounts for sRGB -> Linear RGB conversion, transparency, histograms, exposure,
 * conservative white balance, color distribution, foliage, and probabilistic skin detection.
 */
export function analyzeImageRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: AdaptiveColorAnalyzeOptions
): ImageAnalysisReport {
  if (!rgba || width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return createEmptyImageAnalysisReport(Math.max(0, width | 0), Math.max(0, height | 0));
  }

  const config = mergeConfig(options?.config);
  const maxDim = Math.max(16, config.analysisMaxDim);
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const aw = Math.max(1, Math.round(width * scale));
  const ah = Math.max(1, Math.round(height * scale));
  const totalGrid = aw * ah;

  const gridR = new Float32Array(totalGrid);
  const gridG = new Float32Array(totalGrid);
  const gridB = new Float32Array(totalGrid);
  const gridA = new Float32Array(totalGrid);
  const gridSkin = new Float32Array(totalGrid);
  const gridLumPerc = new Float32Array(totalGrid);

  const histAcc = createHistogramAccumulator();
  const satBins = new Float32Array(64);

  let validWeightSum = 0;
  let transparentCount = 0;
  let sumLumPerc = 0;
  let sumLumLin = 0;
  let underexposedWeight = 0;
  let deepShadowWeight = 0;
  let overexposedWeight = 0;
  let highlightClipWeight = 0;
  let shadowClipWeight = 0;

  let sumSat = 0;
  let vibrancePotWeight = 0;
  let oversatWeight = 0;
  let greenFoliageWeight = 0;
  let neonGreenWeight = 0;
  let blueCyanWeight = 0;
  let orangeRedWeight = 0;
  let yellowWeight = 0;

  // Hasler-Süsstrunk colorfulness accumulators (opponent rg, yb)
  let sumRg = 0;
  let sumRg2 = 0;
  let sumYb = 0;
  let sumYb2 = 0;

  // White balance accumulators (neutral-candidate weighted + split by luminance zone for mixed lighting)
  let wbR = 0;
  let wbG = 0;
  let wbB = 0;
  let wbW = 0;
  let wbLowR = 0;
  let wbLowG = 0;
  let wbLowB = 0;
  let wbLowW = 0;
  let wbHiR = 0;
  let wbHiG = 0;
  let wbHiB = 0;
  let wbHiW = 0;
  let globalLinR = 0;
  let globalLinG = 0;
  let globalLinB = 0;
  let neutralCandSum = 0;

  // Deterministic area-box downsample from source RGBA onto analysis grid
  for (let ay = 0; ay < ah; ay++) {
    const y0 = Math.floor((ay * height) / ah);
    const y1 = Math.max(y0 + 1, Math.floor(((ay + 1) * height) / ah));
    const stepY = Math.max(1, Math.floor((y1 - y0) / 3));

    for (let ax = 0; ax < aw; ax++) {
      const x0 = Math.floor((ax * width) / aw);
      const x1 = Math.max(x0 + 1, Math.floor(((ax + 1) * width) / aw));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 3));

      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sa = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += stepY) {
        const rowOff = sy * width;
        for (let sx = x0; sx < x1; sx += stepX) {
          const p = (rowOff + sx) * 4;
          sr += rgba[p];
          sg += rgba[p + 1];
          sb += rgba[p + 2];
          sa += rgba[p + 3];
          n++;
        }
      }

      const inv = 1 / (255 * Math.max(1, n));
      const r = clamp01(sr * inv);
      const g = clamp01(sg * inv);
      const b = clamp01(sb * inv);
      const a = clamp01(sa * inv);

      const idx = ay * aw + ax;
      gridR[idx] = r;
      gridG[idx] = g;
      gridB[idx] = b;
      gridA[idx] = a;

      if (a < 0.99) transparentCount++;
      if (a <= 0.02) continue;

      const w = a;
      validWeightSum += w;

      const rLin = srgbToLinear(r);
      const gLin = srgbToLinear(g);
      const bLin = srgbToLinear(b);
      const yLin = linearLuminance(rLin, gLin, bLin);
      const yPerc = linearToSrgb(yLin);

      gridLumPerc[idx] = yPerc;
      sumLumPerc += yPerc * w;
      sumLumLin += yLin * w;

      accumulateHistogramSample(histAcc, r, g, b, yPerc, w);

      if (yPerc < 0.18) underexposedWeight += w;
      if (yPerc < 0.08) deepShadowWeight += w;
      if (yPerc > 0.85) overexposedWeight += w;
      if (Math.max(r, g, b) >= 0.98 || yPerc >= 0.96) highlightClipWeight += w;
      if (Math.max(r, g, b) <= 0.02 || yPerc <= 0.03) shadowClipWeight += w;

      const { h, s } = rgbToHsv(r, g, b);
      sumSat += s * w;
      const sBin = Math.min(63, Math.max(0, Math.floor(s * 64)));
      satBins[sBin] += w;

      if (s > 0.06 && s < 0.36 && yPerc > 0.08 && yPerc < 0.92) {
        vibrancePotWeight += w;
      }
      if (s > 0.76 && yPerc > 0.12 && yPerc < 0.94) {
        oversatWeight += w;
      }

      // Opponent colorfulness
      const rg = r - g;
      const yb = 0.5 * (r + g) - b;
      sumRg += rg * w;
      sumRg2 += rg * rg * w;
      sumYb += yb * w;
      sumYb2 += yb * yb * w;

      const skinW = computeSkinWeight(r, g, b);
      gridSkin[idx] = skinW;

      // Color hue buckets (gated by chroma & mid-range luminance to exclude neutral noise)
      const chromaGate = smoothstep(0.08, 0.24, s) * smoothstep(0.06, 0.18, yPerc) * (1 - smoothstep(0.90, 0.98, yPerc));
      if (chromaGate > 0.01) {
        if (h >= 72 && h <= 165) {
          greenFoliageWeight += chromaGate * (1 - skinW * 0.9) * w;
          const gExcess = g - Math.max(r, b);
          if (s > 0.50 && gExcess > 0.08) {
            neonGreenWeight += chromaGate * smoothstep(0.50, 0.78, s) * smoothstep(0.06, 0.22, gExcess) * w;
          }
        } else if (h > 165 && h <= 255) {
          blueCyanWeight += chromaGate * w;
        } else if (h >= 45 && h < 72) {
          yellowWeight += chromaGate * (1 - skinW * 0.5) * w;
        } else if (h < 45 || h >= 335) {
          orangeRedWeight += chromaGate * (1 - skinW * 0.7) * w;
        }
      }

      // White balance neutral candidate accumulation
      globalLinR += rLin * w;
      globalLinG += gLin * w;
      globalLinB += bLin * w;

      const lumaValid = smoothstep(0.06, 0.18, yPerc) * (1 - smoothstep(0.84, 0.96, yPerc));
      const maxLin = Math.max(rLin, gLin, bLin);
      const minLin = Math.min(rLin, gLin, bLin);
      const linChroma = maxLin > 1e-4 ? (maxLin - minLin) / maxLin : 0;
      const foliageExclusion = h >= 75 && h <= 160 && s > 0.22 ? 0.25 : 1.0;
      const neutralW =
        Math.exp(-(linChroma * linChroma) / (2 * 0.22 * 0.22)) *
        lumaValid *
        (1 - skinW * 0.85) *
        foliageExclusion *
        w;

      if (neutralW > 0.01) {
        wbR += rLin * neutralW;
        wbG += gLin * neutralW;
        wbB += bLin * neutralW;
        wbW += neutralW;
        neutralCandSum += neutralW;

        if (yPerc < 0.44) {
          wbLowR += rLin * neutralW;
          wbLowG += gLin * neutralW;
          wbLowB += bLin * neutralW;
          wbLowW += neutralW;
        } else {
          wbHiR += rLin * neutralW;
          wbHiG += gLin * neutralW;
          wbHiB += bLin * neutralW;
          wbHiW += neutralW;
        }
      }
    }
  }

  if (validWeightSum <= 1e-6) {
    return createEmptyImageAnalysisReport(width, height);
  }

  const histogram = finalizeHistogramAnalysis(histAcc);
  const p = histogram.percentiles;

  const meanLuminance = clamp01(sumLumPerc / validWeightSum);
  const medianLuminance = p.p50;
  const meanLuminanceLinear = clamp01(sumLumLin / validWeightSum);
  const medianLuminanceLinear = srgbToLinear(medianLuminance);
  const underexposedRatio = clamp01(underexposedWeight / validWeightSum);
  const deepShadowRatio = clamp01(deepShadowWeight / validWeightSum);
  const overexposedRatio = clamp01(overexposedWeight / validWeightSum);
  const highlightClippingRatio = clamp01(highlightClipWeight / validWeightSum);
  const shadowClippingRatio = clamp01(shadowClipWeight / validWeightSum);
  const dynamicRange = Math.max(0, p.p95 - p.p05);
  const midtoneSpread = Math.max(0, p.p75 - p.p25);

  // Distinguish intentional low-key / night cinematic scenes from flat underexposed frames:
  // Low-key cinematic has deep shadows (p25 < 0.15) while retaining bright practical highlights/speculars (p98 > 0.56).
  const isLowKeyCinematic =
    p.p25 < 0.15 &&
    (deepShadowRatio > 0.25 || underexposedRatio > 0.70) &&
    (p.p98 > 0.56 || highlightClippingRatio > 0.005 || (p.p95 > 0.44 && dynamicRange > 0.48));

  // Saturation percentiles & colorfulness
  const meanSaturation = clamp01(sumSat / validWeightSum);
  let p90Saturation = 0;
  {
    let cum = 0;
    const target = validWeightSum * 0.9;
    for (let i = 0; i < 64; i++) {
      cum += satBins[i];
      if (cum >= target) {
        p90Saturation = (i + 0.5) / 64;
        break;
      }
    }
  }

  const meanRg = sumRg / validWeightSum;
  const meanYb = sumYb / validWeightSum;
  const varRg = Math.max(0, sumRg2 / validWeightSum - meanRg * meanRg);
  const varYb = Math.max(0, sumYb2 / validWeightSum - meanYb * meanYb);
  const colorfulness = Math.sqrt(varRg + varYb) + 0.3 * Math.hypot(meanRg, meanYb);
  const isMonochrome = meanSaturation < 0.045 && p90Saturation < 0.085 && colorfulness < 0.045;

  // White balance estimation & mixed-lighting consistency
  let estimatedWarmCast = 0;
  let estimatedTintCast = 0;
  let lightingConsistency = 1;
  let intentionalWarmthScore = 0;
  let wbConfidence = 0;
  const neutralCandidateRatio = clamp01(neutralCandSum / validWeightSum);

  if (!isMonochrome) {
    const useNeutral = wbW >= validWeightSum * 0.025;
    const refR = useNeutral ? wbR / wbW : globalLinR / validWeightSum;
    const refG = useNeutral ? wbG / wbW : globalLinG / validWeightSum;
    const refB = useNeutral ? wbB / wbW : globalLinB / validWeightSum;

    const safeR = Math.max(1e-4, refR);
    const safeG = Math.max(1e-4, refG);
    const safeB = Math.max(1e-4, refB);

    // Positive => R > B (warm cast); Negative => B > R (cool cast)
    estimatedWarmCast = clamp(Math.log2(safeR / safeB) * 0.55, -1.5, 1.5);
    // Positive => G < sqrt(R*B) (magenta cast); Negative => G > sqrt(R*B) (green cast)
    estimatedTintCast = clamp(Math.log2(Math.sqrt(safeR * safeB) / safeG) * 0.75, -1.5, 1.5);

    if (wbLowW > validWeightSum * 0.01 && wbHiW > validWeightSum * 0.01) {
      const lowTemp = Math.log2(Math.max(1e-4, wbLowR / wbLowW) / Math.max(1e-4, wbLowB / wbLowW)) * 0.55;
      const hiTemp = Math.log2(Math.max(1e-4, wbHiR / wbHiW) / Math.max(1e-4, wbHiB / wbHiW)) * 0.55;
      const diff = Math.abs(lowTemp - hiTemp);
      lightingConsistency = clamp01(1 - smoothstep(0.18, 0.85, diff));
    } else if (!useNeutral) {
      lightingConsistency = 0.45;
    }

    // Intentional warm scene detection: low neutral count + warm cast + low green cast
    if (estimatedWarmCast > 0.12) {
      const lowNeutralFactor = 1 - smoothstep(0.06, 0.28, neutralCandidateRatio);
      const warmMagnitude = smoothstep(0.14, 0.65, estimatedWarmCast);
      const cleanWarm = 1 - smoothstep(0.08, 0.28, Math.max(0, -estimatedTintCast));
      intentionalWarmthScore = clamp01(lowNeutralFactor * warmMagnitude * cleanWarm);
    }

    const neutralScore = smoothstep(0.02, config.minNeutralCandidateRatio * 2.2, neutralCandidateRatio);
    const validLumaScore = 1 - smoothstep(0.45, 0.88, shadowClippingRatio + highlightClippingRatio);
    wbConfidence = clamp01(neutralScore * 0.55 + lightingConsistency * 0.30 + validLumaScore * 0.15);
  }

  // Skin-tone spatial coherence & summary statistics
  let skinWeightSum = 0;
  let skinConfidentSum = 0;
  let skinLumNum = 0;
  let skinSatNum = 0;
  let skinWarmNum = 0;
  let coherentNeighborsSum = 0;

  for (let ay = 0; ay < ah; ay++) {
    for (let ax = 0; ax < aw; ax++) {
      const idx = ay * aw + ax;
      if (gridA[idx] <= 0.02) continue;
      let sw = gridSkin[idx];

      // Opportunistically boost confidence inside detected face ROI if Phase 3 AI analysis was passed
      const ai = options?.aiAnalysis;
      if (ai && ai.faces.length > 0) {
        const u = aw > 1 ? ax / (aw - 1) : 0.5;
        const v = ah > 1 ? ay / (ah - 1) : 0.5;
        for (const f of ai.faces) {
          if (
            u >= f.bbox.x &&
            u <= f.bbox.x + f.bbox.width &&
            v >= f.bbox.y &&
            v <= f.bbox.y + f.bbox.height
          ) {
            sw = Math.min(1, sw * 1.15);
            break;
          }
        }
      }

      if (sw > 0.25) {
        let nbSum = 0;
        let nbCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = ay + dy;
          if (ny < 0 || ny >= ah) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = ax + dx;
            if (nx < 0 || nx >= aw) continue;
            nbSum += gridSkin[ny * aw + nx];
            nbCount++;
          }
        }
        const nbAvg = nbCount > 0 ? nbSum / nbCount : 0;
        coherentNeighborsSum += sw * smoothstep(0.12, 0.45, nbAvg);

        const r = gridR[idx];
        const g = gridG[idx];
        const b = gridB[idx];
        const { s } = rgbToHsv(r, g, b);
        skinWeightSum += sw;
        skinConfidentSum += gridA[idx];
        skinLumNum += gridLumPerc[idx] * sw;
        skinSatNum += s * sw;
        // Skin warm bias: high (r - b) relative to typical balanced skin (~0.18..0.28)
        skinWarmNum += (r - b - 0.22) * sw;
      }
    }
  }

  const coverageRatio = clamp01(skinConfidentSum / validWeightSum);
  const spatialCoherence = skinWeightSum > 1e-4 ? clamp01(coherentNeighborsSum / skinWeightSum) : 0;
  const hasFaceDetection = Boolean(options?.aiAnalysis && options.aiAnalysis.faces.length > 0);
  const skinConfidence = isMonochrome
    ? hasFaceDetection
      ? 0.4
      : 0
    : clamp01(
        smoothstep(0.005, config.minSkinCoverageRatio * 3.5, coverageRatio) *
          (0.35 + 0.65 * spatialCoherence) +
          (hasFaceDetection ? 0.25 : 0)
      );

  return {
    width,
    height,
    analyzedWidth: aw,
    analyzedHeight: ah,
    validPixelRatio: clamp01(validWeightSum / totalGrid),
    hasTransparency: transparentCount > 0,
    histogram,
    exposure: {
      meanLuminance,
      medianLuminance,
      meanLuminanceLinear,
      medianLuminanceLinear,
      underexposedRatio,
      deepShadowRatio,
      overexposedRatio,
      highlightClippingRatio,
      shadowClippingRatio,
      dynamicRange,
      midtoneSpread,
      isLowKeyCinematic
    },
    whiteBalance: {
      estimatedWarmCast,
      estimatedTintCast,
      neutralCandidateRatio,
      lightingConsistency,
      intentionalWarmthScore,
      confidence: wbConfidence
    },
    color: {
      meanSaturation,
      p90Saturation,
      vibrancePotential: clamp01(vibrancePotWeight / validWeightSum),
      oversaturatedRatio: clamp01(oversatWeight / validWeightSum),
      isMonochrome,
      greenFoliageRatio: clamp01(greenFoliageWeight / validWeightSum),
      neonGreenRatio: clamp01(neonGreenWeight / validWeightSum),
      blueCyanRatio: clamp01(blueCyanWeight / validWeightSum),
      orangeRedRatio: clamp01(orangeRedWeight / validWeightSum),
      yellowRatio: clamp01(yellowWeight / validWeightSum),
      colorfulness
    },
    skin: {
      coverageRatio,
      meanLuminance: skinWeightSum > 1e-4 ? clamp01(skinLumNum / skinWeightSum) : 0,
      meanSaturation: skinWeightSum > 1e-4 ? clamp01(skinSatNum / skinWeightSum) : 0,
      warmBias: skinWeightSum > 1e-4 ? clamp(skinWarmNum / skinWeightSum, -0.5, 0.5) : 0,
      spatialCoherence,
      hasFaceDetection,
      confidence: skinConfidence
    }
  };
}
