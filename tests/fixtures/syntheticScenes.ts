export type GoldenSceneId =
  | 'portrait-fair-hijab'
  | 'portrait-deep-skin'
  | 'portrait-hair-merge'
  | 'cafe-interior'
  | 'low-light-night'
  | 'landscape-nature';

export const GOLDEN_SCENE_IDS: GoldenSceneId[] = [
  'portrait-fair-hijab',
  'portrait-deep-skin',
  'portrait-hair-merge',
  'cafe-interior',
  'low-light-night',
  'landscape-nature'
];

function drawSoftOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  colorInner: string,
  colorOuter: string
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colorInner);
  g.addColorStop(1, colorOuter);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFacialFeatures(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  lipColor: string
) {
  // Subtle eyebrows & eyes for bilateral edge-preservation & micro-sharpen verification
  ctx.strokeStyle = 'rgba(26, 20, 18, 0.85)';
  ctx.lineWidth = Math.max(1.2, 2.2 * s);
  ctx.beginPath();
  ctx.moveTo(cx - 18 * s, cy - 11 * s);
  ctx.quadraticCurveTo(cx - 11 * s, cy - 15 * s, cx - 5 * s, cy - 11 * s);
  ctx.moveTo(cx + 5 * s, cy - 11 * s);
  ctx.quadraticCurveTo(cx + 11 * s, cy - 15 * s, cx + 18 * s, cy - 11 * s);
  ctx.stroke();

  ctx.fillStyle = 'rgba(22, 18, 16, 0.92)';
  ctx.beginPath();
  ctx.ellipse(cx - 11 * s, cy - 4 * s, 3.6 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 11 * s, cy - 4 * s, 3.6 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Catchlights
  ctx.fillStyle = 'rgba(255, 250, 245, 0.88)';
  ctx.beginPath();
  ctx.arc(cx - 12 * s, cy - 5 * s, 1 * s, 0, Math.PI * 2);
  ctx.arc(cx + 10 * s, cy - 5 * s, 1 * s, 0, Math.PI * 2);
  ctx.fill();

  // Lips
  ctx.fillStyle = lipColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16 * s, 8.5 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Generates deterministic synthetic Canvas test fixtures covering:
 * - Fair skin + dark hijab + green garden foliage
 * - Deep/tan skin portrait
 * - Dark hair blending into low-contrast dark background
 * - Bright cafe interior with haze & cyan glass shadows
 * - Low-light night scene with dark shadow noise floor & neon lights
 * - Pure landscape with 0% skin pixels
 */
export function createGoldenSceneCanvas(
  scene: GoldenSceneId,
  w = 192,
  h = 240
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const s = w / 192;

  if (scene === 'portrait-fair-hijab') {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#5a6e41');
    bg.addColorStop(0.55, '#3b4e29');
    bg.addColorStop(1, '#26331b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Sunlit foliage speckles & bright leaves for optical bokeh validation
    for (let i = 0; i < 28; i++) {
      const lx = ((i * 53 + 17) % (w + 20)) - 10;
      const ly = ((i * 71 + 11) % (h * 0.72));
      drawSoftOrb(
        ctx,
        lx,
        ly,
        (7 + (i % 6) * 2.5) * s,
        i % 3 === 0 ? 'rgba(232, 238, 175, 0.52)' : 'rgba(92, 128, 56, 0.48)',
        'rgba(55, 78, 34, 0)'
      );
    }

    // Hijab & shoulders
    ctx.fillStyle = '#181a1f';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, 42 * s, 50 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const jacket = ctx.createLinearGradient(w * 0.2, h * 0.62, w * 0.8, h);
    jacket.addColorStop(0, '#6e503f');
    jacket.addColorStop(1, '#493327');
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.94, 72 * s, 68 * s, 0, Math.PI, 0);
    ctx.fill();

    // Fair warm-olive face with subtle texture pores
    const face = ctx.createRadialGradient(w * 0.47, h * 0.39, 6 * s, w * 0.5, h * 0.42, 34 * s);
    face.addColorStop(0, '#f3d4be');
    face.addColorStop(0.65, '#ddb69c');
    face.addColorStop(1, '#b88f76');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.425, 25 * s, 32 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    drawFacialFeatures(ctx, w * 0.5, h * 0.43, s, 'rgba(182, 92, 92, 0.72)');
  } else if (scene === 'portrait-deep-skin') {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#d8cab8');
    bg.addColorStop(0.6, '#b7a48e');
    bg.addColorStop(1, '#7c6b58');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawSoftOrb(ctx, w * 0.22, h * 0.24, 38 * s, 'rgba(255, 240, 210, 0.55)', 'rgba(216, 202, 184, 0)');

    // Hair & outfit
    ctx.fillStyle = '#1b1412';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.38, 40 * s, 44 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dfd8ce';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.96, 70 * s, 72 * s, 0, Math.PI, 0);
    ctx.fill();

    // Neck + Deep warm brown skin tone
    ctx.fillStyle = '#7e523a';
    ctx.fillRect(w * 0.42, h * 0.55, w * 0.16, 28 * s);

    const skin = ctx.createRadialGradient(w * 0.47, h * 0.39, 5 * s, w * 0.5, h * 0.42, 34 * s);
    skin.addColorStop(0, '#ab7354');
    skin.addColorStop(0.65, '#8c5a3e');
    skin.addColorStop(1, '#683f29');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, 25 * s, 32 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    drawFacialFeatures(ctx, w * 0.5, h * 0.43, s, 'rgba(135, 62, 58, 0.78)');
  } else if (scene === 'portrait-hair-merge') {
    // Low-contrast dark olive-charcoal background where hair meets wall
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#282c25');
    bg.addColorStop(0.5, '#1d201a');
    bg.addColorStop(1, '#121410');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Volumetric dark hair close in luminance to wall
    ctx.fillStyle = '#161414';
    ctx.beginPath();
    ctx.ellipse(w * 0.48, h * 0.42, 46 * s, 56 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#262426';
    ctx.beginPath();
    ctx.ellipse(w * 0.48, h * 0.96, 68 * s, 68 * s, 0, Math.PI, 0);
    ctx.fill();

    const skin = ctx.createRadialGradient(w * 0.48, h * 0.39, 5 * s, w * 0.5, h * 0.42, 30 * s);
    skin.addColorStop(0, '#eac1a6');
    skin.addColorStop(0.7, '#c79779');
    skin.addColorStop(1, '#9d6e54');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, 23 * s, 30 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    drawFacialFeatures(ctx, w * 0.5, h * 0.43, s, 'rgba(168, 76, 78, 0.78)');
  } else if (scene === 'cafe-interior') {
    const wall = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    wall.addColorStop(0, '#ece8e1');
    wall.addColorStop(1, '#d3cec6');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h * 0.65);

    // Cool cyan-gray window panels
    ctx.fillStyle = '#bfd0d9';
    ctx.fillRect(14 * s, 16 * s, 74 * s, 96 * s);
    ctx.fillRect(104 * s, 16 * s, 74 * s, 96 * s);
    ctx.strokeStyle = '#5c666c';
    ctx.lineWidth = 4 * s;
    ctx.strokeRect(14 * s, 16 * s, 74 * s, 96 * s);
    ctx.strokeRect(104 * s, 16 * s, 74 * s, 96 * s);

    // Cafe table in foreground
    const table = ctx.createLinearGradient(0, h * 0.64, w, h);
    table.addColorStop(0, '#d6b692');
    table.addColorStop(1, '#b58d64');
    ctx.fillStyle = table;
    ctx.fillRect(0, h * 0.64, w, h * 0.36);

    // Iced latte glass + plate
    ctx.fillStyle = '#c89b6d';
    ctx.fillRect(36 * s, h * 0.67, 26 * s, 42 * s);
    ctx.fillStyle = '#f8f5ef';
    ctx.beginPath();
    ctx.ellipse(126 * s, h * 0.8, 30 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subject seated
    ctx.fillStyle = '#2d323a';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.58, 34 * s, 26 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1d2026';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, 24 * s, 28 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const skin = ctx.createRadialGradient(w * 0.48, h * 0.4, 4 * s, w * 0.5, h * 0.42, 22 * s);
    skin.addColorStop(0, '#f2cdb3');
    skin.addColorStop(0.8, '#d4a688');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, 18 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle atmospheric haze overlay to test dehaze
    ctx.fillStyle = 'rgba(245, 243, 240, 0.14)';
    ctx.fillRect(0, 0, w, h);
  } else if (scene === 'low-light-night') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07090f');
    sky.addColorStop(0.55, '#101422');
    sky.addColorStop(1, '#09090d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Neon highlights & dark shadow pockets (strict test for zero red-speckle clipping)
    drawSoftOrb(ctx, 36 * s, 44 * s, 28 * s, 'rgba(62, 198, 224, 0.72)', 'rgba(62, 198, 224, 0)');
    drawSoftOrb(ctx, 152 * s, 56 * s, 26 * s, 'rgba(244, 102, 134, 0.75)', 'rgba(244, 102, 134, 0)');
    drawSoftOrb(ctx, 118 * s, 96 * s, 18 * s, 'rgba(255, 208, 128, 0.6)', 'rgba(255, 208, 128, 0)');

    // Very dark shadows on bottom & coat
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    ctx.fillStyle = '#111218';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.94, 64 * s, 62 * s, 0, Math.PI, 0);
    ctx.fill();

    // Dimly lit face in night street light
    const skin = ctx.createRadialGradient(w * 0.46, h * 0.42, 4 * s, w * 0.5, h * 0.44, 28 * s);
    skin.addColorStop(0, '#d8a686');
    skin.addColorStop(0.65, '#9d6c52');
    skin.addColorStop(1, '#4c3227');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.44, 21 * s, 27 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    drawFacialFeatures(ctx, w * 0.5, h * 0.45, s * 0.88, 'rgba(148, 62, 68, 0.75)');
  } else if (scene === 'landscape-nature') {
    // 0% skin pixels — exercises heuristic-ellipse fallback cleanly
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.52);
    sky.addColorStop(0, '#5f9ad1');
    sky.addColorStop(0.65, '#a8cee8');
    sky.addColorStop(1, '#e7ece8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.52);

    // Distant blue mountains
    ctx.fillStyle = '#5c788e';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w * 0.28, h * 0.34);
    ctx.lineTo(w * 0.58, h * 0.46);
    ctx.lineTo(w * 0.85, h * 0.31);
    ctx.lineTo(w, h * 0.45);
    ctx.lineTo(w, h * 0.54);
    ctx.lineTo(0, h * 0.54);
    ctx.closePath();
    ctx.fill();

    // Lush green hillside
    const hill = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.74);
    hill.addColorStop(0, '#5a8a3c');
    hill.addColorStop(1, '#315423');
    ctx.fillStyle = hill;
    ctx.fillRect(0, h * 0.48, w, h * 0.25);

    // Aqua lake reflection
    const water = ctx.createLinearGradient(0, h * 0.73, 0, h);
    water.addColorStop(0, '#3a8698');
    water.addColorStop(1, '#1e4658');
    ctx.fillStyle = water;
    ctx.fillRect(0, h * 0.73, w, h * 0.27);

    // Cool granite foreground boulders (0% skin pixels to exercise ellipse heuristic fallback cleanly)
    ctx.fillStyle = '#4e555d';
    ctx.beginPath();
    ctx.ellipse(w * 0.16, h * 0.92, 38 * s, 24 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}
