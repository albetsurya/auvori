import { ColorRecipe } from '../../types';
import { assignSourceId } from '../analysis/mask-cache';
import { getPortraitMask } from '../analysis/portrait-mask';
import { applyRecipeToPixelBuffer, isNeutralRecipe } from '../core/pixel-grade';
import { IPhotoRenderer, RenderFrameRequest, RenderFrameResult } from './renderer.types';

function resolveSourceSize(source: RenderFrameRequest['source']): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}

/**
 * Canonical Canvas 2D renderer (supports both DOM HTMLCanvasElement and Worker OffscreenCanvas).
 * Shares pure math with legacy imageEngine.ts and acts as safe fallback when WebGL2 is unavailable.
 */
export class Canvas2DRenderer implements IPhotoRenderer {
  readonly backend = 'canvas2d' as const;

  isSupported(): boolean {
    return typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';
  }

  getMaxTextureSize(): number {
    return 4096;
  }

  async render(request: RenderFrameRequest): Promise<RenderFrameResult> {
    const t0 = performance.now();
    const { width: srcW, height: srcH } = resolveSourceSize(request.source);
    if (!srcW || !srcH) {
      return { width: 0, height: 0, backend: this.backend, durationMs: 0 };
    }

    let w = srcW;
    let h = srcH;
    if (request.maxDimension && Math.max(w, h) > request.maxDimension) {
      const scale = request.maxDimension / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = request.targetCanvas;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = get2dContext(canvas);
    if (!ctx) {
      return { width: w, height: h, backend: this.backend, durationMs: performance.now() - t0 };
    }

    ctx.drawImage(request.source as CanvasImageSource, 0, 0, w, h);

    const recipe: ColorRecipe = request.recipe;
    if (isNeutralRecipe(recipe)) {
      return { width: w, height: h, backend: this.backend, durationMs: performance.now() - t0 };
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const needsPortraitMask = recipe.bgDarken > 0.25 || recipe.bgBokeh > 0.25;
    let portraitMask = request.portraitMask ?? null;

    if (needsPortraitMask && !portraitMask) {
      portraitMask = getPortraitMask(request.source, imgData.data, w, h, {
        sourceId: request.sourceId || assignSourceId(request.source),
        sourceRevision: request.sourceRevision,
        transformRevision: request.transformRevision,
        width: w,
        height: h
      });
    }

    applyRecipeToPixelBuffer(imgData.data, w, h, recipe, {
      portraitMask,
      includeGrain: request.includeGrain
    });

    ctx.putImageData(imgData, 0, 0);

    return {
      width: w,
      height: h,
      backend: this.backend,
      durationMs: performance.now() - t0,
      maskMethod: portraitMask?.method,
      maskConfidence: portraitMask?.confidence,
      maskFromCache: portraitMask?.fromCache
    };
  }

  dispose(): void {
    // No persistent resources
  }
}
