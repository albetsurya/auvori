import { ColorRecipe, ExportFormat, ImageTransform } from '../../types';
import { assignSourceId, ImageSourceLike } from '../analysis/mask-cache';
import { RendererBackend } from '../renderer/renderer.types';
import { WebGL2Renderer } from '../renderer/webgl2.renderer';
import {
  canvasToBlob,
  composeBeforeAfterCard,
  computeExportDimensions,
  drawWatermarkOverlay,
  getSourceDimensions,
  prepareTransformedSource
} from '../../lib/imageEngine';
import { PhotoPipeline } from './photo-pipeline';

export interface ExportPipelineRequest {
  source: ImageSourceLike;
  sourceId?: string;
  sourceRevision?: number;
  transformRevision?: number;
  recipe: ColorRecipe;
  mode: 'single' | 'card';
  options: {
    showWatermark: boolean;
    presetName: string;
    isPro: boolean;
    transform?: ImageTransform;
    preferWebGL2?: boolean;
    format?: ExportFormat;
    quality?: number;
  };
}

export interface ExportPipelineResult {
  blob: Blob;
  width: number;
  height: number;
  isOriginalResolution: boolean;
  backend: RendererBackend;
  durationMs: number;
}

/**
 * Full-resolution GPU-first export pipeline with automatic CPU Worker fallback,
 * zero hidden resolution downscaling for Pro, and Blob output (never massive base64 URLs).
 */
export async function exportPhotographBlob(
  req: ExportPipelineRequest
): Promise<ExportPipelineResult> {
  const t0 = performance.now();
  const { options, recipe, mode } = req;
  const sourceId = req.sourceId ?? assignSourceId(req.source);
  const sourceRevision = req.sourceRevision ?? 1;
  const transformRevision = req.transformRevision ?? 1;

  const hasTransform =
    options.transform &&
    (options.transform.rotate !== 0 ||
      options.transform.flipH ||
      options.transform.aspect !== 'original');

  const preparedSource: ImageSourceLike = hasTransform
    ? prepareTransformedSource(req.source, options.transform)
    : req.source;

  const { width: rawW, height: rawH } = getSourceDimensions(req.source);
  const format: ExportFormat = options.format === 'png' ? 'png' : 'jpeg';
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality =
    format === 'png'
      ? 1
      : Math.max(0.1, Math.min(1, options.quality ?? (options.isPro ? 0.95 : 0.88)));

  // Use a dedicated short-lived WebGL2 export context so 4K FBO VRAM is reclaimed immediately after export
  let exportGl: WebGL2Renderer | null = null;
  let hardwareMaxDim = 4096;
  if (options.preferWebGL2 !== false) {
    const candidate = new WebGL2Renderer();
    if (candidate.isSupported()) {
      exportGl = candidate;
      hardwareMaxDim = candidate.getMaxTextureSize();
    } else {
      candidate.dispose();
    }
  }

  const targetDims = computeExportDimensions(
    rawW,
    rawH,
    options.isPro,
    mode,
    options.transform,
    hardwareMaxDim
  );
  const maxDim = Math.max(targetDims.width, targetDims.height);

  try {
    let gradedCanvas: HTMLCanvasElement;
    let backend: RendererBackend = 'canvas2d';

    if (exportGl) {
      // GPU full-resolution export directly from WebGL2 internal canvas (zero redundant 2D readback)
      const glCanvas = exportGl.getInternalCanvas() as HTMLCanvasElement;
      const res = await exportGl.render({
        source: preparedSource,
        sourceId,
        sourceRevision,
        transformRevision,
        recipe,
        targetCanvas: glCanvas,
        maxDimension: maxDim
      });
      backend = res.backend;

      if (mode === 'single' && !options.showWatermark) {
        const blob = await canvasToBlob(glCanvas, mimeType, quality);
        return {
          blob,
          width: res.width,
          height: res.height,
          isOriginalResolution: targetDims.isOriginalResolution,
          backend,
          durationMs: performance.now() - t0
        };
      }

      gradedCanvas = document.createElement('canvas');
      gradedCanvas.width = res.width;
      gradedCanvas.height = res.height;
      const gCtx = gradedCanvas.getContext('2d');
      gCtx?.drawImage(glCanvas, 0, 0, res.width, res.height);
    } else {
      // Off-main-thread CPU Worker fallback
      const fallbackPipeline = new PhotoPipeline({
        preferWebGL2: false,
        preferWorkerFallback: true
      });
      try {
        gradedCanvas = document.createElement('canvas');
        const res = await fallbackPipeline.renderPreview({
          source: preparedSource,
          sourceId,
          sourceRevision,
          transformRevision,
          recipe,
          targetCanvas: gradedCanvas,
          maxDimension: maxDim
        });
        backend = res.backend;
      } finally {
        fallbackPipeline.dispose();
      }
    }

    let finalCanvas = gradedCanvas;
    if (mode === 'single') {
      if (options.showWatermark) {
        drawWatermarkOverlay(finalCanvas, options.presetName);
      }
    } else {
      finalCanvas = composeBeforeAfterCard(preparedSource, gradedCanvas, {
        showWatermark: options.showWatermark,
        presetName: options.presetName
      });
    }

    const blob = await canvasToBlob(finalCanvas, mimeType, quality);
    return {
      blob,
      width: finalCanvas.width,
      height: finalCanvas.height,
      isOriginalResolution: targetDims.isOriginalResolution,
      backend,
      durationMs: performance.now() - t0
    };
  } finally {
    exportGl?.dispose();
  }
}
