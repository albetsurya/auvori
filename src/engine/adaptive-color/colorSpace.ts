/**
 * Color space conversions & smooth math primitives for Adaptive Color Correction.
 * Pure, DOM-free functions shared by analyzer, solver, and pixel renderer.
 */

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function finiteOr(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Exact IEC 61966-2-1 sRGB -> linear RGB transfer function.
 */
export function srgbToLinear(c: number): number {
  const x = clamp01(c);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/**
 * Exact IEC 61966-2-1 linear RGB -> sRGB transfer function.
 */
export function linearToSrgb(c: number): number {
  const x = clamp01(c);
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

/**
 * Rec.709 luminance for linear RGB channels.
 */
export function linearLuminance(rLin: number, gLin: number, bLin: number): number {
  return clamp01(0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin);
}

/**
 * Ratio-preserving soft highlight roll-off above knee (default 0.74) in [0, 1].
 * Prevents harsh channel clipping and hue shifts in bright highlights.
 */
export function softHighlightCompress(v: number, knee = 0.74): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (v <= knee) return v;
  const span = 1 - knee;
  const t = (v - knee) / Math.max(1e-5, span);
  return knee + span * (t / (1 + t));
}

export interface HsvColor {
  h: number; // [0, 360)
  s: number; // [0, 1]
  v: number; // [0, 1]
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const d = maxC - minC;
  const s = maxC > 1e-5 ? d / maxC : 0;

  let h = 0;
  if (d > 1e-5) {
    if (maxC === r) h = ((g - b) / d) % 6;
    else if (maxC === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    if (h < 0) h += 6;
    h *= 60;
  }

  return { h, s, v: maxC };
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  if (s <= 1e-5) return [v, v, v];
  const hn = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = v - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hn < 60) {
    rp = c;
    gp = x;
  } else if (hn < 120) {
    rp = x;
    gp = c;
  } else if (hn < 180) {
    gp = c;
    bp = x;
  } else if (hn < 240) {
    gp = x;
    bp = c;
  } else if (hn < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return [clamp01(rp + m), clamp01(gp + m), clamp01(bp + m)];
}
