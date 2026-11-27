import { PRESETS } from '../data/presets';
import { applyRecipeToCanvas } from './imageEngine';
import { createSamplePhotoDataUrl, SamplePhotoId } from './samplePhoto';

const renderedPreviewCache = new Map<string, string>();
const loadedSampleImgs = new Map<SamplePhotoId, Promise<HTMLImageElement>>();

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
 * Generates and caches a crisp 260px editorial preview of a preset applied to a studio sample photo.
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

  const img = await loadSampleImage(sampleId);
  const canvas = document.createElement('canvas');
  applyRecipeToCanvas(img, canvas, preset.recipe, 260);
  const url = canvas.toDataURL('image/jpeg', 0.82);
  renderedPreviewCache.set(key, url);
  return url;
}
