/**
 * Stage B — Subject Segmentation pre/post-processing and confidence evaluation.
 *
 * Supports:
 * - PP-HumanSeg V2-Lite (192x192, Apache 2.0): primary human portrait segmenter.
 * - U²-Netp (320x320, Apache 2.0): general salient-object segmenter (used for
 *   non-human objects or when explicitly selected; NOT treated as human matting).
 */

import type { FaceDetection, MaskBuffer, MaskSourceKind } from './analysis-types';

const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

function bilinearSampleRgb(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const rgb = new Float32Array(dstW * dstH * 3);
  const scaleX = dstW > 1 ? (srcW - 1) / (dstW - 1) : 0;
  const scaleY = dstH > 1 ? (srcH - 1) / (dstH - 1) : 0;

  for (let y = 0; y < dstH; y++) {
    const sy = y * scaleY;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const fy = sy - y0;
    const fy0 = 1 - fy;

    for (let x = 0; x < dstW; x++) {
      const sx = x * scaleX;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const fx = sx - x0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const w00 = (1 - fx) * fy0;
      const w10 = fx * fy0;
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const dst = (y * dstW + x) * 3;
      rgb[dst] = rgba[i00] * w00 + rgba[i10] * w10 + rgba[i01] * w01 + rgba[i11] * w11;
      rgb[dst + 1] = rgba[i00 + 1] * w00 + rgba[i10 + 1] * w10 + rgba[i01 + 1] * w01 + rgba[i11 + 1] * w11;
      rgb[dst + 2] = rgba[i00 + 2] * w00 + rgba[i10 + 2] * w10 + rgba[i01 + 2] * w01 + rgba[i11 + 2] * w11;
    }
  }
  return rgb;
}

export function preparePpHumanSegInput(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
): { tensorData: Float32Array; dims: [1, 3, 192, 192] } {
  const W = 192;
  const H = 192;
  const rgb = bilinearSampleRgb(rgba, srcW, srcH, W, H);
  const plane = W * H;
  const tensorData = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i++) {
    const p = i * 3;
    tensorData[i] = (rgb[p] / 255 - 0.5) / 0.5;
    tensorData[plane + i] = (rgb[p + 1] / 255 - 0.5) / 0.5;
    tensorData[2 * plane + i] = (rgb[p + 2] / 255 - 0.5) / 0.5;
  }

  return { tensorData, dims: [1, 3, H, W] };
}

export function prepareU2NetpInput(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
): { tensorData: Float32Array; dims: [1, 3, 320, 320]; maxPixel: number } {
  const W = 320;
  const H = 320;
  const rgb = bilinearSampleRgb(rgba, srcW, srcH, W, H);
  let maxPixel = 1e-6;
  for (let i = 0; i < rgb.length; i++) {
    if (rgb[i] > maxPixel) maxPixel = rgb[i];
  }

  const plane = W * H;
  const tensorData = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const p = i * 3;
    tensorData[i] = (rgb[p] / maxPixel - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensorData[plane + i] = (rgb[p + 1] / maxPixel - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensorData[2 * plane + i] = (rgb[p + 2] / maxPixel - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return { tensorData, dims: [1, 3, H, W], maxPixel };
}

export function buildMaskBuffer(
  rawValues: Float32Array,
  width: number,
  height: number,
  source: MaskSourceKind,
): MaskBuffer {
  const n = width * height;
  const data = new Float32Array(n);
  let min = 1;
  let max = 0;
  let sum = 0;
  let fgCount = 0;

  for (let i = 0; i < n; i++) {
    const v = rawValues[i];
    const c = v < 0 ? 0 : v > 1 ? 1 : v;
    data[i] = c;
    if (c < min) min = c;
    if (c > max) max = c;
    sum += c;
    if (c > 0.5) fgCount++;
  }

  return {
    width,
    height,
    data,
    min: n > 0 ? min : 0,
    max: n > 0 ? max : 0,
    mean: n > 0 ? sum / n : 0,
    foregroundRatio: n > 0 ? fgCount / n : 0,
    source,
  };
}

export function decodePpHumanSegOutput(outputData: Float32Array): MaskBuffer {
  const W = 192;
  const H = 192;
  const plane = W * H;
  // ONNX output [1, 2, 192, 192] already ends with Softmax: channel 1 is foreground human probability.
  const fgSlice = outputData.subarray(plane, plane * 2);
  return buildMaskBuffer(fgSlice, W, H, 'ai-pphumanseg');
}

export function decodeU2NetpOutput(outputData: Float32Array): MaskBuffer {
  const W = 320;
  const H = 320;
  return buildMaskBuffer(outputData.subarray(0, W * H), W, H, 'ai-u2netp');
}

export function createEmptyMaskBuffer(width = 1, height = 1): MaskBuffer {
  return {
    width,
    height,
    data: new Float32Array(width * height),
    min: 0,
    max: 0,
    mean: 0,
    foregroundRatio: 0,
    source: 'none',
  };
}

/**
 * Confidence-gates a segmentation mask against empirical failure modes
 * (e.g., U²-Netp hallucinating foreground weight across mountain horizons on pure landscapes).
 */
export function evaluateSubjectMaskConfidence(
  mask: MaskBuffer,
  faces: FaceDetection[],
): number {
  if (mask.source === 'none' || mask.max < 0.25 || mask.foregroundRatio < 0.015) {
    return mask.max > 0.5 && faces.length > 0 ? 0.35 : 0.08;
  }

  const w = mask.width;
  const h = mask.height;

  // Measure left/right border span to detect full-width horizon/band hallucinations when no face is present.
  let leftFgRows = 0;
  let rightFgRows = 0;
  for (let y = 0; y < h; y++) {
    if (mask.data[y * w] > 0.5) leftFgRows++;
    if (mask.data[y * w + (w - 1)] > 0.5) rightFgRows++;
  }
  const leftEdgeFrac = leftFgRows / h;
  const rightEdgeFrac = rightFgRows / h;

  if (faces.length > 0) {
    let faceMaskSum = 0;
    let facePixels = 0;
    for (const face of faces) {
      const x0 = Math.max(0, Math.floor(face.bbox.x * w));
      const y0 = Math.max(0, Math.floor(face.bbox.y * h));
      const x1 = Math.min(w - 1, Math.ceil((face.bbox.x + face.bbox.width) * w));
      const y1 = Math.min(h - 1, Math.ceil((face.bbox.y + face.bbox.height) * h));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          faceMaskSum += mask.data[y * w + x];
          facePixels++;
        }
      }
    }
    const faceAgreement = facePixels > 0 ? faceMaskSum / facePixels : 0;
    const score = 0.35 + 0.62 * Math.min(1, faceAgreement / 0.85);
    return Math.max(0.25, Math.min(0.98, score));
  }

  // No face detected: non-human salient object vs empty landscape check.
  if (mask.foregroundRatio > 0.88) {
    // Almost the entire frame is white -> low subject-vs-background separability.
    return 0.32;
  }

  let fgSum = 0;
  let fgCount = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] > 0.5) {
      fgSum += mask.data[i];
      fgCount++;
    }
  }
  const peakDensity = fgCount > 0 ? fgSum / fgCount : 0;
  const horizontalBandPenalty =
    leftEdgeFrac > 0.04 && rightEdgeFrac > 0.04 && mask.foregroundRatio < 0.28 ? 0.32 : 0;

  // Compact centered object (e.g. coffee cup, isolated figure) gets ~0.68..0.82; horizon strip drops to ~0.35.
  const base = 0.25 + 0.55 * Math.min(1, peakDensity) * (1 - horizontalBandPenalty);
  return Math.max(0.15, Math.min(0.85, base - horizontalBandPenalty * 0.4));
}
