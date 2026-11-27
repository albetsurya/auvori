export type PresetCategory = 'all' | 'free' | 'favorites' | 'portrait' | 'cafe' | 'korean' | 'film' | 'night';

export type AppTab = 'home' | 'presets' | 'discover' | 'profile';

export type EditorBackdrop = 'graphite' | 'chalk';

export type ExportFormat = 'jpeg' | 'png';

export type ThemeMode = 'light' | 'dark';

export type AspectRatioOption = 'original' | '4:5' | '1:1' | '16:9';

export interface ImageTransform {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  aspect: AspectRatioOption;
}

export const DEFAULT_TRANSFORM: ImageTransform = {
  rotate: 0,
  flipH: false,
  aspect: 'original'
};

export interface RecentEdit {
  id: string;
  title: string;
  presetId: string;
  presetName: string;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  thumbDataUrl: string;
  savedAt: string;
}

export interface EditorialCollection {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<PresetCategory, 'all' | 'free' | 'favorites'>;
  coverPresetId: string;
  sampleId: 'cafe' | 'park' | 'window';
}

export interface HslBandAdjustment {
  h: number; // -35 to +35 degrees
  s: number; // -50 to +50
  l: number; // -50 to +50
}

export interface HslMix {
  red: HslBandAdjustment;
  orange: HslBandAdjustment;
  yellow: HslBandAdjustment;
  green: HslBandAdjustment;
  aqua: HslBandAdjustment;
  blue: HslBandAdjustment;
}

export type LookTierType = 'essential' | 'signature' | 'adaptive';

export type CuratedCollectionId =
  | 'rosy-portrait'
  | 'velvet-series'
  | 'seoul-editorial'
  | 'analog-archive'
  | 'direct-flash'
  | 'night-cinema';

export interface ToneCurveConfig {
  blackPoint: number;        // 0 to 0.14 (matte film toe lift)
  shadowPivot: number;       // -0.18 to 0.18 at x=0.25
  midtonePivot: number;      // -0.18 to 0.18 at x=0.50
  highlightShoulder: number; // 0 to 0.28 (soft highlight roll-off at x=0.75)
  whitePoint: number;        // 0.88 to 1.0 (white ceiling)
}

export interface ColorGrading3Way {
  shadowTint: [number, number, number];    // RGB shift in [-0.12, 0.12]
  midtoneTint: [number, number, number];   // RGB shift in [-0.12, 0.12]
  highlightTint: [number, number, number]; // RGB shift in [-0.12, 0.12]
  balance: number;                         // -0.5 to 0.5
}

export interface OpticalEffectsRecipe {
  bloomStrength: number;     // 0 to 40
  bloomThreshold: number;    // 0.60 to 0.92
  halationStrength: number;  // 0 to 35
  halationThreshold: number; // 0.68 to 0.95
}

export type AdaptiveLookProfile = 'direct-flash' | 'night-cinema';

export interface RelightingRecipe {
  profile?: AdaptiveLookProfile;
  subjectLift: number;         // 0 to 45 (adaptive subject illumination)
  flashSpecular: number;       // 0 to 35 (controlled specular crispness)
  backgroundFalloff: number;   // 0 to 50 (spatial background falloff)
  falloffRadius: number;       // 0.6 to 1.8
  skinHighlightGuard: number;  // 0 to 1
  shadowFloorGuard: number;    // 0 to 1
  shadowNoiseGuard?: number;   // 0 to 1 (dark-shadow chroma & luma noise control)
  highlightRecovery?: number;  // 0 to 1 (gamut-preserving neon/lamp highlight guard)
}

export interface AdaptiveRequirements {
  requiresFaceDetection?: boolean;
  requiresSkinSegmentation?: boolean;
  requiresSubjectSegmentation?: boolean;
  requiresLightingAnalysis?: boolean;
  fallbackStrategy: 'lighting-only' | 'conservative-signature';
}

export interface ColorRecipe {
  exposure: number;      // -50 to +50
  contrast: number;      // -50 to +50
  highlights: number;    // -50 to +50
  shadows: number;       // -50 to +50
  whites: number;        // -50 to +50
  blacks: number;        // -50 to +50
  dehaze: number;        // 0 to 50 (removes milky haze, adds crisp pop)
  sharpen: number;       // 0 to 35 (foreground luminance micro-sharpening)
  temperature: number;   // -50 (cool) to +50 (warm)
  tint: number;          // -50 (green/cyan) to +50 (magenta)
  saturation: number;    // -50 to +50
  vibrance: number;      // -50 to +50
  shadowCyan: number;    // 0 to 40 (teal/cyan shift in shadows & glass)
  shadowWarm: number;    // 0 to 40 (warm amber shift in shadows)
  skinBright: number;    // 0 to 35 (keeps skin clean & luminous)
  skinRosy: number;      // 0 to 45 (porcelain rosy flush & soft skin smoothing)
  bgDarken: number;      // 0 to 50 (portrait-aware dark moody background)
  bgBokeh: number;       // 0 to 40 (subtle pro-camera background bokeh)
  fade: number;          // 0 to 35 (matte film black lift)
  grain: number;         // 0 to 35 (film grain)
  vignette: number;      // 0 to 40 (soft edge darkening)
  hsl?: Partial<HslMix>; // Smooth 6-band Color Mix (Red, Orange, Yellow, Green, Aqua, Blue)
  /* ── P1 Signature & Adaptive Color Science Extensions (optional; undefined = exact P0 baseline) ── */
  toneCurve?: ToneCurveConfig;
  colorGrading?: ColorGrading3Way;
  effects?: OpticalEffectsRecipe;
  relighting?: RelightingRecipe;
}

export interface Preset {
  id: string;
  name: string;
  category: Exclude<PresetCategory, 'all' | 'free' | 'favorites'>;
  isPro: boolean;
  badge?: string;
  accentColor: string;
  description?: string;
  lookType?: LookTierType;
  collectionId?: CuratedCollectionId;
  recipeVersion?: number;
  adaptive?: AdaptiveRequirements;
  recipe: ColorRecipe;
}

export interface SignatureCollectionMeta {
  id: CuratedCollectionId;
  title: string;
  subtitle: string;
  description: string;
  lookType: LookTierType;
  coverPresetId: string;
  sampleId: 'cafe' | 'park' | 'window';
}

export interface ManualAdjustments {
  exposure: number;    // -40 to +40
  contrast: number;    // -40 to +40
  temperature: number; // -40 to +40
  saturation: number;  // -40 to +40
  skinRosy: number;    // 0 to 45
  bgDarken: number;    // 0 to 50
  bgBokeh: number;     // 0 to 40
  grain: number;       // 0 to 35
}

export interface LicenseState {
  isPro: boolean;
  email?: string;
  plan?: string;
  activatedAt?: string;
}

export const DEFAULT_ADJUSTMENTS: ManualAdjustments = {
  exposure: 0,
  contrast: 0,
  temperature: 0,
  saturation: 0,
  skinRosy: 0,
  bgDarken: 0,
  bgBokeh: 0,
  grain: 0
};
