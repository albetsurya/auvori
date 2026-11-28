import type { AnalysisResult } from '../analysis/analysis-types';

export const ADAPTIVE_COLOR_VERSION = 'acc-v1';

export interface AdaptiveColorParameterBounds {
  exposure: [number, number];
  highlights: [number, number];
  shadows: [number, number];
  contrast: [number, number];
  temperature: [number, number];
  tint: [number, number];
  vibrance: [number, number];
  saturation: [number, number];
  greenCorrection: [number, number];
  blackPoint: [number, number];
  whitePoint: [number, number];
}

export const ADAPTIVE_COLOR_BOUNDS: Readonly<AdaptiveColorParameterBounds> = {
  exposure: [-0.85, 0.85],
  highlights: [-0.85, 0.45],
  shadows: [-0.35, 0.80],
  contrast: [-0.25, 0.42],
  temperature: [-0.42, 0.42],
  tint: [-0.35, 0.35],
  vibrance: [-0.25, 0.55],
  saturation: [-0.35, 0.25],
  greenCorrection: [0.0, 0.90],
  blackPoint: [-0.08, 0.06],
  whitePoint: [-0.08, 0.08]
};

export interface AdaptiveColorConfig {
  /** Maximum side resolution for reduced-resolution image analysis (pixels). */
  analysisMaxDim: number;
  /** Target perceptual midtone anchor for balanced natural exposure. */
  targetMidtoneLuminance: number;
  /** Target linear luminance anchor for neutral 18%-gray exposure reference. */
  targetLinearAnchor: number;
  /** Minimum skin coverage ratio to consider skin present without face ROI. */
  minSkinCoverageRatio: number;
  /** Minimum WB neutral candidate ratio for full WB confidence. */
  minNeutralCandidateRatio: number;
  /** Parameter bounds used by validator. */
  bounds: AdaptiveColorParameterBounds;
}

export const DEFAULT_ADAPTIVE_COLOR_CONFIG: Readonly<AdaptiveColorConfig> = {
  analysisMaxDim: 256,
  targetMidtoneLuminance: 0.44,
  targetLinearAnchor: 0.165,
  minSkinCoverageRatio: 0.012,
  minNeutralCandidateRatio: 0.08,
  bounds: ADAPTIVE_COLOR_BOUNDS
};

export interface LuminancePercentiles {
  p01: number;
  p02: number;
  p05: number;
  p10: number;
  p15: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p98: number;
  p99: number;
}

export interface HistogramAnalysis {
  bins: number;
  luminance: Float32Array;
  red: Float32Array;
  green: Float32Array;
  blue: Float32Array;
  percentiles: LuminancePercentiles;
  channelFloors: { r: number; g: number; b: number };
  channelCeilings: { r: number; g: number; b: number };
  channelClipping: { r: number; g: number; b: number };
}

export interface ExposureAnalysis {
  meanLuminance: number;
  medianLuminance: number;
  meanLuminanceLinear: number;
  medianLuminanceLinear: number;
  underexposedRatio: number;
  deepShadowRatio: number;
  overexposedRatio: number;
  highlightClippingRatio: number;
  shadowClippingRatio: number;
  dynamicRange: number;
  midtoneSpread: number;
  isLowKeyCinematic: boolean;
}

export interface WhiteBalanceAnalysis {
  /** Positive => image is too warm (needs cooling); negative => too cool (needs warming). */
  estimatedWarmCast: number;
  /** Positive => image is too magenta; negative => too green. */
  estimatedTintCast: number;
  /** Neutral low-chroma pixel ratio [0..1]. */
  neutralCandidateRatio: number;
  /** Agreement [0..1] between shadow-midtone and highlight-midtone WB estimates (detects mixed lighting). */
  lightingConsistency: number;
  /** Estimated intentional warm scene probability [0..1] (e.g. golden hour / warm tungsten). */
  intentionalWarmthScore: number;
  confidence: number;
}

export interface ColorDistributionAnalysis {
  meanSaturation: number;
  p90Saturation: number;
  vibrancePotential: number;
  oversaturatedRatio: number;
  isMonochrome: boolean;
  greenFoliageRatio: number;
  neonGreenRatio: number;
  blueCyanRatio: number;
  orangeRedRatio: number;
  yellowRatio: number;
  colorfulness: number;
}

export interface SkinToneAnalysis {
  coverageRatio: number;
  meanLuminance: number;
  meanSaturation: number;
  /** Positive => skin leans orange/yellow; negative => leans cool/magenta. */
  warmBias: number;
  spatialCoherence: number;
  hasFaceDetection: boolean;
  confidence: number;
}

export interface ImageAnalysisReport {
  width: number;
  height: number;
  analyzedWidth: number;
  analyzedHeight: number;
  validPixelRatio: number;
  hasTransparency: boolean;
  histogram: HistogramAnalysis;
  exposure: ExposureAnalysis;
  whiteBalance: WhiteBalanceAnalysis;
  color: ColorDistributionAnalysis;
  skin: SkinToneAnalysis;
}

export interface AdaptiveCorrectionParameters {
  exposure: number;
  highlights: number;
  shadows: number;
  contrast: number;
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  greenCorrection: number;
  blackPoint: number;
  whitePoint: number;
}

export interface AdaptiveCorrectionConfidence {
  overall: number;
  exposure: number;
  whiteBalance: number;
  skin: number;
  foliage: number;
}

export interface AdaptiveCorrectionResult {
  version: string;
  sourceSignature: string;
  parameters: AdaptiveCorrectionParameters;
  confidence: AdaptiveCorrectionConfidence;
  analysis: ImageAnalysisReport;
  warnings: string[];
  timingsMs: {
    analysis: number;
    solver: number;
    total: number;
  };
}

/**
 * Compact render payload attached to ColorRecipe when Adaptive Color Correction is active.
 * `strength` is normalized in [0, 1] (corresponding to 0%..100%).
 */
export interface AdaptiveColorRenderParams extends AdaptiveCorrectionParameters {
  strength: number;
}

export interface AdaptiveColorAnalyzeOptions {
  config?: Partial<AdaptiveColorConfig>;
  /** Optional Phase 3 AI analysis (used opportunistically if already available; never mandatory). */
  aiAnalysis?: AnalysisResult | null;
  sourceSignature?: string;
}

export const NEUTRAL_ADAPTIVE_PARAMETERS: Readonly<AdaptiveCorrectionParameters> = {
  exposure: 0,
  highlights: 0,
  shadows: 0,
  contrast: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  greenCorrection: 0,
  blackPoint: 0,
  whitePoint: 0
};
