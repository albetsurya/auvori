import {
  ColorRecipe,
  EditorialCollection,
  Preset,
  PresetCategory,
  SignatureCollectionMeta
} from '../types';

const BASE_RECIPE: ColorRecipe = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  dehaze: 0,
  sharpen: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  shadowCyan: 0,
  shadowWarm: 0,
  skinBright: 0,
  skinRosy: 0,
  bgDarken: 0,
  bgBokeh: 0,
  fade: 0,
  grain: 0,
  vignette: 0
};

const makeRecipe = (overrides: Partial<ColorRecipe>): ColorRecipe => ({
  ...BASE_RECIPE,
  ...overrides
});

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'cafe', label: 'Café' },
  { id: 'korean', label: 'Korean' },
  { id: 'film', label: 'Film' },
  { id: 'night', label: 'Night' }
];

export const SIGNATURE_COLLECTIONS: SignatureCollectionMeta[] = [
  {
    id: 'rosy-portrait',
    title: 'Rosy Portrait',
    subtitle: 'Luminous skin & soft bloom',
    description: 'Natural rosy skin luminance, soft highlight roll-off, and gentle optical depth.',
    lookType: 'signature',
    coverPresetId: 'porcelain-bloom',
    sampleId: 'park'
  },
  {
    id: 'velvet-series',
    title: 'Velvet Series',
    subtitle: 'Deep shadows & warm midtones',
    description: 'Rich tonal contrast, sculpted darks, and restrained editorial saturation.',
    lookType: 'signature',
    coverPresetId: 'velvet-noir',
    sampleId: 'park'
  },
  {
    id: 'seoul-editorial',
    title: 'Seoul Editorial',
    subtitle: 'Clean whites & airy clarity',
    description: 'Neutral indoor highlights, tamed warm casts, and crisp glass shadows.',
    lookType: 'signature',
    coverPresetId: 'hannam-daylight',
    sampleId: 'cafe'
  },
  {
    id: 'analog-archive',
    title: 'Analog Archive',
    subtitle: 'Film curves, grain & halation',
    description: 'Classic silver-halide tone curves, muted foliage, organic grain, and halation.',
    lookType: 'signature',
    coverPresetId: 'amber-halation',
    sampleId: 'window'
  }
];

export const EDITORIAL_COLLECTIONS: EditorialCollection[] = [
  {
    id: 'col-portrait',
    title: 'Rosy Portrait',
    subtitle: 'Rosy glow & optical bloom',
    category: 'portrait',
    coverPresetId: 'rosy-bokeh',
    sampleId: 'park'
  },
  {
    id: 'col-velvet',
    title: 'Velvet Series',
    subtitle: 'Rich shadows & warm midtones',
    category: 'portrait',
    coverPresetId: 'velvet-merona',
    sampleId: 'park'
  },
  {
    id: 'col-korean',
    title: 'Seoul Editorial',
    subtitle: 'Airy milky tones & clarity',
    category: 'korean',
    coverPresetId: 'gangnam-glass',
    sampleId: 'cafe'
  },
  {
    id: 'col-film',
    title: 'Analog Archive',
    subtitle: 'Film curves, grain & halation',
    category: 'film',
    coverPresetId: 'classic-chrome',
    sampleId: 'window'
  }
];

export interface DiscoverStory {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  presetId: string;
  sampleId: 'cafe' | 'park' | 'window';
}

export const DISCOVER_STORIES: DiscoverStory[] = [
  {
    id: 'story-rosy',
    tag: 'Rosy Portrait',
    title: 'Porcelain Bloom & quiet portrait light',
    excerpt: 'Open editorial shadows with soft highlight bloom while keeping natural skin color fidelity intact.',
    presetId: 'porcelain-bloom',
    sampleId: 'park'
  },
  {
    id: 'story-cafe',
    tag: 'Seoul Editorial',
    title: 'Clean whites without warm cast',
    excerpt: 'Tame yellow indoor lamps and balance wood tones so coffee tables and skin look effortlessly crisp.',
    presetId: 'hannam-daylight',
    sampleId: 'cafe'
  },
  {
    id: 'story-film',
    tag: 'Analog Archive',
    title: 'Tungsten Halation & film tone curves',
    excerpt: 'Monotonic analog shoulder roll-off paired with warm highlight scatter and fine 35mm grain.',
    presetId: 'amber-halation',
    sampleId: 'window'
  }
];

export const PRESETS: Preset[] = [
  {
    id: 'original',
    name: 'Asli',
    category: 'cafe',
    isPro: false,
    lookType: 'essential',
    accentColor: '#64748b',
    description: 'Original untouched camera frame.',
    recipe: makeRecipe({})
  },

  // === FREE PRESETS (6 Efek Siap Pakai — 100% Legacy P0 Baseline Preserved) ===
  {
    id: 'rosy-bokeh',
    name: 'Rosy Bokeh',
    category: 'portrait',
    isPro: false,
    badge: 'Pro Cam',
    lookType: 'essential',
    collectionId: 'rosy-portrait',
    recipeVersion: 1,
    accentColor: '#f43f5e',
    description: 'Luminous skin tone with calm dark foliage backdrop and subtle background bokeh.',
    recipe: makeRecipe({
      exposure: 5,
      contrast: 10,
      highlights: -26,
      shadows: 22,
      whites: 6,
      blacks: -12,
      dehaze: 8,
      sharpen: 22,
      temperature: 0,
      tint: 2,
      saturation: -2,
      vibrance: 8,
      skinBright: 20,
      skinRosy: 24,
      bgDarken: 38,
      bgBokeh: 18,
      vignette: 4,
      hsl: {
        red: { h: -7, s: 13, l: 20 },
        orange: { h: -5, s: -14, l: 22 },
        yellow: { h: 16, s: -28, l: -22 },
        green: { h: 22, s: 6, l: -24 },
        aqua: { h: 0, s: -22, l: -8 },
        blue: { h: 0, s: -20, l: -12 }
      }
    })
  },
  {
    id: 'seoul-cafe',
    name: 'Seoul Café',
    category: 'cafe',
    isPro: false,
    badge: 'Viral',
    lookType: 'essential',
    collectionId: 'seoul-editorial',
    recipeVersion: 1,
    accentColor: '#0ea5e9',
    description: 'Crisp Korean café whites with soft cyan glass shadows and clean natural skin.',
    recipe: makeRecipe({
      exposure: 8,
      contrast: 4,
      highlights: -24,
      shadows: 24,
      whites: 18,
      blacks: 4,
      dehaze: 10,
      sharpen: 16,
      temperature: -12,
      tint: 3,
      saturation: -4,
      vibrance: 8,
      shadowCyan: 18,
      skinBright: 14,
      hsl: {
        red: { h: -2, s: 4, l: 12 },
        orange: { h: 4, s: -16, l: 18 },
        yellow: { h: 10, s: -32, l: 10 },
        green: { h: 14, s: -24, l: 4 },
        aqua: { h: 0, s: -14, l: 10 },
        blue: { h: 14, s: -14, l: 0 }
      }
    })
  },
  {
    id: 'clean-day',
    name: 'Clean Day',
    category: 'korean',
    isPro: false,
    lookType: 'essential',
    collectionId: 'seoul-editorial',
    recipeVersion: 1,
    accentColor: '#38bdf8',
    description: 'Airy everyday brightness with clean whites and natural skin clarity.',
    recipe: makeRecipe({
      exposure: 10,
      contrast: -4,
      highlights: -22,
      shadows: 26,
      whites: 18,
      blacks: 6,
      sharpen: 14,
      temperature: -6,
      tint: 2,
      saturation: -2,
      vibrance: 8,
      skinBright: 16,
      skinRosy: 10,
      hsl: {
        red: { h: -3, s: 6, l: 10 },
        orange: { h: 2, s: -14, l: 20 },
        yellow: { h: 8, s: -28, l: 10 },
        green: { h: 12, s: -20, l: 8 },
        blue: { h: 6, s: -12, l: 4 }
      }
    })
  },
  {
    id: 'warm-latte',
    name: 'Warm Latte',
    category: 'cafe',
    isPro: false,
    lookType: 'essential',
    recipeVersion: 1,
    accentColor: '#d97706',
    description: 'Gentle amber warmth for wooden cafés and afternoon coffee scenes.',
    recipe: makeRecipe({
      exposure: 5,
      contrast: 8,
      highlights: -16,
      shadows: 16,
      blacks: 6,
      dehaze: 6,
      sharpen: 12,
      temperature: 14,
      tint: 3,
      saturation: 2,
      vibrance: 6,
      shadowWarm: 14,
      skinBright: 10,
      fade: 6,
      hsl: {
        red: { h: -2, s: 6, l: 8 },
        orange: { h: 2, s: -6, l: 12 },
        yellow: { h: -10, s: 8, l: -4 },
        green: { h: -12, s: -24, l: -8 },
        blue: { h: 6, s: -22, l: -6 }
      }
    })
  },
  {
    id: 'fuji-soft',
    name: 'Fuji Soft',
    category: 'film',
    isPro: false,
    lookType: 'essential',
    collectionId: 'analog-archive',
    recipeVersion: 1,
    accentColor: '#10b981',
    description: 'Soft highlight roll-off, cool mint greens, and fine analog grain.',
    recipe: makeRecipe({
      exposure: 6,
      contrast: -8,
      highlights: -26,
      shadows: 22,
      blacks: 10,
      temperature: -3,
      tint: -2,
      saturation: -6,
      vibrance: 8,
      shadowCyan: 12,
      skinBright: 10,
      fade: 9,
      grain: 10,
      hsl: {
        red: { h: -4, s: 6, l: 8 },
        orange: { h: 3, s: -10, l: 14 },
        yellow: { h: 12, s: -18, l: 6 },
        green: { h: 20, s: -22, l: 8 },
        aqua: { h: 4, s: -12, l: 8 },
        blue: { h: 10, s: -16, l: 0 }
      }
    })
  },
  {
    id: 'midnight-clean',
    name: 'City Dusk',
    category: 'night',
    isPro: false,
    lookType: 'essential',
    recipeVersion: 1,
    accentColor: '#6366f1',
    description: 'Clean evening tones with crisp midtones and cool urban shadows.',
    recipe: makeRecipe({
      exposure: -2,
      contrast: 14,
      highlights: -22,
      shadows: 14,
      blacks: -12,
      dehaze: 14,
      sharpen: 16,
      temperature: -12,
      tint: 2,
      vibrance: 10,
      shadowCyan: 18,
      skinBright: 10,
      vignette: 14,
      hsl: {
        orange: { h: 0, s: -8, l: 10 },
        yellow: { h: 8, s: -20, l: -6 },
        green: { h: 18, s: -26, l: -12 },
        blue: { h: 6, s: 14, l: -8 }
      }
    })
  },

  // === EXISTING PRO PRESETS (13 Presets — 100% Legacy Baseline & Entitlement Preserved) ===
  {
    id: 'velvet-merona',
    name: 'Velvet Merona',
    category: 'portrait',
    isPro: true,
    badge: 'Pro',
    lookType: 'signature',
    collectionId: 'velvet-series',
    recipeVersion: 1,
    accentColor: '#ec4899',
    description: 'Moody velvet background separation with glowing rosy cheek & lip accents.',
    recipe: makeRecipe({
      exposure: 3,
      contrast: 14,
      highlights: -28,
      shadows: 20,
      whites: 4,
      blacks: -18,
      dehaze: 10,
      sharpen: 24,
      temperature: 1,
      tint: 3,
      saturation: -2,
      vibrance: 8,
      skinBright: 22,
      skinRosy: 28,
      bgDarken: 46,
      bgBokeh: 24,
      vignette: 8,
      hsl: {
        red: { h: -8, s: 16, l: 22 },
        orange: { h: -5, s: -12, l: 24 },
        yellow: { h: 16, s: -32, l: -26 },
        green: { h: 24, s: 4, l: -28 },
        aqua: { h: 0, s: -24, l: -10 },
        blue: { h: 0, s: -22, l: -14 }
      }
    })
  },
  {
    id: 'gangnam-glass',
    name: 'Gangnam Glass',
    category: 'korean',
    isPro: true,
    badge: 'Top',
    lookType: 'signature',
    collectionId: 'seoul-editorial',
    recipeVersion: 1,
    accentColor: '#0284c7',
    description: 'High-clarity studio Korean portrait with cool glass shadow separation.',
    recipe: makeRecipe({
      exposure: 8,
      contrast: 16,
      highlights: -26,
      shadows: 20,
      whites: 14,
      blacks: -8,
      dehaze: 16,
      sharpen: 20,
      temperature: -15,
      tint: 2,
      saturation: -4,
      vibrance: 10,
      shadowCyan: 24,
      skinBright: 20,
      skinRosy: 12,
      hsl: {
        red: { h: -5, s: 10, l: 14 },
        orange: { h: 0, s: -18, l: 22 },
        yellow: { h: 12, s: -34, l: 6 },
        green: { h: 18, s: -26, l: 0 },
        aqua: { h: 0, s: 6, l: 8 },
        blue: { h: 12, s: 10, l: -4 }
      }
    })
  },
  {
    id: 'tokyo-milk',
    name: 'Tokyo Milk',
    category: 'korean',
    isPro: true,
    lookType: 'signature',
    collectionId: 'seoul-editorial',
    recipeVersion: 1,
    accentColor: '#67e8f9',
    description: 'Soft milky lift with restrained contrast and airy luminous skin.',
    recipe: makeRecipe({
      exposure: 14,
      contrast: -14,
      highlights: -28,
      shadows: 30,
      whites: 10,
      blacks: 14,
      temperature: -8,
      tint: 3,
      saturation: -10,
      vibrance: 8,
      shadowCyan: 14,
      skinBright: 20,
      skinRosy: 14,
      fade: 10,
      hsl: {
        red: { h: -4, s: 8, l: 12 },
        orange: { h: 2, s: -16, l: 22 },
        yellow: { h: 10, s: -28, l: 12 },
        green: { h: 18, s: -28, l: 12 },
        blue: { h: 8, s: -18, l: 10 }
      }
    })
  },
  {
    id: 'busan-breeze',
    name: 'Busan Breeze',
    category: 'korean',
    isPro: true,
    lookType: 'signature',
    collectionId: 'seoul-editorial',
    recipeVersion: 1,
    accentColor: '#3b82f6',
    description: 'Coastal blue clarity with crisp whites and neutral skin.',
    recipe: makeRecipe({
      exposure: 6,
      contrast: 12,
      highlights: -20,
      shadows: 18,
      whites: 12,
      dehaze: 14,
      sharpen: 16,
      temperature: -16,
      tint: -2,
      vibrance: 12,
      shadowCyan: 20,
      skinBright: 14,
      hsl: {
        orange: { h: 2, s: -12, l: 16 },
        yellow: { h: 8, s: -24, l: 4 },
        green: { h: 16, s: -18, l: 0 },
        aqua: { h: 6, s: 20, l: 6 },
        blue: { h: 10, s: 18, l: -6 }
      }
    })
  },
  {
    id: 'matcha-house',
    name: 'Matcha House',
    category: 'cafe',
    isPro: true,
    lookType: 'signature',
    recipeVersion: 1,
    accentColor: '#22c55e',
    description: 'Botanical olive greens balanced against clean indoor light.',
    recipe: makeRecipe({
      exposure: 6,
      contrast: 6,
      highlights: -18,
      shadows: 18,
      whites: 10,
      dehaze: 8,
      sharpen: 14,
      temperature: 2,
      tint: -4,
      saturation: -4,
      vibrance: 8,
      shadowCyan: 12,
      skinBright: 14,
      fade: 6,
      hsl: {
        red: { h: -4, s: 8, l: 8 },
        orange: { h: 0, s: -14, l: 16 },
        yellow: { h: 18, s: -18, l: 0 },
        green: { h: 10, s: 12, l: -10 },
        blue: { h: 8, s: -22, l: -4 }
      }
    })
  },
  {
    id: 'espresso-crisp',
    name: 'Espresso Crisp',
    category: 'cafe',
    isPro: true,
    lookType: 'signature',
    collectionId: 'velvet-series',
    recipeVersion: 1,
    accentColor: '#b45309',
    description: 'Deep espresso contrast with warm dark shadows and muted highlights.',
    recipe: makeRecipe({
      exposure: -1,
      contrast: 20,
      highlights: -20,
      shadows: 10,
      blacks: -18,
      dehaze: 18,
      sharpen: 20,
      temperature: 8,
      saturation: -6,
      vibrance: 10,
      shadowWarm: 14,
      skinBright: 10,
      vignette: 16,
      hsl: {
        orange: { h: -2, s: -8, l: 8 },
        yellow: { h: -14, s: -20, l: -18 },
        green: { h: -16, s: -35, l: -22 },
        blue: { h: 0, s: -28, l: -16 }
      }
    })
  },
  {
    id: 'brunch-glow',
    name: 'Brunch Glow',
    category: 'cafe',
    isPro: true,
    lookType: 'signature',
    recipeVersion: 1,
    accentColor: '#f59e0b',
    description: 'Sunlit morning warmth with luminous rosy skin tones.',
    recipe: makeRecipe({
      exposure: 12,
      contrast: 4,
      highlights: -18,
      shadows: 22,
      whites: 14,
      sharpen: 12,
      temperature: 10,
      tint: 4,
      vibrance: 10,
      shadowWarm: 10,
      skinBright: 18,
      skinRosy: 12,
      hsl: {
        red: { h: -4, s: 12, l: 12 },
        orange: { h: 2, s: -8, l: 18 },
        yellow: { h: -8, s: 10, l: 6 },
        green: { h: 10, s: -16, l: 4 }
      }
    })
  },
  {
    id: 'classic-chrome',
    name: 'Classic Chrome',
    category: 'film',
    isPro: true,
    badge: 'Pro',
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 1,
    accentColor: '#14b8a6',
    description: 'Documentary muted greens and cool slate shadows inspired by classic slide film.',
    recipe: makeRecipe({
      exposure: 2,
      contrast: 16,
      highlights: -28,
      shadows: 14,
      blacks: 6,
      dehaze: 10,
      sharpen: 16,
      temperature: -4,
      tint: -6,
      saturation: -14,
      vibrance: 8,
      shadowCyan: 16,
      fade: 11,
      grain: 14,
      vignette: 12,
      hsl: {
        red: { h: -4, s: -10, l: 4 },
        orange: { h: 4, s: -8, l: 10 },
        yellow: { h: -10, s: -14, l: -4 },
        green: { h: -18, s: -40, l: 6 },
        aqua: { h: 6, s: -20, l: 0 },
        blue: { h: 12, s: -26, l: -8 }
      }
    })
  },
  {
    id: 'kodak-gold',
    name: 'Kodak Gold',
    category: 'film',
    isPro: true,
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 1,
    accentColor: '#eab308',
    description: 'Nostalgic golden highlights, matte shadows, and organic 35mm warmth.',
    recipe: makeRecipe({
      exposure: 6,
      contrast: 10,
      highlights: -22,
      shadows: 18,
      whites: -10,
      blacks: 8,
      temperature: 18,
      tint: 3,
      saturation: 2,
      vibrance: 8,
      shadowWarm: 16,
      fade: 10,
      grain: 16,
      vignette: 10,
      hsl: {
        red: { h: -4, s: 6, l: 6 },
        orange: { h: 4, s: -4, l: 10 },
        yellow: { h: -14, s: 16, l: -4 },
        green: { h: -16, s: -28, l: 4 },
        blue: { h: 8, s: -20, l: -10 }
      }
    })
  },
  {
    id: 'portra-400',
    name: 'Portra Skin',
    category: 'film',
    isPro: true,
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 1,
    accentColor: '#fb7185',
    description: 'Soft peach portrait skin rendering with delicate analog sage greens.',
    recipe: makeRecipe({
      exposure: 8,
      contrast: -6,
      highlights: -28,
      shadows: 26,
      whites: -10,
      blacks: 10,
      temperature: 8,
      tint: 5,
      saturation: -6,
      vibrance: 10,
      shadowWarm: 8,
      skinBright: 18,
      skinRosy: 14,
      fade: 8,
      grain: 11,
      hsl: {
        red: { h: -4, s: 10, l: 12 },
        orange: { h: 3, s: -10, l: 16 },
        yellow: { h: -10, s: -14, l: 4 },
        green: { h: -12, s: -26, l: 6 },
        blue: { h: 8, s: -18, l: -4 }
      }
    })
  },
  {
    id: 'mono-leica',
    name: 'Leica Mono',
    category: 'film',
    isPro: true,
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 1,
    accentColor: '#94a3b8',
    description: 'Crisp high-contrast monochrome street & portrait film stock.',
    recipe: makeRecipe({
      exposure: 4,
      contrast: 28,
      highlights: -16,
      shadows: 12,
      blacks: -14,
      dehaze: 16,
      sharpen: 22,
      saturation: -50,
      vibrance: -50,
      fade: 7,
      grain: 18,
      vignette: 18
    })
  },
  {
    id: 'neon-shibuya',
    name: 'Neon Shibuya',
    category: 'night',
    isPro: true,
    lookType: 'signature',
    recipeVersion: 1,
    accentColor: '#ec4899',
    description: 'Saturated street signage with clean cyan-magenta night separation.',
    recipe: makeRecipe({
      exposure: -2,
      contrast: 20,
      highlights: -24,
      shadows: 18,
      blacks: -14,
      dehaze: 16,
      sharpen: 18,
      temperature: -14,
      tint: 10,
      saturation: 4,
      vibrance: 14,
      shadowCyan: 24,
      vignette: 16,
      hsl: {
        red: { h: -10, s: 18, l: 6 },
        yellow: { h: -12, s: -12, l: -6 },
        green: { h: 20, s: -24, l: -12 },
        aqua: { h: 0, s: 22, l: 8 },
        blue: { h: -8, s: 18, l: -4 }
      }
    })
  },
  {
    id: 'cinematic-teal',
    name: 'Teal & Amber',
    category: 'night',
    isPro: true,
    lookType: 'signature',
    recipeVersion: 1,
    accentColor: '#06b6d4',
    description: 'Cinema teal shadows balanced with warm amber skin tones.',
    recipe: makeRecipe({
      exposure: 0,
      contrast: 18,
      highlights: -24,
      shadows: 16,
      blacks: -12,
      dehaze: 16,
      sharpen: 18,
      temperature: -4,
      tint: -2,
      vibrance: 10,
      shadowCyan: 26,
      skinBright: 12,
      grain: 9,
      vignette: 18,
      hsl: {
        red: { h: 8, s: 8, l: 6 },
        orange: { h: -4, s: 10, l: 10 },
        yellow: { h: -16, s: -10, l: -8 },
        green: { h: 35, s: -20, l: -14 },
        aqua: { h: 0, s: 16, l: 0 },
        blue: { h: -16, s: 10, l: -8 }
      }
    })
  },

  // === P1 SIGNATURE LOOKS (5 Distinct Pro Layered Color-Science Looks) ===
  {
    id: 'porcelain-bloom',
    name: 'Porcelain Bloom',
    category: 'portrait',
    isPro: true,
    badge: 'Signature',
    lookType: 'signature',
    collectionId: 'rosy-portrait',
    recipeVersion: 2,
    accentColor: '#d4848c',
    description: 'Airy editorial portrait with lifted tone curve, rosy midtone warmth, and soft highlight bloom.',
    recipe: makeRecipe({
      exposure: 6,
      contrast: 2,
      highlights: -16,
      shadows: 14,
      whites: 4,
      dehaze: 4,
      sharpen: 16,
      temperature: 2,
      tint: 4,
      saturation: -4,
      vibrance: 8,
      skinBright: 16,
      skinRosy: 18,
      bgDarken: 14,
      bgBokeh: 14,
      vignette: 4,
      hsl: {
        red: { h: -5, s: 10, l: 14 },
        orange: { h: -3, s: -12, l: 16 },
        yellow: { h: 10, s: -22, l: -8 },
        green: { h: 16, s: -14, l: -10 },
        blue: { h: 4, s: -16, l: -4 }
      },
      toneCurve: {
        blackPoint: 0.025,
        shadowPivot: 0.035,
        midtonePivot: 0.03,
        highlightShoulder: 0.16,
        whitePoint: 0.99
      },
      colorGrading: {
        shadowTint: [-0.008, 0.002, 0.01],
        midtoneTint: [0.012, -0.004, 0.006],
        highlightTint: [0.016, 0.006, 0.004],
        balance: 0.08
      },
      effects: {
        bloomStrength: 22,
        bloomThreshold: 0.72,
        halationStrength: 0,
        halationThreshold: 0.85
      }
    })
  },
  {
    id: 'velvet-noir',
    name: 'Velvet Noir',
    category: 'portrait',
    isPro: true,
    badge: 'Signature',
    lookType: 'signature',
    collectionId: 'velvet-series',
    recipeVersion: 2,
    accentColor: '#7c5348',
    description: 'Sculpted low-key velvet shadows, warm midtones, and champagne highlight roll-off.',
    recipe: makeRecipe({
      exposure: -2,
      contrast: 10,
      highlights: -18,
      shadows: 8,
      blacks: -8,
      dehaze: 12,
      sharpen: 20,
      temperature: 4,
      tint: 1,
      saturation: -8,
      vibrance: 10,
      skinBright: 14,
      skinRosy: 12,
      bgDarken: 22,
      bgBokeh: 16,
      grain: 8,
      vignette: 16,
      hsl: {
        red: { h: -4, s: 8, l: 10 },
        orange: { h: -2, s: -8, l: 12 },
        yellow: { h: -8, s: -24, l: -14 },
        green: { h: 14, s: -28, l: -20 },
        blue: { h: 6, s: -24, l: -14 }
      },
      toneCurve: {
        blackPoint: 0.014,
        shadowPivot: -0.075,
        midtonePivot: 0.02,
        highlightShoulder: 0.2,
        whitePoint: 0.96
      },
      colorGrading: {
        shadowTint: [-0.018, -0.01, 0.012],
        midtoneTint: [0.022, 0.008, -0.016],
        highlightTint: [0.014, 0.008, -0.01],
        balance: -0.1
      },
      effects: {
        bloomStrength: 12,
        bloomThreshold: 0.78,
        halationStrength: 0,
        halationThreshold: 0.88
      }
    })
  },
  {
    id: 'hannam-daylight',
    name: 'Hannam Daylight',
    category: 'korean',
    isPro: true,
    badge: 'Signature',
    lookType: 'signature',
    collectionId: 'seoul-editorial',
    recipeVersion: 2,
    accentColor: '#608ba6',
    description: 'Architectural Seoul daylight aesthetic with clean lifted blacks and cool slate shadows.',
    recipe: makeRecipe({
      exposure: 7,
      contrast: 4,
      highlights: -18,
      shadows: 14,
      whites: 12,
      dehaze: 10,
      sharpen: 18,
      temperature: -10,
      tint: 1,
      saturation: -6,
      vibrance: 8,
      skinBright: 16,
      skinRosy: 6,
      hsl: {
        red: { h: -3, s: 4, l: 10 },
        orange: { h: 2, s: -18, l: 18 },
        yellow: { h: 10, s: -36, l: 14 },
        green: { h: 14, s: -28, l: 4 },
        aqua: { h: 2, s: -8, l: 8 },
        blue: { h: 10, s: -10, l: 0 }
      },
      toneCurve: {
        blackPoint: 0.032,
        shadowPivot: 0.02,
        midtonePivot: 0.025,
        highlightShoulder: 0.18,
        whitePoint: 1.0
      },
      colorGrading: {
        shadowTint: [-0.016, 0.006, 0.022],
        midtoneTint: [-0.004, 0.002, 0.006],
        highlightTint: [0.004, 0.006, 0.008],
        balance: 0
      },
      effects: {
        bloomStrength: 14,
        bloomThreshold: 0.78,
        halationStrength: 0,
        halationThreshold: 0.9
      }
    })
  },
  {
    id: 'amber-halation',
    name: 'Amber Halation',
    category: 'film',
    isPro: true,
    badge: 'Signature',
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 2,
    accentColor: '#c2603d',
    description: 'Tungsten cinema film look with analog highlight halation, teal shadows, and 35mm grain.',
    recipe: makeRecipe({
      exposure: 2,
      contrast: 8,
      highlights: -20,
      shadows: 14,
      dehaze: 8,
      sharpen: 12,
      temperature: -4,
      tint: 2,
      saturation: -4,
      vibrance: 8,
      skinBright: 10,
      grain: 15,
      vignette: 10,
      hsl: {
        red: { h: -6, s: 12, l: 4 },
        orange: { h: 2, s: -6, l: 8 },
        yellow: { h: -12, s: -10, l: -4 },
        green: { h: -16, s: -30, l: -4 },
        aqua: { h: 4, s: 10, l: -2 },
        blue: { h: 8, s: -12, l: -6 }
      },
      toneCurve: {
        blackPoint: 0.022,
        shadowPivot: -0.035,
        midtonePivot: 0.015,
        highlightShoulder: 0.22,
        whitePoint: 0.97
      },
      colorGrading: {
        shadowTint: [-0.026, 0.012, 0.028],
        midtoneTint: [0.016, 0.004, -0.014],
        highlightTint: [0.022, 0.006, -0.018],
        balance: -0.05
      },
      effects: {
        bloomStrength: 16,
        bloomThreshold: 0.76,
        halationStrength: 28,
        halationThreshold: 0.74
      }
    })
  },
  {
    id: 'silver-gelatin',
    name: 'Silver Gelatin',
    category: 'film',
    isPro: true,
    badge: 'Signature',
    lookType: 'signature',
    collectionId: 'analog-archive',
    recipeVersion: 2,
    accentColor: '#73766e',
    description: 'Archival fiber-paper monochrome with warm selenium highlights, deep blacks, and gentle bloom.',
    recipe: makeRecipe({
      exposure: 3,
      contrast: 14,
      highlights: -14,
      shadows: 10,
      dehaze: 10,
      sharpen: 18,
      saturation: -50,
      vibrance: -50,
      grain: 14,
      vignette: 14,
      toneCurve: {
        blackPoint: 0.026,
        shadowPivot: -0.055,
        midtonePivot: 0.02,
        highlightShoulder: 0.16,
        whitePoint: 0.98
      },
      colorGrading: {
        shadowTint: [0.008, 0.004, -0.006],
        midtoneTint: [0.004, 0.002, -0.004],
        highlightTint: [0.018, 0.014, -0.006],
        balance: 0.05
      },
      effects: {
        bloomStrength: 18,
        bloomThreshold: 0.74,
        halationStrength: 0,
        halationThreshold: 0.9
      }
    })
  },

  // === P4 ADAPTIVE LOOK FLAGSHIP PRO PRESET (Layer A–E CV-Guided Relighting) ===
  {
    id: 'direct-flash',
    name: 'Direct Flash',
    category: 'portrait',
    isPro: true,
    badge: 'Adaptive',
    lookType: 'adaptive',
    collectionId: 'direct-flash',
    recipeVersion: 3,
    accentColor: '#d9ceb8',
    description: 'Subject-aware on-camera flash look that lifts faces softly, guards skin & fabric highlights, and deepens background depth.',
    adaptive: {
      requiresFaceDetection: true,
      requiresSkinSegmentation: true,
      requiresSubjectSegmentation: true,
      requiresLightingAnalysis: true,
      fallbackStrategy: 'conservative-signature'
    },
    recipe: makeRecipe({
      exposure: 1,
      contrast: 6,
      highlights: -4,
      shadows: 8,
      whites: 4,
      blacks: -2,
      dehaze: 3,
      sharpen: 10,
      temperature: 0,
      tint: 0,
      saturation: -2,
      vibrance: 6,
      skinBright: 0,
      skinRosy: 0,
      grain: 5,
      vignette: 6,
      hsl: {
        red: { h: 0, s: 3, l: 2 },
        orange: { h: 0, s: -2, l: 2 },
        yellow: { h: 0, s: -14, l: -2 },
        green: { h: 6, s: -14, l: -6 },
        blue: { h: 2, s: -8, l: -2 }
      },
      toneCurve: {
        blackPoint: 0.005,
        shadowPivot: -0.015,
        midtonePivot: 0.016,
        highlightShoulder: 0.09,
        whitePoint: 1.0
      },
      colorGrading: {
        shadowTint: [-0.005, 0.0, 0.008],
        midtoneTint: [0.002, 0.002, -0.001],
        highlightTint: [0.002, 0.003, 0.003],
        balance: 0.02
      },
      effects: {
        bloomStrength: 8,
        bloomThreshold: 0.82,
        halationStrength: 0,
        halationThreshold: 0.9
      },
      relighting: {
        subjectLift: 32,
        flashSpecular: 18,
        backgroundFalloff: 20,
        falloffRadius: 1.15,
        skinHighlightGuard: 0.88,
        shadowFloorGuard: 0.85
      }
    })
  }
];
