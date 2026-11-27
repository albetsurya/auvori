import { ColorRecipe } from '../../types';
import { AdaptiveFlashMode } from '../analysis/adaptive-relighting';
import { AnalysisResult } from '../analysis/analysis-types';
import { ImageSourceLike, PortraitMaskMethod } from '../analysis/mask-cache';
import { PortraitMaskResult } from '../analysis/portrait-mask';

export type RendererBackend = 'webgl2' | 'worker-canvas2d' | 'canvas2d';

export interface RenderFrameRequest {
  source: ImageSourceLike;
  sourceId: string;
  sourceRevision: number;
  transformRevision: number;
  recipe: ColorRecipe;
  targetCanvas: HTMLCanvasElement | OffscreenCanvas;
  maxDimension?: number;
  /** Optional precomputed portrait mask (e.g., from Worker or P1 AI segmentation) */
  portraitMask?: PortraitMaskResult | null;
  /** Optional cached Phase 3 AI analysis used by Adaptive Looks (e.g. Direct Flash) */
  analysisResult?: AnalysisResult | null;
  /** Allow toggling deterministic film grain (useful for clean golden GPU-vs-CPU comparisons) */
  includeGrain?: boolean;
}

export interface RenderFrameResult {
  width: number;
  height: number;
  backend: RendererBackend;
  durationMs: number;
  maskMethod?: PortraitMaskMethod;
  maskConfidence?: number;
  maskFromCache?: boolean;
  adaptiveMode?: AdaptiveFlashMode;
  cancelled?: boolean;
}

export interface IPhotoRenderer {
  readonly backend: RendererBackend;
  isSupported(): boolean;
  getMaxTextureSize(): number;
  render(request: RenderFrameRequest): Promise<RenderFrameResult>;
  dispose(): void;
}
