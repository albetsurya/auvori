import { ColorRecipe, HslBandAdjustment, HslMix, ImageTransform, ManualAdjustments } from '../types';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * C1-continuous soft highlight compression above 0.84 so boosted pixels never clip into harsh flat blocks.
 */
const softHighlightRoll = (v: number): number => {
  if (v <= 0) return 0;
  if (v <= 0.84) return v;
  const t = (v - 0.84) / 0.16;
  return 0.84 + 0.16 * (t / (1 + t));
};

/**
 * Continuous YCbCr skin detector in [0, 1] RGB.
 */
function computeSkinWeight(r: number, g: number, b: number): number {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y <= 0.14 || r <= 0.16) return 0;

  const cb = 0.5 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 0.5 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  const lumW = smoothstep(0.2, 0.36, y);
  const cbW = smoothstep(0.32, 0.375, cb) * (1 - smoothstep(0.475, 0.515, cb));
  const crW = smoothstep(0.51, 0.548, cr) * (1 - smoothstep(0.66, 0.72, cr));
  const sepW = smoothstep(0.045, 0.095, cr - cb);

  return lumW * cbW * crW * sepW;
}

const ZERO_BAND: HslBandAdjustment = { h: 0, s: 0, l: 0 };

function scaleHslBand(band: HslBandAdjustment | undefined, k: number): HslBandAdjustment {
  if (!band) return ZERO_BAND;
  return { h: band.h * k, s: band.s * k, l: band.l * k };
}

function buildEffectiveHsl(hsl: Partial<HslMix> | undefined, k: number): HslMix | undefined {
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

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/**
 * Smooth 6-band Lightroom-style HSL Color Mix (Red, Orange, Yellow, Green, Aqua, Blue).
 * Uses C1 smoothstep interpolation between hue anchors and chroma/luminance guards so grays & shadows stay clean.
 */
function applyHslMix(r: number, g: number, b: number, hsl: HslMix): [number, number, number] {
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

interface PortraitMaskCacheEntry {
  w: number;
  h: number;
  mw: number;
  mh: number;
  mask: Float32Array;
}

const portraitMaskCache = new WeakMap<HTMLImageElement, PortraitMaskCacheEntry>();

/**
 * Separable box blur over a 2D Float32Array (1 channel) with border clamping.
 */
function blurFloatMap(src: Float32Array, w: number, h: number, radius: number, passes = 2): Float32Array {
  const cur = new Float32Array(src);
  const tmp = new Float32Array(w * h);
  const r = Math.max(1, Math.round(radius));
  const invWin = 1 / (r * 2 + 1);

  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const cx = k < 0 ? 0 : k >= w ? w - 1 : k;
        acc += cur[row + cx];
      }
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * invWin;
        const leftIdx = x - r < 0 ? 0 : x - r;
        const rightIdx = x + r + 1 >= w ? w - 1 : x + r + 1;
        acc += cur[row + rightIdx] - cur[row + leftIdx];
      }
    }

    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const cy = k < 0 ? 0 : k >= h ? h - 1 : k;
        acc += tmp[cy * w + x];
      }
      for (let y = 0; y < h; y++) {
        cur[y * w + x] = acc * invWin;
        const topIdx = y - r < 0 ? 0 : y - r;
        const botIdx = y + r + 1 >= h ? h - 1 : y + r + 1;
        acc += tmp[botIdx * w + x] - tmp[topIdx * w + x];
      }
    }
  }

  return cur;
}

/**
 * Estimates a smooth portrait foreground mask [0..1] (1 = subject/face/outfit/hands, 0 = background).
 */
function getPortraitMask(
  source: HTMLImageElement | HTMLCanvasElement,
  data: Uint8ClampedArray,
  w: number,
  h: number
): { mw: number; mh: number; mask: Float32Array } {
  if (source instanceof HTMLImageElement) {
    const cached = portraitMaskCache.get(source);
    if (cached && cached.w === w && cached.h === h) {
      return { mw: cached.mw, mh: cached.mh, mask: cached.mask };
    }
  }

  const maxSide = 112;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const mw = Math.max(16, Math.round(w * scale));
  const mh = Math.max(16, Math.round(h * scale));
  const count = mw * mh;

  const downR = new Float32Array(count);
  const downG = new Float32Array(count);
  const downB = new Float32Array(count);
  const downLum = new Float32Array(count);
  const skinRaw = new Float32Array(count);

  for (let my = 0; my < mh; my++) {
    const y0 = Math.floor((my * h) / mh);
    const y1 = Math.max(y0 + 1, Math.floor(((my + 1) * h) / mh));
    for (let mx = 0; mx < mw; mx++) {
      const x0 = Math.floor((mx * w) / mw);
      const x1 = Math.max(x0 + 1, Math.floor(((mx + 1) * w) / mw));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;
      const stepY = Math.max(1, Math.floor((y1 - y0) / 2));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 2));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const p = (y * w + x) * 4;
          sr += data[p];
          sg += data[p + 1];
          sb += data[p + 2];
          n++;
        }
      }
      const inv = 1 / (255 * Math.max(1, n));
      const r = sr * inv;
      const g = sg * inv;
      const b = sb * inv;
      const idx = my * mw + mx;
      downR[idx] = r;
      downG[idx] = g;
      downB[idx] = b;
      downLum[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
      skinRaw[idx] = computeSkinWeight(r, g, b);
    }
  }

  const skinSm = blurFloatMap(skinRaw, mw, mh, 1, 1);
  let totalSkin = 0;
  for (let i = 0; i < count; i++) totalSkin += skinSm[i];

  const minDim = Math.min(mw, mh);
  const prior = new Float32Array(count);

  if (totalSkin < count * 0.004) {
    const cx = mw * 0.5;
    const cy = mh * 0.54;
    const invRx = 1 / (mw * 0.44);
    const invRy = 1 / (mh * 0.42);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const dx = (x - cx) * invRx;
        const dy = (y - cy) * invRy;
        const d = Math.hypot(dx, dy);
        prior[y * mw + x] = 1 - smoothstep(0.58, 1.18, d);
      }
    }
  } else {
    const faceScoreMap = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      faceScoreMap[i] = skinSm[i] * (0.35 + 0.65 * smoothstep(0.32, 0.72, downLum[i]));
    }
    const densityMap = blurFloatMap(faceScoreMap, mw, mh, Math.max(2, Math.round(minDim * 0.07)), 2);
    let peakIdx = 0;
    let peakScore = -1;
    for (let y = 0; y < mh; y++) {
      const ny = y / mh;
      const upperBias = 1 - 0.72 * smoothstep(0.24, 0.7, ny);
      for (let x = 0; x < mw; x++) {
        const score = densityMap[y * mw + x] * upperBias;
        if (score > peakScore) {
          peakScore = score;
          peakIdx = y * mw + x;
        }
      }
    }

    const px = peakIdx % mw;
    const py = Math.floor(peakIdx / mw);
    const searchR = minDim * 0.18;

    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const d = Math.hypot(x - px, y - py);
        if (d <= searchR) {
          const wt = skinSm[y * mw + x];
          sumW += wt;
          sumX += x * wt;
          sumY += y * wt;
        }
      }
    }

    const faceX = sumW > 0.1 ? sumX / sumW : px;
    const faceY = sumW > 0.1 ? sumY / sumW : py;
    const rawR = Math.sqrt(Math.max(4, sumW) / Math.PI) * 1.12;
    const faceR = Math.max(minDim * 0.085, Math.min(minDim * 0.22, rawR));

    const skinHalo = blurFloatMap(skinSm, mw, mh, Math.max(2, Math.round(faceR * 0.42)), 2);

    const headCy = faceY - 0.26 * faceR;
    const headRxInv = 1 / (1.58 * faceR);
    const headRyInv = 1 / (1.78 * faceR);
    const torsoTop = faceY + 0.15 * faceR;
    const torsoSpan = Math.max(1, mh - torsoTop);

    for (let y = 0; y < mh; y++) {
      const dyHead = (y - headCy) * headRyInv;
      const tDown = clamp01((y - torsoTop) / torsoSpan);
      const torsoHalfW = (1.85 + 0.9 * tDown) * faceR;
      const torsoStartW = smoothstep(faceY + 0.08 * faceR, faceY + 0.78 * faceR, y);

      for (let x = 0; x < mw; x++) {
        const i = y * mw + x;
        const dHead = Math.hypot((x - faceX) * headRxInv, dyHead);
        const wHead = 1 - smoothstep(0.68, 1.16, dHead);

        let wTorso = 0;
        if (torsoStartW > 0) {
          const dxTorso = Math.abs(x - faceX) / torsoHalfW;
          wTorso = (1 - smoothstep(0.64, 1.12, dxTorso)) * torsoStartW;
        }

        const nearSubjectX = 1 - smoothstep(1.55 * faceR, 2.35 * faceR, Math.abs(x - faceX));
        const nearSubjectY = smoothstep(faceY - 1.4 * faceR, faceY - 0.25 * faceR, y);
        const wSkin = Math.min(1, Math.max(skinSm[i] * 0.9, skinHalo[i] * 1.35) * nearSubjectX * nearSubjectY);
        prior[i] = Math.max(wHead, wTorso, wSkin);
      }
    }

    // Fast head/hair/hijab propagation so side-profile hair & hijab stay crisp without leaking onto walls
    const propMinY = Math.max(0, Math.floor(faceY - 2.25 * faceR));
    const propMaxY = Math.min(mh, Math.ceil(faceY + 1.35 * faceR));
    const propMaxX = 2.35 * faceR;
    const propTmp = new Float32Array(prior);
    const dirs = [-1, 1, -mw, mw];
    for (let iter = 0; iter < 5; iter++) {
      for (let y = propMinY; y < propMaxY; y++) {
        for (let x = 1; x < mw - 1; x++) {
          if (Math.abs(x - faceX) > propMaxX) continue;
          const i = y * mw + x;
          let best = propTmp[i];
          if (best >= 0.92) continue;
          const cr = downR[i];
          const cg = downG[i];
          const cb = downB[i];
          const cLum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
          if (cLum > 0.38) continue;
          for (let d = 0; d < 4; d++) {
            const ni = i + dirs[d];
            if (ni < 0 || ni >= count) continue;
            const np = propTmp[ni];
            if (np > best + 0.08 && np > 0.65) {
              const dr = cr - downR[ni];
              const dg = cg - downG[ni];
              const db = cb - downB[ni];
              const distSq = dr * dr + dg * dg + db * db;
              if (distSq < 0.007) {
                const sim = 1 - distSq / 0.007;
                const cand = np * (0.88 + 0.1 * sim);
                if (cand > best) best = cand;
              }
            }
          }
          prior[i] = best;
        }
      }
      propTmp.set(prior);
    }

    // Color-guided boundary refinement between outer background & foreground outfit/hair
    let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
    let fgR = 0, fgG = 0, fgB = 0, fgN = 0;
    const bgCutY = mh * 0.7;

    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x;
        const p = prior[i];
        if (p < 0.08 && y < bgCutY) {
          bgR += downR[i];
          bgG += downG[i];
          bgB += downB[i];
          bgN++;
        } else if (p > 0.74 && skinSm[i] < 0.18) {
          fgR += downR[i];
          fgG += downG[i];
          fgB += downB[i];
          fgN++;
        }
      }
    }

    if (bgN >= 12) {
      bgR /= bgN;
      bgG /= bgN;
      bgB /= bgN;
      const hasFg = fgN >= 8;
      if (hasFg) {
        fgR /= fgN;
        fgG /= fgN;
        fgB /= fgN;
      }
      const bgIsGreenish = bgG > bgR + 0.015 && bgG > bgB + 0.015;

      for (let i = 0; i < count; i++) {
        const p = prior[i];
        if (p > 0.04 && p < 0.85 && skinSm[i] < 0.25) {
          const r = downR[i];
          const g = downG[i];
          const b = downB[i];
          if (bgIsGreenish && g > r + 0.015 && g > b + 0.015 && p < 0.75) {
            const greenness = smoothstep(0.015, 0.08, g - Math.max(r, b));
            prior[i] = Math.max(skinSm[i], p * (1 - 0.74 * greenness));
          } else if (hasFg) {
            const dBg = Math.hypot(r - bgR, g - bgG, b - bgB);
            const dFg = Math.hypot(r - fgR, g - fgG, b - fgB);
            const bgMatch = (1 - smoothstep(0.08, 0.2, dBg)) * smoothstep(dBg * 1.08, dBg * 1.55, dFg);
            if (bgMatch > 0) {
              prior[i] = Math.max(skinSm[i], p * (1 - 0.46 * bgMatch));
            }
          }
        }
      }
    }
  }

  const smoothMask = blurFloatMap(prior, mw, mh, Math.max(1, Math.round(minDim * 0.02)), 2);

  // Safety guarantee: luminous portrait skin in upper-mid frame (faces, multi-person) is never darkened
  for (let y = 0; y < mh; y++) {
    const upperProtect = 1 - smoothstep(0.54, 0.68, y / mh);
    if (upperProtect <= 0) break;
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      const skinKeep = skinSm[i] * smoothstep(0.36, 0.5, downLum[i]) * upperProtect;
      if (skinKeep > smoothMask[i]) {
        smoothMask[i] = skinKeep;
      }
    }
  }

  if (source instanceof HTMLImageElement) {
    portraitMaskCache.set(source, { w, h, mw, mh, mask: smoothMask });
  }
  return { mw, mh, mask: smoothMask };
}

function sampleMask(mask: Float32Array, mw: number, mh: number, nx: number, ny: number): number {
  const gx = clamp01(nx) * (mw - 1);
  const gy = clamp01(ny) * (mh - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = x0 + 1 < mw ? x0 + 1 : x0;
  const y1 = y0 + 1 < mh ? y0 + 1 : y0;
  const fx = gx - x0;
  const fy = gy - y0;

  const v00 = mask[y0 * mw + x0];
  const v10 = mask[y0 * mw + x1];
  const v01 = mask[y1 * mw + x0];
  const v11 = mask[y1 * mw + x1];

  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

/**
 * Foreground-suppressed, highlight-creamy subtle optical bokeh buffer at 0.5x resolution.
 */
function createBokehBuffer(
  data: Uint8ClampedArray,
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

/**
 * Edge-preserving local bilateral skin smoother + edge magnitude estimate.
 * Smooths pores/noise only on flat skin regions while leaving eyes, lashes, glasses, and lips sharp.
 */
function sampleSkinSmoothAndEdge(
  origData: Uint8ClampedArray,
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

/**
 * Blend preset recipe by intensity (0..100) and combine with manual adjustments.
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

/**
 * High-speed pixel-level Lightroom-grade color grading engine running 100% locally in the browser.
 * Includes smooth tone curves, 6-band HSL Color Mix, continuous YCbCr skin protection,
 * selective skin smoothing & foreground micro-sharpening, portrait depth separation, and optical bokeh.
 */
export function applyRecipeToCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  recipe: ColorRecipe,
  maxDimension?: number
): void {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!srcW || !srcH) return;

  let w = srcW;
  let h = srcH;
  if (maxDimension && Math.max(w, h) > maxDimension) {
    const scale = maxDimension / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  if (targetCanvas.width !== w || targetCanvas.height !== h) {
    targetCanvas.width = w;
    targetCanvas.height = h;
  }

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.drawImage(source, 0, 0, w, h);

  const hasHsl = Boolean(recipe.hsl);
  const isNeutral =
    !hasHsl &&
    Object.entries(recipe).every(([key, val]) => key === 'hsl' || typeof val !== 'number' || Math.abs(val) < 0.01);
  if (isNeutral) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const needsPortraitMask = recipe.bgDarken > 0.25 || recipe.bgBokeh > 0.25;
  const portraitInfo = needsPortraitMask ? getPortraitMask(source, data, w, h) : null;

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
  const grainAmt = (recipe.grain * 1.1) / 255;
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

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Generates a small live thumbnail dataURL for the Meitu-style horizontal preset strip.
 */
export function generatePresetThumbnail(
  source: HTMLImageElement,
  recipe: ColorRecipe
): string {
  const thumbCanvas = document.createElement('canvas');
  const size = 128;
  const srcW = source.naturalWidth;
  const srcH = source.naturalHeight;
  const minSide = Math.min(srcW, srcH);
  const sx = (srcW - minSide) / 2;
  const sy = (srcH - minSide) / 2;

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = size;
  cropCanvas.height = size;
  const cCtx = cropCanvas.getContext('2d');
  if (!cCtx) return '';
  cCtx.drawImage(source, sx, sy, minSide, minSide, 0, 0, size, size);

  applyRecipeToCanvas(cropCanvas, thumbCanvas, recipe);
  return thumbCanvas.toDataURL('image/jpeg', 0.78);
}

/**
 * Applies rotation, horizontal flip, and aspect crop onto an offscreen Canvas before color grading.
 */
export function prepareTransformedSource(
  source: HTMLImageElement | HTMLCanvasElement,
  transform?: ImageTransform
): HTMLCanvasElement {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const out = document.createElement('canvas');
  if (!srcW || !srcH) return out;

  const rot = transform?.rotate ?? 0;
  const flipH = transform?.flipH ?? false;
  const aspect = transform?.aspect ?? 'original';

  const rotatedW = rot === 90 || rot === 270 ? srcH : srcW;
  const rotatedH = rot === 90 || rot === 270 ? srcW : srcH;

  let cropW = rotatedW;
  let cropH = rotatedH;

  if (aspect !== 'original') {
    const targetRatio =
      aspect === '4:5' ? 4 / 5 : aspect === '1:1' ? 1 : 16 / 9;
    const curRatio = rotatedW / rotatedH;
    if (curRatio > targetRatio) {
      cropW = Math.round(rotatedH * targetRatio);
    } else {
      cropH = Math.round(rotatedW / targetRatio);
    }
  }

  out.width = Math.max(1, cropW);
  out.height = Math.max(1, cropH);
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  ctx.translate(out.width / 2, out.height / 2);
  if (flipH) ctx.scale(-1, 1);
  if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);

  return out;
}

/**
 * Exports either a clean HD photo or a viral Before/After comparison card.
 */
export function renderExportCanvas(
  source: HTMLImageElement,
  recipe: ColorRecipe,
  mode: 'single' | 'card',
  options: {
    showWatermark: boolean;
    presetName: string;
    isPro: boolean;
    transform?: ImageTransform;
  }
): HTMLCanvasElement {
  const maxDim = options.isPro ? 2400 : 1280;
  const hasTransform =
    options.transform &&
    (options.transform.rotate !== 0 ||
      options.transform.flipH ||
      options.transform.aspect !== 'original');
  const preparedSource: HTMLImageElement | HTMLCanvasElement = hasTransform
    ? prepareTransformedSource(source, options.transform)
    : source;

  if (mode === 'single') {
    const out = document.createElement('canvas');
    applyRecipeToCanvas(preparedSource, out, recipe, maxDim);

    if (options.showWatermark) {
      const ctx = out.getContext('2d');
      if (ctx) {
        const fontSize = Math.max(18, Math.round(out.width * 0.024));
        ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = 'rgba(247, 243, 237, 0.85)';
        ctx.shadowColor = 'rgba(40, 35, 31, 0.45)';
        ctx.shadowBlur = 8;
        ctx.textAlign = 'right';
        ctx.fillText(`AUVORI · ${options.presetName.toUpperCase()}`, out.width - fontSize, out.height - fontSize * 0.85);
      }
    }
    return out;
  }

  // Editorial Side-by-Side Before / After Card (warm Ivory frame + Ink/Mocha badges)
  const panelMax = options.isPro ? 1200 : 800;
  const edited = document.createElement('canvas');
  applyRecipeToCanvas(preparedSource, edited, recipe, panelMax);

  const pw = edited.width;
  const ph = edited.height;
  const pad = Math.round(pw * 0.055);
  const gap = Math.round(pw * 0.032);
  const footerH = Math.round(pw * 0.1);

  const card = document.createElement('canvas');
  card.width = pad * 2 + pw * 2 + gap;
  card.height = pad * 2 + ph + footerH;
  const ctx = card.getContext('2d');
  if (!ctx) return edited;

  ctx.fillStyle = '#F7F3ED';
  ctx.fillRect(0, 0, card.width, card.height);

  const srcW = preparedSource instanceof HTMLImageElement ? preparedSource.naturalWidth : preparedSource.width;
  const srcH = preparedSource instanceof HTMLImageElement ? preparedSource.naturalHeight : preparedSource.height;
  ctx.drawImage(preparedSource, 0, 0, srcW, srcH, pad, pad, pw, ph);
  ctx.drawImage(edited, pad + pw + gap, pad, pw, ph);

  const drawBadge = (text: string, x: number, y: number, bg: string, alignRight = false) => {
    const fontSize = Math.max(18, Math.round(pw * 0.036));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const metrics = ctx.measureText(text);
    const bw = metrics.width + fontSize * 1.5;
    const bh = fontSize * 1.85;
    const bx = alignRight ? x - bw : x;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, bh / 2);
    ctx.fill();

    ctx.fillStyle = '#F7F3ED';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + bw / 2, y + bh / 2 + 1);
  };

  const badgeInset = Math.round(pw * 0.04);
  drawBadge('BEFORE', pad + badgeInset, pad + badgeInset, 'rgba(40, 35, 31, 0.78)', false);
  drawBadge('AFTER', pad + pw + gap + pw - badgeInset, pad + badgeInset, '#755846', true);

  const footerFont = Math.max(18, Math.round(pw * 0.034));
  ctx.font = `600 ${footerFont}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillStyle = '#28231F';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const footerY = pad + ph + footerH * 0.55;
  ctx.fillText(
    options.showWatermark ? 'Auvori Studio' : `Tone: ${options.presetName}`,
    pad,
    footerY
  );

  ctx.font = `500 ${Math.round(footerFont * 0.78)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#685D55';
  ctx.textAlign = 'right';
  ctx.fillText(
    options.showWatermark ? `${options.presetName} · auvori.app` : 'Styled with Auvori',
    card.width - pad,
    footerY
  );

  return card;
}
