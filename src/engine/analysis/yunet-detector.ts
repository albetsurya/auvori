/**
 * Stage A — YuNet multi-face and 5-landmark detector.
 * Implements exact OpenCV face_detect.cpp preprocessing (aspect-preserving BGR [0..255]
 * NCHW float32 padded to multiple of 32) and multi-stride anchor decoding + IoU NMS.
 */

import type { FaceDetection, FacialLandmarks, NormalizedPoint } from './analysis-types';

export interface YuNetPreparedInput {
  tensorData: Float32Array;
  dims: [1, 3, number, number];
  padW: number;
  padH: number;
  targetW: number;
  targetH: number;
  sourceW: number;
  sourceH: number;
  scale: number;
}

export function prepareYuNetInput(
  rgba: Uint8ClampedArray | Uint8Array,
  sourceW: number,
  sourceH: number,
  maxSide = 640,
): YuNetPreparedInput {
  const scale = Math.min(1.0, maxSide / Math.max(sourceW, sourceH));
  const targetW = Math.max(32, Math.round(sourceW * scale));
  const targetH = Math.max(32, Math.round(sourceH * scale));
  const padW = Math.ceil(targetW / 32) * 32;
  const padH = Math.ceil(targetH / 32) * 32;

  const planeSize = padW * padH;
  const tensorData = new Float32Array(3 * planeSize);
  const bOff = 0;
  const gOff = planeSize;
  const rOff = 2 * planeSize;

  const scaleX = targetW > 1 ? (sourceW - 1) / (targetW - 1) : 0;
  const scaleY = targetH > 1 ? (sourceH - 1) / (targetH - 1) : 0;

  for (let y = 0; y < targetH; y++) {
    const sy = y * scaleY;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, sourceH - 1);
    const fy = sy - y0;
    const fy0 = 1 - fy;

    for (let x = 0; x < targetW; x++) {
      const sx = x * scaleX;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, sourceW - 1);
      const fx = sx - x0;

      const i00 = (y0 * sourceW + x0) * 4;
      const i10 = (y0 * sourceW + x1) * 4;
      const i01 = (y1 * sourceW + x0) * 4;
      const i11 = (y1 * sourceW + x1) * 4;

      const w00 = (1 - fx) * fy0;
      const w10 = fx * fy0;
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const outIdx = y * padW + x;
      tensorData[bOff + outIdx] =
        rgba[i00 + 2] * w00 + rgba[i10 + 2] * w10 + rgba[i01 + 2] * w01 + rgba[i11 + 2] * w11;
      tensorData[gOff + outIdx] =
        rgba[i00 + 1] * w00 + rgba[i10 + 1] * w10 + rgba[i01 + 1] * w01 + rgba[i11 + 1] * w11;
      tensorData[rOff + outIdx] =
        rgba[i00] * w00 + rgba[i10] * w10 + rgba[i01] * w01 + rgba[i11] * w11;
    }
  }

  return {
    tensorData,
    dims: [1, 3, padH, padW],
    padW,
    padH,
    targetW,
    targetH,
    sourceW,
    sourceH,
    scale,
  };
}

interface RawCandidate {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  landmarks: FacialLandmarks;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function normPoint(px: number, py: number, w: number, h: number): NormalizedPoint {
  return { x: clamp01(px / w), y: clamp01(py / h) };
}

function isSaneFaceCandidate(c: RawCandidate, sourceW: number, sourceH: number): boolean {
  const bw = (c.x2 - c.x1) / sourceW;
  const bh = (c.y2 - c.y1) / sourceH;
  if (bw < 0.025 || bh < 0.025) return false;
  const aspect = bw / Math.max(bh, 1e-6);
  if (aspect < 0.35 || aspect > 2.4) return false;

  const avgEyeY = 0.5 * (c.landmarks.rightEye.y + c.landmarks.leftEye.y);
  const avgMouthY = 0.5 * (c.landmarks.rightMouth.y + c.landmarks.leftMouth.y);
  // Reject upside-down non-face patterns (e.g. hands/collars) where mouth sits well above eyes.
  if (avgMouthY < avgEyeY - 0.05 * bh) return false;

  return true;
}

function computeIoU(a: RawCandidate, b: RawCandidate): number {
  const ix1 = Math.max(a.x1, b.x1);
  const iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2);
  const iy2 = Math.min(a.y2, b.y2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

export function decodeYuNetOutputs(
  outputsByName: Record<string, Float32Array>,
  meta: YuNetPreparedInput,
  scoreThreshold = 0.8,
  nmsThreshold = 0.3,
): FaceDetection[] {
  const strides = [8, 16, 32] as const;
  const candidates: RawCandidate[] = [];
  const scaleX = meta.sourceW / meta.targetW;
  const scaleY = meta.sourceH / meta.targetH;

  for (const s of strides) {
    const cls = outputsByName[`cls_${s}`];
    const obj = outputsByName[`obj_${s}`];
    const bbox = outputsByName[`bbox_${s}`];
    const kps = outputsByName[`kps_${s}`];
    if (!cls || !obj || !bbox || !kps) continue;

    const cols = meta.padW / s;
    const count = cls.length;

    for (let idx = 0; idx < count; idx++) {
      const cScore = Math.max(0, Math.min(1, cls[idx]));
      const oScore = Math.max(0, Math.min(1, obj[idx]));
      const score = Math.sqrt(cScore * oScore);
      if (score < scoreThreshold) continue;

      const r = Math.floor(idx / cols);
      const c = idx - r * cols;

      const bOff = idx * 4;
      const dx = bbox[bOff];
      const dy = bbox[bOff + 1];
      const dw = bbox[bOff + 2];
      const dh = bbox[bOff + 3];

      const cx = (c + dx) * s;
      const cy = (r + dy) * s;
      const bw = Math.exp(dw) * s;
      const bh = Math.exp(dh) * s;

      const x1 = (cx - 0.5 * bw) * scaleX;
      const y1 = (cy - 0.5 * bh) * scaleY;
      const x2 = (cx + 0.5 * bw) * scaleX;
      const y2 = (cy + 0.5 * bh) * scaleY;

      const kOff = idx * 10;
      const landmarks: FacialLandmarks = {
        rightEye: normPoint((kps[kOff] + c) * s * scaleX, (kps[kOff + 1] + r) * s * scaleY, meta.sourceW, meta.sourceH),
        leftEye: normPoint((kps[kOff + 2] + c) * s * scaleX, (kps[kOff + 3] + r) * s * scaleY, meta.sourceW, meta.sourceH),
        nose: normPoint((kps[kOff + 4] + c) * s * scaleX, (kps[kOff + 5] + r) * s * scaleY, meta.sourceW, meta.sourceH),
        rightMouth: normPoint((kps[kOff + 6] + c) * s * scaleX, (kps[kOff + 7] + r) * s * scaleY, meta.sourceW, meta.sourceH),
        leftMouth: normPoint((kps[kOff + 8] + c) * s * scaleX, (kps[kOff + 9] + r) * s * scaleY, meta.sourceW, meta.sourceH),
      };

      const candidate: RawCandidate = { x1, y1, x2, y2, confidence: score, landmarks };
      if (isSaneFaceCandidate(candidate, meta.sourceW, meta.sourceH)) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const kept: RawCandidate[] = [];
  for (const c of candidates) {
    let suppressed = false;
    for (const k of kept) {
      if (computeIoU(c, k) > nmsThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(c);
  }

  return kept.map((c) => {
    const nx1 = clamp01(c.x1 / meta.sourceW);
    const ny1 = clamp01(c.y1 / meta.sourceH);
    const nx2 = clamp01(c.x2 / meta.sourceW);
    const ny2 = clamp01(c.y2 / meta.sourceH);
    const nw = Math.max(0, nx2 - nx1);
    const nh = Math.max(0, ny2 - ny1);
    return {
      bbox: { x: nx1, y: ny1, width: nw, height: nh },
      landmarks: c.landmarks,
      confidence: c.confidence,
      areaRatio: nw * nh,
    };
  });
}
