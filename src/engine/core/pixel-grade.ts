import { ColorRecipe, HslBandAdjustment, HslMix, ManualAdjustments } from '../../types';
import {
  blurFloatMap,
  computePortraitMaskFromRgba,
  computeSkinWeight,
  PortraitMaskResult,
  sampleMask,
  smoothstep
} from '../analysis/portrait-mask';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * C1-continuous soft highlight compression above 0.84 so boosted pixels never clip into harsh flat blocks.
 */
export const softHighlightRoll = (v: number): number => {
  if (v <= 0) return 0;
  if (v <= 0.84) return v;
  const t = (v - 0.84) / 0.16;
  return 0.84 + 0.16 * (t / (1 + t));
};

const ZERO_BAND: HslBandAdjustment = { h: 0, s: 0, l: 0 };

function scaleHslBand(band: HslBandAdjustment | undefined, k: number): HslBandAdjustment {
  if (!band) return ZERO_BAND;
  return { h: band.h * k, s: band.s * k, l: band.l * k };
}

export function buildEffectiveHsl(hsl: Partial<HslMix> | undefined, k: number): HslMix | undefined {
  if (!hsl || k <= 0) return undefined;
  const red = scaleHslBand(hsl.red, k);
  const orange = scaleHslBand(hsl.orange, k);
  const yellow = scaleHslBand(hsl.yellow, k);
  const green = scaleHslBand(hsl.green, k);
  const aqua = scaleHslBand(hsl.aqua, k);
  const blue = scaleHslBand(hsl.blue, k);

  const anyActive = [red, orange, yellow, green, aqua, blue].some(
    (b) => Math.abs(b.h) > 0.05 || Math.abs(b.s) > 0.05 || Math.abs(b.l) > 0.05
  );
  if (!anyActive) return undefined;
  return { red, orange, yellow, green, aqua, blue };
}

/**
 * Canonical single-source-of-truth recipe merger used by both WebGL2 GPU and Canvas2D CPU renderers.
 */
export function buildEffectiveRecipe(
  recipe: ColorRecipe,
  intensity: number,
  manual: ManualAdjustments
): ColorRecipe {
  const k = Math.max(0, Math.min(100, intensity)) / 100;
  return {
    exposure: recipe.exposure * k + manual.exposure,
    contrast: recipe.contrast * k + manual.contrast,
    highlights: recipe.highlights * k,
    shadows: recipe.shadows * k,
    whites: recipe.whites * k,
    blacks: recipe.blacks * k,
    dehaze: recipe.dehaze * k,
    sharpen: recipe.sharpen * k,
    temperature: recipe.temperature * k + manual.temperature,
    tint: recipe.tint * k,
    saturation: recipe.saturation * k + manual.saturation,
    vibrance: recipe.vibrance * k,
    shadowCyan: recipe.shadowCyan * k,
    shadowWarm: recipe.shadowWarm * k,
    skinBright: recipe.skinBright * k,
    skinRosy: Math.min(45, recipe.skinRosy * k + manual.skinRosy),
    bgDarken: Math.min(55, recipe.bgDarken * k + manual.bgDarken),
    bgBokeh: Math.min(45, recipe.bgBokeh * k + manual.bgBokeh),
    fade: recipe.fade * k,
    grain: Math.min(45, recipe.grain * k + manual.grain),
    vignette: recipe.vignette * k,
    hsl: buildEffectiveHsl(recipe.hsl, k)
  };
}

export function isNeutralRecipe(recipe: ColorRecipe): boolean {
  if (recipe.hsl) return false;
  return Object.entries(recipe).every(
    ([key, val]) => key === 'hsl' || typeof val !== 'number' || Math.abs(val) < 0.01
  );
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function applyHslMix(r: number, g: number, b: number, hsl: HslMix): [number, number, number] {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const d = maxC - minC;
  if (d < 1e-5) return [r, g, b];

  const l = (maxC + minC) * 0.5;
  const s = l > 0.5 ? d / Math.max(1e-5, 2 - maxC - minC) : d / Math.max(1e-5, maxC + minC);

  const guard = smoothstep(0.025, 0.13, s) * smoothstep(0.04, 0.14, l) * (1 - smoothstep(0.9, 0.98, l));
  if (guard <= 0.001) return [r, g, b];

  let h6 = 0;
  if (maxC === r) h6 = ((g - b) / d) % 6;
  else if (maxC === g) h6 = (b - r) / d + 2;
  else h6 = (r - g) / d + 4;
  if (h6 < 0) h6 += 6;
  const hue = h6 * 60;

  let b0: HslBandAdjustment;
  let b1: HslBandAdjustment;
  let t = 0;

  if (hue < 28) {
    b0 = hsl.red;
    b1 = hsl.orange;
    t = smoothstep(0, 28, hue);
  } else if (hue < 58) {
    b0 = hsl.orange;
    b1 = hsl.yellow;
    t = smoothstep(28, 58, hue);
  } else if (hue < 115) {
    b0 = hsl.yellow;
    b1 = hsl.green;
    t = smoothstep(58, 115, hue);
  } else if (hue < 180) {
    b0 = hsl.green;
    b1 = hsl.aqua;
    t = smoothstep(115, 180, hue);
  } else if (hue < 235) {
    b0 = hsl.aqua;
    b1 = hsl.blue;
    t = smoothstep(180, 235, hue);
  } else if (hue < 295) {
    b0 = hsl.blue;
    b1 = ZERO_BAND;
    t = smoothstep(235, 295, hue);
  } else {
    b0 = ZERO_BAND;
    b1 = hsl.red;
    t = smoothstep(322, 360, hue);
  }

  const hAdj = b0.h + (b1.h - b0.h) * t;
  const sAdj = b0.s + (b1.s - b0.s) * t;
  const lAdj = b0.l + (b1.l - b0.l) * t;

  if (Math.abs(hAdj) < 0.02 && Math.abs(sAdj) < 0.02 && Math.abs(lAdj) < 0.02) {
    return [r, g, b];
  }

  let hNew = (hue + hAdj * 0.72 * guard) % 360;
  if (hNew < 0) hNew += 360;

  const sNew = clamp01(s * (1 + (sAdj / 55) * guard));

  let lNew = l;
  if (lAdj > 0) {
    lNew = clamp01(l + (lAdj / 100) * 0.3 * guard * (0.35 + 0.65 * (1 - l)));
  } else if (lAdj < 0) {
    lNew = clamp01(l * (1 + (lAdj / 100) * 0.56 * guard));
  }

  if (sNew < 1e-5) return [lNew, lNew, lNew];

  const q = lNew < 0.5 ? lNew * (1 + sNew) : lNew + sNew - lNew * sNew;
  const p = 2 * lNew - q;
  const hk = hNew / 360;

  return [
    hue2rgb(p, q, hk + 1 / 3),
    hue2rgb(p, q, hk),
    hue2rgb(p, q, hk - 1 / 3)
  ];
}

export function createBokehBuffer(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  subjectMask: Float32Array,
  mw: number,
  mh: number,
  radiusPx: number
): { bw: number; bh: number; rgb: Float32Array } {
  const scale = Math.max(w, h) > 220 ? 0.5 : 1;
  const bw = Math.max(16, Math.round(w * scale));
  const bh = Math.max(16, Math.round(h * scale));
  const count = bw * bh;

  const chR = new Float32Array(count);
  const chG = new Float32Array(count);
  const chB = new Float32Array(count);
  const chW = new Float32Array(count);

  for (let by = 0; by < bh; by++) {
    const sy = Math.min(h - 1, Math.round((by + 0.5) * (h / bh)));
    const ny = sy / h;
    for (let bx = 0; bx < bw; bx++) {
      const sx = Math.min(w - 1, Math.round((bx + 0.5) * (w / bw)));
      const p = (sy * w + sx) * 4;
      const r = data[p] / 255;
      const g = data[p + 1] / 255;
      const b = data[p + 2] / 255;
      const subj = sampleMask(subjectMask, mw, mh, sx / w, ny);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const bloom = 1 + 0.55 * smoothstep(0.68, 0.96, lum);
      const wt = Math.max(0.06, 1 - subj * 0.94) * bloom;

      const idx = by * bw + bx;
      chR[idx] = r * wt;
      chG[idx] = g * wt;
      chB[idx] = b * wt;
      chW[idx] = wt;
    }
  }

  const scaledR = Math.max(1, Math.round(radiusPx * scale));
  const bR = blurFloatMap(chR, bw, bh, scaledR, 2);
  const bG = blurFloatMap(chG, bw, bh, scaledR, 2);
  const bB = blurFloatMap(chB, bw, bh, scaledR, 2);
  const bW = blurFloatMap(chW, bw, bh, scaledR, 2);

  const rgb = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const inv = 1 / Math.max(1e-4, bW[i]);
    const o = i * 3;
    rgb[o] = clamp01(bR[i] * inv);
    rgb[o + 1] = clamp01(bG[i] * inv);
    rgb[o + 2] = clamp01(bB[i] * inv);
  }

  return { bw, bh, rgb };
}

function sampleBokehRgb(
  buf: { bw: number; bh: number; rgb: Float32Array },
  nx: number,
  ny: number
): [number, number, number] {
  const gx = clamp01(nx) * (buf.bw - 1);
  const gy = clamp01(ny) * (buf.bh - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = x0 + 1 < buf.bw ? x0 + 1 : x0;
  const y1 = y0 + 1 < buf.bh ? y0 + 1 : y0;
  const fx = gx - x0;
  const fy = gy - y0;

  const i00 = (y0 * buf.bw + x0) * 3;
  const i10 = (y0 * buf.bw + x1) * 3;
  const i01 = (y1 * buf.bw + x0) * 3;
  const i11 = (y1 * buf.bw + x1) * 3;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  return [
    buf.rgb[i00] * w00 + buf.rgb[i10] * w10 + buf.rgb[i01] * w01 + buf.rgb[i11] * w11,
    buf.rgb[i00 + 1] * w00 + buf.rgb[i10 + 1] * w10 + buf.rgb[i01 + 1] * w01 + buf.rgb[i11 + 1] * w11,
    buf.rgb[i00 + 2] * w00 + buf.rgb[i10 + 2] * w10 + buf.rgb[i01 + 2] * w01 + buf.rgb[i11 + 2] * w11
  ];
}

function sampleSkinSmoothAndEdge(
  origData: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  step: number,
  r0: number,
  g0: number,
  b0: number
): { sr: number; sg: number; sb: number; edgeMag: number } {
  const lum0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
  const rangeInv = 1 / 0.1;

  let sumR = r0;
  let sumG = g0;
  let sumB = b0;
  let sumW = 1;

  const lumAt = (nx: number, ny: number): number => {
    const cx = nx < 0 ? 0 : nx >= w ? w - 1 : nx;
    const cy = ny < 0 ? 0 : ny >= h ? h - 1 : ny;
    const p = (cy * w + cx) * 4;
    return (0.299 * origData[p] + 0.587 * origData[p + 1] + 0.114 * origData[p + 2]) / 255;
  };

  const lL = lumAt(x - step, y);
  const lR = lumAt(x + step, y);
  const lU = lumAt(x, y - step);
  const lD = lumAt(x, y + step);
  const edgeMag = Math.abs(lL - lR) + Math.abs(lU - lD);

  const s1 = step;
  const s2 = step * 2;
  const offsets: [number, number][] = [
    [-s1, 0], [s1, 0], [0, -s1], [0, s1],
    [-s1, -s1], [s1, -s1], [-s1, s1], [s1, s1],
    [-s2, 0], [s2, 0], [0, -s2], [0, s2]
  ];

  for (let i = 0; i < offsets.length; i++) {
    const nx = x + offsets[i][0];
    const ny = y + offsets[i][1];
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    const p = (ny * w + nx) * 4;
    const nr = origData[p] / 255;
    const ng = origData[p + 1] / 255;
    const nb = origData[p + 2] / 255;
    const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const diff = Math.abs(nLum - lum0) + Math.abs(nr - r0) * 0.45;
    const wt = Math.max(0, 1 - diff * rangeInv);
    const wtSq = wt * wt;
    if (wtSq > 0) {
      sumR += nr * wtSq;
      sumG += ng * wtSq;
      sumB += nb * wtSq;
      sumW += wtSq;
    }
  }

  const inv = 1 / sumW;
  return { sr: sumR * inv, sg: sumG * inv, sb: sumB * inv, edgeMag };
}

export interface PixelGradeOptions {
  portraitMask?: Pick<PortraitMaskResult, 'mw' | 'mh' | 'mask'> | null;
  includeGrain?: boolean;
}

/**
 * Pure, DOM-free RGBA pixel-buffer processor (runs identically on main thread and inside Web Workers).
 */
export function applyRecipeToPixelBuffer(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  recipe: ColorRecipe,
  options?: PixelGradeOptions
): void {
  if (isNeutralRecipe(recipe)) return;

  const needsPortraitMask = recipe.bgDarken > 0.25 || recipe.bgBokeh > 0.25;
  let portraitInfo: Pick<PortraitMaskResult, 'mw' | 'mh' | 'mask'> | null =
    options?.portraitMask ?? null;
  if (needsPortraitMask && !portraitInfo) {
    portraitInfo = computePortraitMaskFromRgba(data, w, h);
  }

  const minDim = Math.min(w, h);
  const bokehRadius = Math.max(1, (recipe.bgBokeh / 40) * minDim * 0.0052);
  const bokehBuf =
    portraitInfo && recipe.bgBokeh > 0.5
      ? createBokehBuffer(data, w, h, portraitInfo.mask, portraitInfo.mw, portraitInfo.mh, bokehRadius)
      : null;

  const skinSmoothStrength = Math.min(0.46, (recipe.skinRosy / 45) * 0.46);
  const sharpenAmt = clamp01(recipe.sharpen / 35);
  const needsOrigCopy = skinSmoothStrength > 0.015 || sharpenAmt > 0.015;
  const origData = needsOrigCopy ? new Uint8ClampedArray(data) : null;
  const skinStep = Math.max(1, Math.round(minDim / 520));

  const dehazeK = clamp01(recipe.dehaze / 50) * 0.34;
  const expMult = Math.pow(2, recipe.exposure / 55);
  const contrastAmt = Math.max(-0.48, Math.min(0.48, (recipe.contrast + recipe.dehaze * 0.22) / 92));
  const hlFactor = recipe.highlights / 100;
  const shFactor = recipe.shadows / 100;
  const whiteFactor = recipe.whites / 100;
  const blackFactor = recipe.blacks / 100;

  const tempR = (recipe.temperature * 0.62) / 255;
  const tempB = (-recipe.temperature * 0.7) / 255;
  const tintG = (-recipe.tint * 0.52) / 255;
  const tintRB = (recipe.tint * 0.22) / 255;

  const satMult = Math.max(0, 1 + recipe.saturation / 50);
  const vibFactor = recipe.vibrance / 100;
  const sCyan = (recipe.shadowCyan * 0.62) / 255;
  const sWarm = (recipe.shadowWarm * 0.58) / 255;
  const skinBoost = (recipe.skinBright * 0.42) / 255;
  const rosyAmt = clamp01(recipe.skinRosy / 45);
  const bgDarkAmt = clamp01(recipe.bgDarken / 50);
  const bokehAmtScale = clamp01(recipe.bgBokeh / 26);
  const fadeLift = (recipe.fade * 0.82) / 255;
  const grainAmt = options?.includeGrain === false ? 0 : (recipe.grain * 1.1) / 255;
  const vigStrength = recipe.vignette / 100;

  const hslMix = recipe.hsl && buildEffectiveHsl(recipe.hsl, 1);

  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const invMaxDistSq = 1 / (halfW * halfW + halfH * halfH);
  const invW = 1 / w;
  const invH = 1 / h;

  for (let y = 0; y < h; y++) {
    const ny = (y + 0.5) * invH;
    const dy = y - halfH;
    const dySq = dy * dy;
    const depthFade = 1 - 0.78 * smoothstep(0.68, 0.94, ny);

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = data[idx] / 255;
      let g = data[idx + 1] / 255;
      let b = data[idx + 2] / 255;

      // 0a. Portrait mask & optical bokeh depth blend
      let subj = 1;
      let effBgMask = 0;
      if (portraitInfo) {
        subj = sampleMask(portraitInfo.mask, portraitInfo.mw, portraitInfo.mh, (x + 0.5) * invW, ny);
        effBgMask = (1 - subj) * depthFade;
      }

      // 0b. Edge-preserving skin smoothing & foreground luminance micro-sharpening
      if (origData) {
        const rawLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const rawSkinW = computeSkinWeight(r, g, b);
        let smoothApplied = 0;

        if (skinSmoothStrength > 0.015 && rawSkinW > 0.04) {
          const { sr, sg, sb, edgeMag } = sampleSkinSmoothAndEdge(origData, w, h, x, y, skinStep, r, g, b);
          const edgeKeep = 1 - smoothstep(0.06, 0.16, edgeMag);
          smoothApplied = rawSkinW * skinSmoothStrength * edgeKeep;
          r += (sr - r) * smoothApplied;
          g += (sg - g) * smoothApplied;
          b += (sb - b) * smoothApplied;
        }

        if (sharpenAmt > 0.015 && effBgMask < 0.45) {
          const lx0 = x - skinStep < 0 ? 0 : x - skinStep;
          const lx1 = x + skinStep >= w ? w - 1 : x + skinStep;
          const ly0 = y - skinStep < 0 ? 0 : y - skinStep;
          const ly1 = y + skinStep >= h ? h - 1 : y + skinStep;
          const pL = (y * w + lx0) * 4;
          const pR = (y * w + lx1) * 4;
          const pU = (ly0 * w + x) * 4;
          const pD = (ly1 * w + x) * 4;
          const avgL =
            (0.299 * (origData[pL] + origData[pR] + origData[pU] + origData[pD]) +
              0.587 * (origData[pL + 1] + origData[pR + 1] + origData[pU + 1] + origData[pD + 1]) +
              0.114 * (origData[pL + 2] + origData[pR + 2] + origData[pU + 2] + origData[pD + 2])) /
            (4 * 255);
          const rawDetail = rawLum - avgL;
          const clampedDetail = Math.max(-0.055, Math.min(0.055, rawDetail));
          const fgSharpW = (1 - effBgMask * 2.2) * (1 - smoothApplied * 1.4);
          if (fgSharpW > 0) {
            const dAdd = clampedDetail * sharpenAmt * 0.72 * fgSharpW;
            r = clamp01(r + dAdd);
            g = clamp01(g + dAdd);
            b = clamp01(b + dAdd);
          }
        }
      }

      if (bokehBuf && effBgMask > 0.18) {
        const [br, bg, bb] = sampleBokehRgb(bokehBuf, (x + 0.5) * invW, ny);
        const bMix = Math.min(1, bokehAmtScale * smoothstep(0.18, 0.86, effBgMask));
        r += (br - r) * bMix;
        g += (bg - g) * bMix;
        b += (bb - b) * bMix;
      }

      // 1. Smooth Dehaze (monotonic toe curve in [0, 1])
      if (dehazeK > 0) {
        const omr = 1 - r;
        const omg = 1 - g;
        const omb = 1 - b;
        r *= 1 - dehazeK * omr * omr;
        g *= 1 - dehazeK * omg * omg;
        b *= 1 - dehazeK * omb * omb;
      }

      // 2. Exposure with soft highlight rolloff
      if (expMult !== 1) {
        r = softHighlightRoll(r * expMult);
        g = softHighlightRoll(g * expMult);
        b = softHighlightRoll(b * expMult);
      }

      // 3. Luminance-aware Highlights, Shadows, Whites, Blacks
      let lum = clamp01(0.299 * r + 0.587 * g + 0.114 * b);
      if (shFactor !== 0 && lum > 1e-4) {
        const shadowMask = (1 - lum) * (1 - lum);
        if (shFactor > 0) {
          const lift = shFactor * 0.24 * Math.sqrt(lum) * shadowMask;
          const scale = (lum + lift) / lum;
          r = softHighlightRoll(r * scale);
          g = softHighlightRoll(g * scale);
          b = softHighlightRoll(b * scale);
        } else {
          const drop = 1 + shFactor * 0.34 * shadowMask;
          r *= drop;
          g *= drop;
          b *= drop;
        }
      }
      if (hlFactor !== 0) {
        const hlMask = lum * lum;
        if (hlFactor < 0) {
          const pull = 1 + hlFactor * 0.36 * hlMask;
          r *= pull;
          g *= pull;
          b *= pull;
        } else {
          const lift = hlFactor * 0.16 * hlMask;
          r = softHighlightRoll(r + lift);
          g = softHighlightRoll(g + lift);
          b = softHighlightRoll(b + lift);
        }
      }
      if (whiteFactor !== 0) {
        const wMask = smoothstep(0.45, 1, lum);
        if (whiteFactor > 0) {
          const add = whiteFactor * 0.14 * wMask;
          r = softHighlightRoll(r + add);
          g = softHighlightRoll(g + add);
          b = softHighlightRoll(b + add);
        } else {
          const pull = 1 + whiteFactor * 0.25 * wMask;
          r *= pull;
          g *= pull;
          b *= pull;
        }
      }
      if (blackFactor !== 0) {
        const bMask = (1 - lum) * (1 - lum);
        if (blackFactor < 0) {
          const drop = 1 + blackFactor * 0.58 * bMask;
          r *= drop;
          g *= drop;
          b *= drop;
        } else {
          const lift = blackFactor * 0.14 * bMask * (1 - lum);
          r = clamp01(r + lift);
          g = clamp01(g + lift);
          b = clamp01(b + lift);
        }
      }

      // 4. Smooth Monotonic S-Curve Contrast
      if (contrastAmt !== 0) {
        const k = contrastAmt * 1.6;
        r = clamp01(r + k * r * (1 - r) * (2 * r - 1));
        g = clamp01(g + k * g * (1 - g) * (2 * g - 1));
        b = clamp01(b + k * b * (1 - b) * (2 * b - 1));
      }

      // 5. 6-Band HSL Color Mix (Red, Orange, Yellow, Green, Aqua, Blue)
      if (hslMix) {
        [r, g, b] = applyHslMix(r, g, b, hslMix);
      }

      const skinWeight = computeSkinWeight(r, g, b);
      lum = clamp01(0.299 * r + 0.587 * g + 0.114 * b);

      // 6. Portrait-aware Background Darkening (upper/distant background, protecting foreground tables & subject)
      if (bgDarkAmt > 0 && portraitInfo) {
        if (effBgMask > 0.01) {
          const bgExposure = 1 - bgDarkAmt * 0.62 * effBgMask;
          const bgHighlightTame = 1 - bgDarkAmt * 0.26 * effBgMask * smoothstep(0.38, 0.92, lum);
          const factor = bgExposure * bgHighlightTame;
          r *= factor;
          g *= factor;
          b *= factor;

          const bgGray = 0.299 * r + 0.587 * g + 0.114 * b;
          const bgDesat = bgDarkAmt * effBgMask * 0.28;
          r += (bgGray - r) * bgDesat;
          g += (bgGray - g) * bgDesat;
          b += (bgGray - b) * bgDesat;
        }
        if (subj > 0.15) {
          const pop = 1 + bgDarkAmt * 0.06 * subj * (1 - lum * 0.5);
          r = softHighlightRoll(r * pop);
          g = softHighlightRoll(g * pop);
          b = softHighlightRoll(b * pop);
        }
      }

      // 7. White Balance (skin & darkened background protected)
      const wbScale = (1 - skinWeight * (0.45 + rosyAmt * 0.22)) * (1 - bgDarkAmt * effBgMask * 0.5);
      r = clamp01(r + (tempR + tintRB) * wbScale);
      g = clamp01(g + tintG * wbScale);
      b = clamp01(b + (tempB + tintRB) * wbScale);

      // 8. Split-toning (guarded away from pure black & skin tones)
      const shadowToneGuard = smoothstep(0.02, 0.14, lum);
      const shadowWeight = Math.pow(1 - lum, 1.35) * (1 - skinWeight * 0.72) * shadowToneGuard;
      if (sCyan > 0) {
        r = clamp01(r - sCyan * 0.52 * shadowWeight);
        g = clamp01(g + sCyan * 0.3 * shadowWeight);
        b = clamp01(b + sCyan * 0.58 * shadowWeight);
      }
      if (sWarm > 0) {
        r = clamp01(r + sWarm * 0.52 * shadowWeight);
        g = clamp01(g + sWarm * 0.22 * shadowWeight);
        b = clamp01(b - sWarm * 0.42 * shadowWeight);
      }

      // 9. Clean Skin Brightening & Healthy Rosy Flush ("Wajah Merona")
      if (skinWeight > 0) {
        if (skinBoost > 0) {
          const hlProtect = 1 - 0.58 * smoothstep(0.62, 0.94, lum);
          const boost = skinBoost * skinWeight * hlProtect;
          r = softHighlightRoll(r + boost * 0.98);
          g = softHighlightRoll(g + boost * 0.96);
          b = softHighlightRoll(b + boost * 0.95);
        }

        if (rosyAmt > 0) {
          const midWeight = Math.max(0.25, 4 * lum * (1 - lum));
          const hlRoll = 1 - 0.55 * smoothstep(0.68, 0.96, lum);
          const rw = skinWeight * rosyAmt * hlRoll;

          const lift = 0.065 * rw * (1 - lum * 0.65);
          const yellowCast = Math.max(0, g - b);
          const bDeYellow = yellowCast * 0.3 * rw;

          const naturalWarmth = smoothstep(0.09, 0.23, r - g);
          const blushLift = (0.012 + 0.044 * naturalWarmth) * rw * midWeight;

          r = softHighlightRoll(r + lift + blushLift * 1.12);
          g = softHighlightRoll(g + lift * 0.97 - blushLift * 0.28);
          b = softHighlightRoll(b + lift + bDeYellow + blushLift * 0.32);
        }
      }

      // 10. Bounded Saturation & Vibrance (clamped [0, 1] + dark noise guard)
      r = clamp01(r);
      g = clamp01(g);
      b = clamp01(b);
      if (satMult !== 1 || vibFactor !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const curSat = maxC > 1e-5 ? (maxC - minC) / maxC : 0;
        const darkGuard = smoothstep(0.03, 0.14, gray);
        const bgCalm = 1 - bgDarkAmt * effBgMask * 0.85;
        const vibBoost = vibFactor * (1 - curSat) * (1 - skinWeight * 0.42) * darkGuard * bgCalm;
        const effSat = Math.max(0, satMult * (1 + vibBoost));
        r = clamp01(gray + (r - gray) * effSat);
        g = clamp01(gray + (g - gray) * effSat);
        b = clamp01(gray + (b - gray) * effSat);
      }

      // 11. Matte Film Fade
      if (fadeLift > 0) {
        const scale = 1 - fadeLift;
        r = r * scale + fadeLift;
        g = g * scale + fadeLift;
        b = b * scale + fadeLift;
      }

      // 12. Soft Vignette
      if (vigStrength > 0) {
        const dx = x - halfW;
        const distNorm = Math.min(1, (dx * dx + dySq) * invMaxDistSq);
        const vFactor = 1 - vigStrength * 0.58 * Math.pow(distNorm, 1.15);
        r *= vFactor;
        g *= vFactor;
        b *= vFactor;
      }

      // 13. Midtone-weighted 2D spatial film grain
      if (grainAmt > 0) {
        const pLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const midFade = 4 * pLum * (1 - pLum);
        let hVal = ((x * 374761393 + y * 668265263) ^ 0x5bf03635) | 0;
        hVal = Math.imul(hVal ^ (hVal >>> 13), 1274126177);
        hVal = (hVal ^ (hVal >>> 16)) >>> 0;
        const noise = ((hVal / 4294967295) - 0.5) * grainAmt * midFade;
        r += noise;
        g += noise;
        b += noise;
      }

      data[idx] = clamp255(Math.round(r * 255));
      data[idx + 1] = clamp255(Math.round(g * 255));
      data[idx + 2] = clamp255(Math.round(b * 255));
    }
  }
}
