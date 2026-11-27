import { ColorRecipe, EditorialCollection, Preset, PresetCategory } from '../types';

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

export const EDITORIAL_COLLECTIONS: EditorialCollection[] = [
  {
    id: 'col-portrait',
    title: 'Luminous Portrait',
    subtitle: 'Rosy glow & depth bokeh',
    category: 'portrait',
    coverPresetId: 'rosy-bokeh',
    sampleId: 'park'
  },
  {
    id: 'col-cafe',
    title: 'Warm Café Mornings',
    subtitle: 'Clean whites & soft shadows',
    category: 'cafe',
    coverPresetId: 'seoul-cafe',
    sampleId: 'cafe'
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
    title: 'Analog Film Stocks',
    subtitle: 'Classic Chrome, Gold & Portra',
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
    tag: 'Portrait Guide',
    title: 'Rosy skin & quiet dark backgrounds',
    excerpt: 'Lift facial luminance while calming busy greenery and ceiling clutter into subtle pro bokeh.',
    presetId: 'rosy-bokeh',
    sampleId: 'park'
  },
  {
    id: 'story-cafe',
    tag: 'Café Aesthetic',
    title: 'Clean whites without warm cast',
    excerpt: 'Tame yellow indoor lamps and balance wood tones so coffee tables and skin look effortlessly crisp.',
    presetId: 'seoul-cafe',
    sampleId: 'cafe'
  },
  {
    id: 'story-film',
    tag: 'Analog Study',
    title: 'Portra warmth vs Classic Chrome',
    excerpt: 'Compare soft peach portrait film against muted documentary greens for timeless everyday frames.',
    presetId: 'portra-400',
    sampleId: 'window'
  }
];

export const PRESETS: Preset[] = [
  {
    id: 'original',
    name: 'Asli',
    category: 'cafe',
    isPro: false,
    accentColor: '#64748b',
    recipe: makeRecipe({})
  },

  // === FREE PRESETS (6 Efek Siap Pakai) ===
  {
    id: 'rosy-bokeh',
    name: 'Rosy Bokeh',
    category: 'portrait',
    isPro: false,
    badge: 'Pro Cam',
    accentColor: '#f43f5e',
    // Riset Before/After Lemon8 & Pro Portrait: wajah bening cerah merona (Red/Orange HSL),
    // daun/latar emerald gelap + depth falloff tanpa menggelapkan meja depan + sedikit bokeh optik
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
    accentColor: '#0ea5e9',
    // Korean Café: putih bersih, redupkan kuning lampu & kayu oranye, shadow cyan lembut, kulit cerah bersih
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
    accentColor: '#38bdf8',
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
    accentColor: '#d97706',
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
    accentColor: '#10b981',
    // Terinspirasi Fuji Pro 400H: highlight lembut, hijau mint-emerald sejuk, shadow cyan halus
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
    accentColor: '#6366f1',
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

  // === PRO PRESETS (Unlock via Lynk.id) ===
  {
    id: 'velvet-merona',
    name: 'Velvet Merona',
    category: 'portrait',
    isPro: true,
    badge: 'Pro',
    accentColor: '#ec4899',
    // Versi lebih dramatis: latar belakang lebih gelap moody + bokeh lembut + bibir & pipi merona glowing
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
    accentColor: '#0284c7',
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
    accentColor: '#67e8f9',
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
    accentColor: '#3b82f6',
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
    accentColor: '#22c55e',
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
    accentColor: '#b45309',
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
    accentColor: '#f59e0b',
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
    accentColor: '#14b8a6',
    // Terinspirasi Fujifilm Classic Chrome: warna muted elegan, hijau kalem kebiruan, shadow slate sejuk
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
    accentColor: '#eab308',
    // Terinspirasi Kodak Gold 200: highlight keemasan hangat, shadow matte lembut, tone kulit hangat nostalgia
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
    accentColor: '#fb7185',
    // Terinspirasi Kodak Portra 400: skin tone lembut bercahaya, highlight halus, hijau sage analog
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
    accentColor: '#94a3b8',
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
    accentColor: '#ec4899',
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
    accentColor: '#06b6d4',
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
  }
];
