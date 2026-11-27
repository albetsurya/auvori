/**
 * Phase 3 Adaptive Analysis contract and configuration types.
 * Strictly separates AI inference outputs (YuNet, PP-HumanSeg, U²-Netp)
 * from deterministic heuristic signals (YCbCr skin likelihood & Rec.709 lighting).
 */

export type AiExecutionBackend = 'webgpu' | 'wasm';
export type AnalysisRuntimeBackend = AiExecutionBackend | 'heuristic-only';

export type AiModelId = 'yunet-2026may' | 'pphumanseg-2023mar' | 'u2netp-v1';
export type SegmentationModelId = 'pphumanseg-2023mar' | 'u2netp-v1';
export type SegmentationModelChoice = 'auto' | 'u2netp' | 'pphumanseg';

export type AnalysisStatus = 'complete' | 'degraded' | 'failed' | 'cancelled';

export interface AiModelSpec {
  id: AiModelId;
  displayName: string;
  url: string;
  upstreamUrl: string;
  version: string;
  pinnedCommit: string;
  fileSizeBytes: number;
  sha256: string;
  license: string;
  attribution: string;
  inputName: string;
  outputNames: string[];
  supportedOperators: string[];
}

export interface NormalizedPoint {
  /** Horizontal coordinate normalized to [0..1] in transformed source frame. */
  x: number;
  /** Vertical coordinate normalized to [0..1] in transformed source frame. */
  y: number;
}

export interface NormalizedRect {
  /** Top-left X normalized to [0..1]. */
  x: number;
  /** Top-left Y normalized to [0..1]. */
  y: number;
  /** Width normalized to [0..1]. */
  width: number;
  /** Height normalized to [0..1]. */
  height: number;
}

export interface FacialLandmarks {
  rightEye: NormalizedPoint;
  leftEye: NormalizedPoint;
  nose: NormalizedPoint;
  rightMouth: NormalizedPoint;
  leftMouth: NormalizedPoint;
}

export interface FaceDetection {
  bbox: NormalizedRect;
  landmarks: FacialLandmarks;
  /** YuNet calibrated score sqrt(cls * obj) in [0..1]. */
  confidence: number;
  /** Fraction of total frame area occupied by bbox. */
  areaRatio: number;
}

export type MaskSourceKind =
  | 'ai-pphumanseg'
  | 'ai-u2netp'
  | 'heuristic-ycbcr-skin'
  | 'none';

export interface MaskBuffer {
  width: number;
  height: number;
  data: Float32Array;
  min: number;
  max: number;
  mean: number;
  /** Fraction of pixels with weight > 0.5. */
  foregroundRatio: number;
  source: MaskSourceKind;
}

export interface LightingStats {
  /** 64-bin normalized Rec.709 luminance histogram (bins sum to ~1.0). */
  histogram: Float32Array;
  meanLuminance: number;
  medianLuminance: number;
  /** Weighted subject luminance when subject mask is confident; null otherwise. */
  subjectLuminance: number | null;
  backgroundLuminance: number;
  /** Ratio subjectLuminance / max(backgroundLuminance, 0.02); 1.0 if subject null. */
  subjectBackgroundRatio: number;
  /** Fraction of pixels with Rec.709 luma >= 0.92. */
  highlightClippingRatio: number;
  /** Fraction of pixels with Rec.709 luma <= 0.12. */
  darkShadowRatio: number;
  /** 95th percentile minus 5th percentile luminance. */
  dynamicRange: number;
  isLowLight: boolean;
  isBacklitPortrait: boolean;
  /** True when frame saturation/chroma is negligible (e.g. monochrome B&W image). */
  isMonochrome: boolean;
}

export interface AnalysisConfig {
  /** Minimum YuNet confidence score; empirical threshold 0.80 eliminates non-face FPs. */
  yunetScoreThreshold: number;
  /** YuNet NMS IoU threshold. */
  yunetNmsThreshold: number;
  /** Maximum side resolution for YuNet input (padded to multiple of 32). */
  yunetMaxSide: number;
  /** 'auto' routes portraits -> PP-HumanSeg and non-face objects -> U²-Netp. */
  segmentationModel: SegmentationModelChoice;
  /** Max dimension for Stage C skin & luminance computation grid. */
  analysisMaxDim: number;
  /** Threshold above which skinConfidenceMask counts toward skin coverage. */
  skinMinConfidence: number;
  /** Optional override for execution backend testing ('webgpu' | 'wasm'). */
  preferredBackend?: AiExecutionBackend;
}

export const DEFAULT_ANALYSIS_CONFIG: Readonly<AnalysisConfig> = {
  yunetScoreThreshold: 0.8,
  yunetNmsThreshold: 0.3,
  yunetMaxSide: 640,
  segmentationModel: 'auto',
  analysisMaxDim: 320,
  skinMinConfidence: 0.35,
};

export const ANALYSIS_MODEL_VERSION = 'phase3-yunet26m-pph23m-u2p1-v1';

export interface AnalysisTimingsMs {
  total: number;
  modelLoad: number;
  preprocess: number;
  faceDetect: number;
  segmentation: number;
  skinAndLighting: number;
}

export interface AnalysisResult {
  sourceId: string;
  sourceRevision: number;
  /** Width in pixels after current crop/rotation/flip transform. */
  width: number;
  /** Height in pixels after current crop/rotation/flip transform. */
  height: number;
  /** Deterministic revision key representing crop, rotation, and flips. */
  transformRevision: string;
  /** AI stack + contract version identifier. */
  modelVersion: string;
  /** Canonical serialized config string included in cache keys. */
  analysisConfigKey: string;
  config: AnalysisConfig;
  backend: AnalysisRuntimeBackend;
  modelsUsed: AiModelId[];
  segmentationModelUsed: SegmentationModelId | 'none';
  status: AnalysisStatus;
  degradedReason?: string;
  faces: FaceDetection[];
  subjectMask: MaskBuffer;
  /** Confidence-gated [0..1] reliability score for subjectMask. */
  subjectMaskConfidence: number;
  /** Deterministic YCbCr heuristic skin confidence (NOT AI skin segmentation). */
  skinConfidenceMask: MaskBuffer;
  skinCoverageRatio: number;
  lighting: LightingStats;
  /** Overall confidence [0..1] across Stage A/B/C signals. */
  overallConfidence: number;
  /** True when Stage B subjectMask passes confidence gating (human or non-human object). */
  confidentForSubjectMask: boolean;
  /** True only when Stage A+B+C pass portrait confidence gates (>=1 face + confident mask). */
  confidentForAdaptivePortrait: boolean;
  timingsMs: AnalysisTimingsMs;
  createdAt: number;
}
