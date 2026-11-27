import {
  assignSourceId,
  getCachedPortraitMask,
  ImageSourceLike,
  PortraitMaskCacheKey,
  PortraitMaskMethod,
  setCachedPortraitMask
} from './mask-cache';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Continuous YCbCr skin detector in [0, 1] RGB.
 * Single canonical CPU formula shared by pixel engine and heuristic portrait mask.
 */
export function computeSkinWeight(r: number, g: number, b: number): number {
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

/**
 * Separable box blur over a 2D Float32Array (1 channel) with border clamping.
 */
export function blurFloatMap(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  passes = 2
): Float32Array {
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

export function sampleMask(
  mask: Float32Array,
  mw: number,
  mh: number,
  nx: number,
  ny: number
): number {
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

export interface PortraitMaskResult {
  mw: number;
  mh: number;
  mask: Float32Array;
  confidence: number;
  method: PortraitMaskMethod;
  fromCache: boolean;
}

/**
 * Pure buffer-based portrait foreground estimator (worker-safe: uses zero DOM APIs).
 * Keeps exact Auvori v1.0 heuristic mathematics while exposing confidence + method metadata.
 */
export function computePortraitMaskFromRgba(
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number
): Omit<PortraitMaskResult, 'fromCache'> {
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
  let method: PortraitMaskMethod = 'heuristic-skin';
  let confidence = 0.25;

  if (totalSkin < count * 0.004) {
    method = 'heuristic-ellipse';
    confidence = 0.25;
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

    const skinRatio = totalSkin / count;
    confidence = Math.min(0.92, 0.55 + Math.min(0.37, skinRatio * 4.5 + Math.min(0.2, peakScore * 0.5)));

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

  return { mw, mh, mask: smoothMask, confidence, method };
}

/**
 * Resolves a portrait mask using the revision-aware LRU MaskCache across all source types
 * (HTMLImageElement, HTMLCanvasElement, ImageBitmap, OffscreenCanvas).
 */
export function getPortraitMask(
  source: ImageSourceLike,
  data: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  keyInput?: Partial<PortraitMaskCacheKey>
): PortraitMaskResult {
  const key: PortraitMaskCacheKey = {
    sourceId: keyInput?.sourceId ?? assignSourceId(source),
    sourceRevision: keyInput?.sourceRevision ?? 1,
    width: keyInput?.width ?? w,
    height: keyInput?.height ?? h,
    transformRevision: keyInput?.transformRevision ?? 1
  };

  const cached = getCachedPortraitMask(key);
  if (cached) {
    return {
      mw: cached.mw,
      mh: cached.mh,
      mask: cached.mask,
      confidence: cached.confidence,
      method: cached.method,
      fromCache: true
    };
  }

  const computed = computePortraitMaskFromRgba(data, w, h);
  setCachedPortraitMask(key, computed);
  return { ...computed, fromCache: false };
}
