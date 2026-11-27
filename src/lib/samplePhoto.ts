/**
 * Sample Photo Library — Phase 6.3 Production Visual Asset Integration
 *
 * Real CC0-verified photographic assets from the Auvori Open-Source Photo Dataset.
 * All images are served from /public/assets/ as optimized static bundles.
 *
 * License: CC0 1.0 Universal (verified per PHASE6_1_LICENSE_VERIFICATION.md)
 * Attribution: See public/assets/attribution/PHOTO_CREDITS.md
 *
 * Legacy synthetic SamplePhotoId ('cafe' | 'park' | 'window') is preserved for
 * backward compatibility with any persisted recent-edit records and existing editor flow.
 * Real photo IDs use the 'real:' prefix namespace.
 */

// ─── Legacy synthetic IDs (backward compat) ───────────────────────────────────
export type LegacySamplePhotoId = 'cafe' | 'park' | 'window';

// ─── Real photo IDs ────────────────────────────────────────────────────────────
export type RealSamplePhotoId =
  | 'real:daylight_portrait'
  | 'real:indoor_portrait'
  | 'real:deep_skin'
  | 'real:cafe_interior'
  | 'real:food'
  | 'real:night_street'
  | 'real:neon'
  | 'real:analog_scene'
  | 'real:monochrome';

export type SignatureLookSampleId =
  | 'sig:porcelain-bloom'
  | 'sig:velvet-noir'
  | 'sig:hannam-daylight'
  | 'sig:amber-halation'
  | 'sig:silver-gelatin';

export type SamplePhotoId = LegacySamplePhotoId | RealSamplePhotoId | SignatureLookSampleId;

export function isRealSampleId(id: SamplePhotoId): id is RealSamplePhotoId {
  return (id as string).startsWith('real:');
}

export function isSignatureSampleId(id: SamplePhotoId): id is SignatureLookSampleId {
  return (id as string).startsWith('sig:');
}

// ─── Collection cover asset paths ─────────────────────────────────────────────
export const COLLECTION_COVERS: Record<string, string> = {
  'rosy-portrait': '/assets/collections/cover_rosy_portrait.webp',
  'velvet-series': '/assets/collections/cover_velvet_series.webp',
  'seoul-editorial': '/assets/collections/cover_seoul_editorial.webp',
  'analog-archive': '/assets/collections/cover_analog_archive.webp',
};

// ─── Signature Look preset-rendered preview metadata ──────────────────────────
export interface SignatureLookPreviewMeta {
  presetId: string;
  sampleId: SignatureLookSampleId;
  title: string;
  previewPath: string;
  sourcePath: string;
  objectPosition: string;
  sourcePhotoId: string;
  creator: string;
}

export const SIGNATURE_LOOK_PREVIEWS: Record<string, SignatureLookPreviewMeta> = {
  'porcelain-bloom': {
    presetId: 'porcelain-bloom',
    sampleId: 'sig:porcelain-bloom',
    title: 'Porcelain Bloom',
    previewPath: '/assets/signature-looks/look_porcelain_bloom.webp',
    sourcePath: '/assets/signature-looks/source_porcelain_bloom.webp',
    objectPosition: '50% 25%',
    sourcePhotoId: 'p6_09',
    creator: 'Hisu Lee'
  },
  'velvet-noir': {
    presetId: 'velvet-noir',
    sampleId: 'sig:velvet-noir',
    title: 'Velvet Noir',
    previewPath: '/assets/signature-looks/look_velvet_noir.webp',
    sourcePath: '/assets/signature-looks/source_velvet_noir.webp',
    objectPosition: '50% 35%',
    sourcePhotoId: 'p6_01',
    creator: 'Dan Bøțan'
  },
  'hannam-daylight': {
    presetId: 'hannam-daylight',
    sampleId: 'sig:hannam-daylight',
    title: 'Hannam Daylight',
    previewPath: '/assets/signature-looks/look_hannam_daylight.webp',
    sourcePath: '/assets/signature-looks/source_hannam_daylight.webp',
    objectPosition: '50% 50%',
    sourcePhotoId: 'p6_14',
    creator: 'Sergey Zolkin'
  },
  'amber-halation': {
    presetId: 'amber-halation',
    sampleId: 'sig:amber-halation',
    title: 'Amber Halation',
    previewPath: '/assets/signature-looks/look_amber_halation.webp',
    sourcePath: '/assets/signature-looks/source_amber_halation.webp',
    objectPosition: '55% 50%',
    sourcePhotoId: 'p6_55',
    creator: 'Juan Ignacio Tapia'
  },
  'silver-gelatin': {
    presetId: 'silver-gelatin',
    sampleId: 'sig:silver-gelatin',
    title: 'Silver Gelatin',
    previewPath: '/assets/signature-looks/look_silver_gelatin.webp',
    sourcePath: '/assets/signature-looks/source_silver_gelatin.webp',
    objectPosition: '50% 25%',
    sourcePhotoId: 'p6_04',
    creator: 'Angelina Litvin'
  }
};

// ─── Studio Sample metadata ────────────────────────────────────────────────────
export interface StudioSampleMeta {
  id: RealSamplePhotoId;
  title: string;
  subtitle: string;
  scene: string;
  /** WebP thumbnail path (400×500) for browse grid */
  thumbPath: string;
  /** WebP full-preview path (max 1200px) for editor */
  fullPath: string;
  /** Suggested preset to apply when opening in editor */
  suggestedPresetId: string;
  /** Source attribution ID from the open-source photo dataset */
  sourcePhotoId: string;
  /** Creator name (CC0, attribution optional but preserved) */
  creator: string;
}

export const STUDIO_SAMPLES: StudioSampleMeta[] = [
  {
    id: 'real:daylight_portrait',
    title: 'Daylight Portrait',
    subtitle: 'Natural outdoor light',
    scene: 'portrait',
    thumbPath: '/assets/studio-samples/thumb_daylight_portrait.webp',
    fullPath: '/assets/studio-samples/sample_daylight_portrait.webp',
    suggestedPresetId: 'rosy-bokeh',
    sourcePhotoId: 'p6_07',
    creator: 'Allef Vinicius'
  },
  {
    id: 'real:indoor_portrait',
    title: 'Indoor Portrait',
    subtitle: 'Window-reflected light',
    scene: 'portrait',
    thumbPath: '/assets/studio-samples/thumb_indoor_portrait.webp',
    fullPath: '/assets/studio-samples/sample_indoor_portrait.webp',
    suggestedPresetId: 'porcelain-bloom',
    sourcePhotoId: 'p6_03',
    creator: 'Cayton Heath'
  },
  {
    id: 'real:deep_skin',
    title: 'Studio Skin Tones',
    subtitle: 'Rich tonal depth',
    scene: 'portrait',
    thumbPath: '/assets/studio-samples/thumb_deep_skin.webp',
    fullPath: '/assets/studio-samples/sample_deep_skin.webp',
    suggestedPresetId: 'velvet-merona',
    sourcePhotoId: 'p6_51',
    creator: 'William Stitt'
  },
  {
    id: 'real:cafe_interior',
    title: 'Café Interior',
    subtitle: 'Minimalist indoor light',
    scene: 'interior',
    thumbPath: '/assets/studio-samples/thumb_cafe_interior.webp',
    fullPath: '/assets/studio-samples/sample_cafe_interior.webp',
    suggestedPresetId: 'seoul-cafe',
    sourcePhotoId: 'p6_19',
    creator: 'Pierrick Le Cunff'
  },
  {
    id: 'real:food',
    title: 'Food Scene',
    subtitle: 'Natural restaurant light',
    scene: 'food',
    thumbPath: '/assets/studio-samples/thumb_food.webp',
    fullPath: '/assets/studio-samples/sample_food.webp',
    suggestedPresetId: 'warm-latte',
    sourcePhotoId: 'p6_11',
    creator: 'Nick Clement'
  },
  {
    id: 'real:night_street',
    title: 'Night Street',
    subtitle: 'City bokeh & portraits',
    scene: 'night',
    thumbPath: '/assets/studio-samples/thumb_night_street.webp',
    fullPath: '/assets/studio-samples/sample_night_street.webp',
    suggestedPresetId: 'midnight-clean',
    sourcePhotoId: 'p6_52',
    creator: 'Kevin Lee'
  },
  {
    id: 'real:neon',
    title: 'Neon Portrait',
    subtitle: 'Deep neon character lighting',
    scene: 'night',
    thumbPath: '/assets/studio-samples/thumb_neon.webp',
    fullPath: '/assets/studio-samples/sample_neon.webp',
    suggestedPresetId: 'neon-shibuya',
    sourcePhotoId: 'p6_53',
    creator: 'Matthew Sleeper'
  },
  {
    id: 'real:analog_scene',
    title: 'Analog Scene',
    subtitle: 'Film-ready natural tones',
    scene: 'film',
    thumbPath: '/assets/studio-samples/thumb_analog_scene.webp',
    fullPath: '/assets/studio-samples/sample_analog_scene.webp',
    suggestedPresetId: 'kodak-gold',
    sourcePhotoId: 'p6_30',
    creator: 'Christian Joudrey'
  },
  {
    id: 'real:monochrome',
    title: 'Monochrome Scene',
    subtitle: 'Dramatic tonal range',
    scene: 'landscape',
    thumbPath: '/assets/studio-samples/thumb_monochrome.webp',
    fullPath: '/assets/studio-samples/sample_monochrome.webp',
    suggestedPresetId: 'mono-leica',
    sourcePhotoId: 'p6_24',
    creator: 'David East'
  }
];

// ─── URL resolvers ─────────────────────────────────────────────────────────────

export const LEGACY_TO_REAL_SAMPLE: Record<LegacySamplePhotoId, RealSamplePhotoId> = {
  cafe: 'real:cafe_interior',
  park: 'real:daylight_portrait',
  window: 'real:analog_scene'
};

const PRESET_TO_SAMPLE_MAP: Record<string, RealSamplePhotoId | SignatureLookSampleId> = {
  'porcelain-bloom': 'sig:porcelain-bloom',
  'velvet-noir': 'sig:velvet-noir',
  'hannam-daylight': 'sig:hannam-daylight',
  'amber-halation': 'sig:amber-halation',
  'silver-gelatin': 'sig:silver-gelatin',
  'rosy-bokeh': 'real:daylight_portrait',
  'velvet-merona': 'real:deep_skin',
  'espresso-crisp': 'sig:hannam-daylight',
  'seoul-cafe': 'real:cafe_interior',
  'clean-day': 'real:daylight_portrait',
  'gangnam-glass': 'real:indoor_portrait',
  'tokyo-milk': 'real:analog_scene',
  'busan-breeze': 'real:monochrome',
  'warm-latte': 'sig:hannam-daylight',
  'matcha-house': 'real:cafe_interior',
  'brunch-glow': 'real:food',
  'fuji-soft': 'real:analog_scene',
  'classic-chrome': 'real:monochrome',
  'kodak-gold': 'sig:amber-halation',
  'portra-400': 'real:indoor_portrait',
  'mono-leica': 'sig:silver-gelatin',
  'midnight-clean': 'real:night_street',
  'neon-shibuya': 'real:neon',
  'cinematic-teal': 'real:night_street',
  'direct-flash': 'real:deep_skin',
  'night-cinema': 'real:neon'
};

/**
 * Resolves the real CC0 photographic SamplePhotoId for any preset ID.
 * Never returns a legacy synthetic canvas ID.
 */
export function getPresetSampleId(
  presetId: string,
  fallbackCategory?: string
): RealSamplePhotoId | SignatureLookSampleId {
  const mapped = PRESET_TO_SAMPLE_MAP[presetId];
  if (mapped) return mapped;
  if (fallbackCategory === 'portrait') return 'real:daylight_portrait';
  if (fallbackCategory === 'film') return 'real:analog_scene';
  if (fallbackCategory === 'night') return 'real:night_street';
  return 'real:cafe_interior';
}

/**
 * Returns the full-size asset URL for a given SamplePhotoId.
 * All IDs (including legacy 'cafe'|'park'|'window') resolve to real CC0 WebP assets.
 */
export function getSamplePhotoUrl(id: SamplePhotoId): string {
  if (isRealSampleId(id)) {
    const meta = STUDIO_SAMPLES.find((s) => s.id === id);
    return meta ? meta.fullPath : '';
  }
  if (isSignatureSampleId(id)) {
    const presetId = id.slice(4);
    return SIGNATURE_LOOK_PREVIEWS[presetId]?.sourcePath ?? '';
  }
  const realFallback = LEGACY_TO_REAL_SAMPLE[id] ?? 'real:cafe_interior';
  const meta = STUDIO_SAMPLES.find((s) => s.id === realFallback);
  return meta ? meta.fullPath : '';
}

/**
 * Returns the thumbnail URL for a given SamplePhotoId (for grids and previews).
 */
export function getSampleThumbUrl(id: SamplePhotoId): string {
  if (isRealSampleId(id)) {
    const meta = STUDIO_SAMPLES.find((s) => s.id === id);
    return meta ? meta.thumbPath : '';
  }
  if (isSignatureSampleId(id)) {
    const presetId = id.slice(4);
    return SIGNATURE_LOOK_PREVIEWS[presetId]?.previewPath ?? '';
  }
  const realFallback = LEGACY_TO_REAL_SAMPLE[id] ?? 'real:cafe_interior';
  const meta = STUDIO_SAMPLES.find((s) => s.id === realFallback);
  return meta ? meta.thumbPath : '';
}

/**
 * Returns a human-readable label for a SamplePhotoId.
 */
export function getSamplePhotoLabel(id: SamplePhotoId): string {
  if (isRealSampleId(id)) {
    const meta = STUDIO_SAMPLES.find((s) => s.id === id);
    return meta ? meta.title : id;
  }
  if (isSignatureSampleId(id)) {
    const presetId = id.slice(4);
    return SIGNATURE_LOOK_PREVIEWS[presetId]?.title ?? id;
  }
  const legacyLabels: Record<LegacySamplePhotoId, string> = {
    cafe: 'Café Window',
    park: 'Garden Shade',
    window: 'Golden Hour'
  };
  return legacyLabels[id as LegacySamplePhotoId] ?? id;
}

// ─── LEGACY: Synthetic canvas illustrations (preserved for backward compat) ────
// These are only used when a legacy SamplePhotoId ('cafe'|'park'|'window') is loaded.
// No new production code should reference them.

export interface SamplePhotoMeta {
  id: LegacySamplePhotoId;
  title: string;
  subtitle: string;
}

/** @deprecated Use STUDIO_SAMPLES instead. Retained for backward compat only. */
export const SAMPLE_PHOTOS: SamplePhotoMeta[] = [
  { id: 'cafe', title: 'Café Window', subtitle: 'Soft indoor portrait light' },
  { id: 'park', title: 'Garden Shade', subtitle: 'Lush greenery & portrait tones' },
  { id: 'window', title: 'Golden Hour', subtitle: 'Warm afternoon editorial light' }
];

const syntheticCache: Partial<Record<LegacySamplePhotoId, string>> = {};

/**
 * @deprecated Internal use only — generates legacy canvas-drawn synthetic sample.
 */
export function createSyntheticSampleDataUrl(kind: LegacySamplePhotoId = 'cafe'): string {
  if (syntheticCache[kind]) return syntheticCache[kind]!;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (kind === 'park') {
    const bg = ctx.createLinearGradient(0, 0, 800, 1000);
    bg.addColorStop(0, '#4f6d3a');
    bg.addColorStop(0.5, '#68854b');
    bg.addColorStop(1, '#3c452d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 800, 1000);
    const leafColors = ['#7ea154', '#5b7a3d', '#8fb164', '#43592f'];
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = leafColors[i % leafColors.length];
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      const lx = ((i * 173) % 860) - 30;
      const ly = ((i * 239) % 720) - 20;
      const lr = 55 + ((i * 37) % 65);
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(244, 232, 195, 0.32)';
    for (const [bx, by, br] of [[150, 140, 26], [640, 180, 32], [580, 110, 18], [230, 220, 16]]) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    const jacket = ctx.createLinearGradient(180, 620, 620, 1000);
    jacket.addColorStop(0, '#7c5d49');
    jacket.addColorStop(1, '#584132');
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.ellipse(400, 860, 260, 240, 0, Math.PI, 0);
    ctx.fillRect(140, 850, 520, 160);
    ctx.fill();
    ctx.fillStyle = '#23262d';
    ctx.beginPath();
    ctx.ellipse(400, 440, 152, 185, 0, 0, Math.PI * 2);
    ctx.fill();
    const skin = ctx.createRadialGradient(385, 420, 20, 400, 445, 130);
    skin.addColorStop(0, '#e3beaa');
    skin.addColorStop(1, '#c99e8a');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(400, 448, 96, 118, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(198, 120, 115, 0.28)';
    ctx.beginPath();
    ctx.ellipse(348, 468, 22, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(452, 468, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b9756f';
    ctx.beginPath();
    ctx.ellipse(400, 512, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'window') {
    const wall = ctx.createLinearGradient(0, 0, 800, 1000);
    wall.addColorStop(0, '#d8c9b8');
    wall.addColorStop(0.55, '#cbb69e');
    wall.addColorStop(1, '#8c725c');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 800, 1000);
    ctx.fillStyle = 'rgba(255, 240, 214, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.lineTo(660, 0);
    ctx.lineTo(800, 420);
    ctx.lineTo(0, 680);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f5444';
    ctx.fillRect(0, 640, 800, 360);
    ctx.fillStyle = '#e7dfd5';
    ctx.beginPath();
    ctx.ellipse(270, 610, 74, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e664b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(265, 520);
    ctx.quadraticCurveTo(220, 360, 190, 220);
    ctx.moveTo(275, 520);
    ctx.quadraticCurveTo(330, 340, 375, 190);
    ctx.stroke();
    ctx.fillStyle = '#332c28';
    ctx.beginPath();
    ctx.ellipse(535, 455, 130, 155, 0, 0, Math.PI * 2);
    ctx.fill();
    const skin2 = ctx.createRadialGradient(520, 430, 18, 535, 455, 110);
    skin2.addColorStop(0, '#efd0bc');
    skin2.addColorStop(1, '#d3ab92');
    ctx.fillStyle = skin2;
    ctx.beginPath();
    ctx.ellipse(535, 458, 86, 106, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c47b74';
    ctx.beginPath();
    ctx.ellipse(535, 514, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#53433a';
    ctx.beginPath();
    ctx.ellipse(535, 760, 190, 210, 0, Math.PI, 0);
    ctx.fill();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 800, 1000);
    bg.addColorStop(0, '#c6cfd2');
    bg.addColorStop(0.55, '#9ea8ac');
    bg.addColorStop(1, '#4c3f37');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 800, 1000);
    ctx.fillStyle = '#e5eaec';
    ctx.fillRect(54, 48, 320, 440);
    ctx.fillRect(426, 48, 320, 440);
    ctx.fillStyle = '#759f4b';
    ctx.beginPath();
    ctx.arc(170, 200, 84, 0, Math.PI * 2);
    ctx.arc(250, 230, 68, 0, Math.PI * 2);
    ctx.arc(620, 185, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#474f54';
    ctx.lineWidth = 18;
    ctx.strokeRect(54, 48, 320, 440);
    ctx.strokeRect(426, 48, 320, 440);
    ctx.fillStyle = 'rgba(255, 244, 214, 0.72)';
    for (const [lx, ly, lr] of [[120, 110, 12], [290, 95, 10], [500, 115, 14], [690, 95, 11]]) {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    const table = ctx.createLinearGradient(0, 620, 800, 1000);
    table.addColorStop(0, '#dcd7d1');
    table.addColorStop(1, '#c3bcb4');
    ctx.fillStyle = table;
    ctx.fillRect(0, 620, 800, 380);
    ctx.fillStyle = '#efe9e2';
    ctx.beginPath();
    ctx.roundRect(145, 675, 140, 200, 22);
    ctx.fill();
    ctx.fillStyle = '#b48766';
    ctx.beginPath();
    ctx.roundRect(157, 735, 116, 128, 14);
    ctx.fill();
    ctx.fillStyle = '#f8f6f2';
    ctx.beginPath();
    ctx.ellipse(545, 815, 165, 92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cb8c4d';
    ctx.beginPath();
    ctx.ellipse(545, 805, 102, 52, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#26292e';
    ctx.beginPath();
    ctx.ellipse(400, 630, 155, 175, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(400, 430, 126, 0, Math.PI * 2);
    ctx.fill();
    const skin3 = ctx.createRadialGradient(385, 410, 18, 400, 430, 110);
    skin3.addColorStop(0, '#efc9b2');
    skin3.addColorStop(1, '#d6a98f');
    ctx.fillStyle = skin3;
    ctx.beginPath();
    ctx.ellipse(400, 434, 84, 102, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(205, 122, 118, 0.25)';
    ctx.beginPath();
    ctx.ellipse(354, 452, 20, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(446, 452, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#be7370';
    ctx.beginPath();
    ctx.ellipse(400, 488, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(244, 240, 234, 0.14)';
    ctx.fillRect(0, 0, 800, 1000);
  }

  const url = canvas.toDataURL('image/jpeg', 0.9);
  syntheticCache[kind] = url;
  return url;
}

/**
 * @deprecated Use getSamplePhotoUrl() instead.
 * Retained for backward compatibility with App.tsx handleStartWithSample and existing imports.
 */
export function createSamplePhotoDataUrl(kind: LegacySamplePhotoId = 'cafe'): string {
  return createSyntheticSampleDataUrl(kind);
}
