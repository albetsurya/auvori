import { ColorRecipe, ImageTransform } from '../types';
import {
  applyRecipeToPixelBuffer,
  buildEffectiveHsl,
  buildEffectiveRecipe,
  isNeutralRecipe
} from '../engine/core/pixel-grade';
import {
  assignSourceId,
  ImageSourceLike,
  PortraitMaskCacheKey
} from '../engine/analysis/mask-cache';
import { getPortraitMask } from '../engine/analysis/portrait-mask';

export { buildEffectiveHsl, buildEffectiveRecipe, isNeutralRecipe };

export const SAFE_MAX_EXPORT_DIM = 4096;
export const SAFE_MAX_EXPORT_AREA = 16_777_216;
export const FREE_MAX_EXPORT_DIM = 1280;

export function getSourceDimensions(source: ImageSourceLike): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

/**
 * Computes honest target export dimensions for single photos and Before/After cards.
 * Pro keeps full original resolution up to the browser canvas safety ceiling (no silent 2400px cap).
 */
export function computeExportDimensions(
  srcW: number,
  srcH: number,
  isPro: boolean,
  mode: 'single' | 'card',
  transform?: ImageTransform,
  hardwareMaxDim = SAFE_MAX_EXPORT_DIM
): { width: number; height: number; isOriginalResolution: boolean } {
  if (!srcW || !srcH) return { width: 0, height: 0, isOriginalResolution: true };

  const rot = transform?.rotate ?? 0;
  const aspect = transform?.aspect ?? 'original';
  const rotatedW = rot === 90 || rot === 270 ? srcH : srcW;
  const rotatedH = rot === 90 || rot === 270 ? srcW : srcH;

  let cropW = rotatedW;
  let cropH = rotatedH;
  if (aspect !== 'original') {
    const targetRatio = aspect === '4:5' ? 4 / 5 : aspect === '1:1' ? 1 : 16 / 9;
    const curRatio = rotatedW / rotatedH;
    if (curRatio > targetRatio) {
      cropW = Math.round(rotatedH * targetRatio);
    } else {
      cropH = Math.round(rotatedW / targetRatio);
    }
  }

  let outW = cropW;
  let outH = cropH;

  if (mode === 'single') {
    const maxAllowedSide = isPro ? Math.min(hardwareMaxDim, SAFE_MAX_EXPORT_DIM) : FREE_MAX_EXPORT_DIM;
    const maxSide = Math.max(outW, outH);
    if (maxSide > maxAllowedSide) {
      const s = maxAllowedSide / maxSide;
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }
    const area = outW * outH;
    if (area > SAFE_MAX_EXPORT_AREA) {
      const s = Math.sqrt(SAFE_MAX_EXPORT_AREA / area);
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }
  } else {
    // Comparison card holds 2 side-by-side panels inside a single canvas (~4096 max total width)
    const panelCap = isPro ? Math.min(1800, Math.floor((hardwareMaxDim * 0.44))) : 800;
    const maxSide = Math.max(outW, outH);
    if (maxSide > panelCap) {
      const s = panelCap / maxSide;
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }
  }

  return {
    width: Math.max(1, outW),
    height: Math.max(1, outH),
    isOriginalResolution: outW === cropW && outH === cropH
  };
}

/**
 * Converts a rendered HTMLCanvasElement or OffscreenCanvas to an encoded Blob without large base64 strings.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode canvas to Blob'));
      },
      mimeType,
      quality
    );
  });
}

export interface ApplyRecipeOptions {
  cacheKey?: Partial<PortraitMaskCacheKey>;
  includeGrain?: boolean;
}

/**
 * Canonical Canvas 2D Lightroom-grade color grading engine (mathematical reference + fallback).
 * Uses shared revision-aware PortraitMaskCache and pure pixel processor.
 */
export function applyRecipeToCanvas(
  source: ImageSourceLike,
  targetCanvas: HTMLCanvasElement,
  recipe: ColorRecipe,
  maxDimension?: number,
  options?: ApplyRecipeOptions
): void {
  const { width: srcW, height: srcH } = getSourceDimensions(source);
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

  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);

  if (isNeutralRecipe(recipe)) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const needsPortraitMask = recipe.bgDarken > 0.25 || recipe.bgBokeh > 0.25;
  const portraitInfo = needsPortraitMask
    ? getPortraitMask(source, data, w, h, {
        sourceId: options?.cacheKey?.sourceId ?? assignSourceId(source),
        sourceRevision: options?.cacheKey?.sourceRevision ?? 1,
        transformRevision: options?.cacheKey?.transformRevision ?? 1,
        width: w,
        height: h
      })
    : null;

  applyRecipeToPixelBuffer(data, w, h, recipe, {
    portraitMask: portraitInfo,
    includeGrain: options?.includeGrain
  });

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
  source: ImageSourceLike,
  transform?: ImageTransform
): HTMLCanvasElement {
  const { width: srcW, height: srcH } = getSourceDimensions(source);
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
    const targetRatio = aspect === '4:5' ? 4 / 5 : aspect === '1:1' ? 1 : 16 / 9;
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
  ctx.drawImage(source as CanvasImageSource, -srcW / 2, -srcH / 2, srcW, srcH);

  return out;
}

/**
 * Draws Editorial Before/After Card onto a target canvas from source + already-graded canvas.
 */
export function composeBeforeAfterCard(
  preparedSource: ImageSourceLike,
  editedCanvas: HTMLCanvasElement,
  options: { showWatermark: boolean; presetName: string }
): HTMLCanvasElement {
  const pw = editedCanvas.width;
  const ph = editedCanvas.height;
  const pad = Math.round(pw * 0.055);
  const gap = Math.round(pw * 0.032);
  const footerH = Math.round(pw * 0.1);

  const card = document.createElement('canvas');
  card.width = pad * 2 + pw * 2 + gap;
  card.height = pad * 2 + ph + footerH;
  const ctx = card.getContext('2d');
  if (!ctx) return editedCanvas;

  ctx.fillStyle = '#F2F2ED';
  ctx.fillRect(0, 0, card.width, card.height);

  const { width: srcW, height: srcH } = getSourceDimensions(preparedSource);
  ctx.drawImage(preparedSource as CanvasImageSource, 0, 0, srcW, srcH, pad, pad, pw, ph);
  ctx.drawImage(editedCanvas, pad + pw + gap, pad, pw, ph);

  const drawBadge = (
    text: string,
    x: number,
    y: number,
    bg: string,
    textColor: string,
    alignRight = false
  ) => {
    const fontSize = Math.max(18, Math.round(pw * 0.036));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const metrics = ctx.measureText(text);
    const bw = metrics.width + fontSize * 1.4;
    const bh = fontSize * 1.8;
    const bx = alignRight ? x - bw : x;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, Math.max(6, Math.round(bh * 0.22)));
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + bw / 2, y + bh / 2 + 1);
  };

  const badgeInset = Math.round(pw * 0.04);
  drawBadge('BEFORE', pad + badgeInset, pad + badgeInset, 'rgba(37, 39, 36, 0.84)', '#F2F2ED', false);
  drawBadge('AFTER', pad + pw + gap + pw - badgeInset, pad + badgeInset, '#68735D', '#FFFFFF', true);

  const footerFont = Math.max(18, Math.round(pw * 0.03));
  ctx.font = `600 ${footerFont}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#252724';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const footerY = pad + ph + footerH * 0.55;
  ctx.fillText(
    options.showWatermark ? 'Auvori Studio' : `Tone: ${options.presetName}`,
    pad,
    footerY
  );

  ctx.font = `500 ${Math.round(footerFont * 0.82)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#5D6159';
  ctx.textAlign = 'right';
  ctx.fillText(
    options.showWatermark ? `${options.presetName} · auvori.app` : 'Styled with Auvori',
    card.width - pad,
    footerY
  );

  return card;
}

export function drawWatermarkOverlay(
  canvas: HTMLCanvasElement,
  presetName: string
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fontSize = Math.max(18, Math.round(canvas.width * 0.024));
  ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = 'rgba(242, 242, 237, 0.88)';
  ctx.shadowColor = 'rgba(37, 39, 36, 0.45)';
  ctx.shadowBlur = 8;
  ctx.textAlign = 'right';
  ctx.fillText(`AUVORI · ${presetName.toUpperCase()}`, canvas.width - fontSize, canvas.height - fontSize * 0.85);
}

/**
 * Synchronous Canvas 2D export helper (reference implementation).
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
    sourceId?: string;
    sourceRevision?: number;
    transformRevision?: number;
  }
): HTMLCanvasElement {
  const { width: rawW, height: rawH } = getSourceDimensions(source);
  const target = computeExportDimensions(rawW, rawH, options.isPro, mode, options.transform);
  const maxDim = Math.max(target.width, target.height);

  const hasTransform =
    options.transform &&
    (options.transform.rotate !== 0 ||
      options.transform.flipH ||
      options.transform.aspect !== 'original');
  const preparedSource: ImageSourceLike = hasTransform
    ? prepareTransformedSource(source, options.transform)
    : source;

  const cacheKey: Partial<PortraitMaskCacheKey> | undefined = options.sourceId
    ? {
        sourceId: options.sourceId,
        sourceRevision: options.sourceRevision ?? 1,
        transformRevision: options.transformRevision ?? 1
      }
    : undefined;

  if (mode === 'single') {
    const out = document.createElement('canvas');
    applyRecipeToCanvas(preparedSource, out, recipe, maxDim, { cacheKey });

    if (options.showWatermark) {
      drawWatermarkOverlay(out, options.presetName);
    }
    return out;
  }

  const edited = document.createElement('canvas');
  applyRecipeToCanvas(preparedSource, edited, recipe, maxDim, { cacheKey });
  return composeBeforeAfterCard(preparedSource, edited, {
    showWatermark: options.showWatermark,
    presetName: options.presetName
  });
}
