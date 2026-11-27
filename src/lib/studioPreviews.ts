import { PRESETS } from '../data/presets';
import { PhotoPipeline } from '../engine/pipeline/photo-pipeline';
import { createSamplePhotoDataUrl, SamplePhotoId } from './samplePhoto';

const renderedPreviewCache = new Map<string, string>();
const loadedSampleImgs = new Map<SamplePhotoId, Promise<HTMLImageElement>>();
let studioPreviewPipeline: PhotoPipeline | null = null;
let renderQueue: Promise<void> = Promise.resolve();

function getStudioPreviewPipeline(): PhotoPipeline {
  if (!studioPreviewPipeline) {
    studioPreviewPipeline = new PhotoPipeline({
      preferWebGL2: true,
      preferWorkerFallback: true
    });
  }
  return studioPreviewPipeline;
}

function loadSampleImage(sampleId: SamplePhotoId): Promise<HTMLImageElement> {
  const existing = loadedSampleImgs.get(sampleId);
  if (existing) return existing;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = createSamplePhotoDataUrl(sampleId);
  });
  loadedSampleImgs.set(sampleId, p);
  return p;
}

/**
 * Generates and caches a crisp 260px editorial preview of a preset applied to a studio sample photo
 * using GPU/Worker PhotoPipeline instead of blocking the main thread.
 */
export async function renderStudioPresetPreview(
  presetId: string,
  sampleId: SamplePhotoId = 'cafe'
): Promise<string> {
  const key = `${sampleId}:${presetId}`;
  const hit = renderedPreviewCache.get(key);
  if (hit) return hit;

  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return '';

  const job = renderQueue.then(async () => {
    const cachedAgain = renderedPreviewCache.get(key);
    if (cachedAgain) return cachedAgain;

    const img = await loadSampleImage(sampleId);
    const canvas = document.createElement('canvas');
    await getStudioPreviewPipeline().renderPreview({
      source: img,
      sourceId: `sample_${sampleId}`,
      sourceRevision: 1,
      transformRevision: 1,
      recipe: preset.recipe,
      targetCanvas: canvas,
      maxDimension: 260
    });
    const url = canvas.toDataURL('image/jpeg', 0.82);
    renderedPreviewCache.set(key, url);
    return url;
  });

  renderQueue = job.then(
    () => undefined,
    () => undefined
  );

  return job;
}
