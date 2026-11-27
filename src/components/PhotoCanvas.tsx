import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Lock, Maximize2 } from 'lucide-react';
import { ColorRecipe, ImageTransform, Preset } from '../types';
import { AdaptiveFlashMode } from '../engine/analysis/adaptive-relighting';
import { AnalysisResult } from '../engine/analysis/analysis-types';
import { prepareTransformedSource } from '../lib/imageEngine';
import { PhotoPipeline } from '../engine/pipeline/photo-pipeline';

export interface AdaptiveStatusUi {
  status: 'idle' | 'analyzing' | 'ready' | 'fallback';
  mode?: AdaptiveFlashMode;
  label: string;
}

interface PhotoCanvasProps {
  pipeline: PhotoPipeline;
  sourceImage: HTMLImageElement;
  sourceRevision?: number;
  transformRevision?: number;
  effectiveRecipe: ColorRecipe;
  transform: ImageTransform;
  activePreset: Preset;
  isProUnlocked: boolean;
  splitMode: boolean;
  analysisResult?: AnalysisResult | null;
  adaptiveStatus?: AdaptiveStatusUi;
  onOpenPro: () => void;
}

export const PhotoCanvas: React.FC<PhotoCanvasProps> = ({
  pipeline,
  sourceImage,
  sourceRevision = 1,
  transformRevision = 1,
  effectiveRecipe,
  transform,
  activePreset,
  isProUnlocked,
  splitMode,
  analysisResult = null,
  adaptiveStatus,
  onOpenPro
}) => {
  const editedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Pinch-to-zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // Apply crop / rotation / flip once whenever source or transform changes
  const transformedSource = useMemo(() => {
    const hasTransform =
      transform.rotate !== 0 || transform.flipH || transform.aspect !== 'original';
    return hasTransform ? prepareTransformedSource(sourceImage, transform) : sourceImage;
  }, [sourceImage, transform]);

  // Reset zoom when image or crop changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [transformedSource]);

  // Render original canvas when source/transform changes
  useEffect(() => {
    if (!originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    const maxDim = 1080;
    const srcW =
      transformedSource instanceof HTMLImageElement
        ? transformedSource.naturalWidth
        : transformedSource.width;
    const srcH =
      transformedSource instanceof HTMLImageElement
        ? transformedSource.naturalHeight
        : transformedSource.height;
    if (!srcW || !srcH) return;

    let w = srcW;
    let h = srcH;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(transformedSource, 0, 0, w, h);
  }, [transformedSource]);

  // Real-time GPU/Worker render of edited canvas
  useEffect(() => {
    let active = true;
    if (!editedCanvasRef.current) return;
    setIsRendering(true);

    const raf = requestAnimationFrame(() => {
      const canvas = editedCanvasRef.current;
      if (!canvas) {
        if (active) setIsRendering(false);
        return;
      }
      pipeline
        .renderPreview({
          source: transformedSource,
          sourceId: 'editor-source',
          sourceRevision,
          transformRevision,
          recipe: effectiveRecipe,
          targetCanvas: canvas,
          maxDimension: 1080,
          analysisResult
        })
        .then((res) => {
          if (active && !res.cancelled) {
            setIsRendering(false);
          }
        })
        .catch(() => {
          if (active) setIsRendering(false);
        });
    });

    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, [pipeline, transformedSource, effectiveRecipe, sourceRevision, transformRevision, analysisResult]);

  const updateSplitFromClientX = (clientX: number) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(5, Math.min(95, pct)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      setIsHoldingOriginal(false);
      const pts = Array.from(pointersRef.current.values());
      pinchStartDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartZoomRef.current = zoom;
      return;
    }

    // Double-tap to toggle zoom (when not in splitMode)
    const now = Date.now();
    if (!splitMode && now - lastTapRef.current < 260) {
      lastTapRef.current = 0;
      setIsHoldingOriginal(false);
      if (zoom > 1.05) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        setZoom(2.1);
      }
      return;
    }
    lastTapRef.current = now;

    if (splitMode) {
      setIsDraggingSplit(true);
      updateSplitFromClientX(e.clientX);
    } else if (zoom > 1.05) {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    } else {
      setIsHoldingOriginal(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchStartDistRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const nextZoom = Math.max(
        1,
        Math.min(3.5, pinchStartZoomRef.current * (dist / pinchStartDistRef.current))
      );
      setZoom(nextZoom);
      if (nextZoom <= 1.02) setPan({ x: 0, y: 0 });
      return;
    }

    if (splitMode && isDraggingSplit) {
      updateSplitFromClientX(e.clientX);
    } else if (panStartRef.current && zoom > 1.05) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartDistRef.current = null;
    }
    panStartRef.current = null;
    setIsHoldingOriginal(false);
    setIsDraggingSplit(false);
  };

  const isLockedProPreview = activePreset.isPro && !isProUnlocked;

  return (
    <main
      className="flex-1 min-w-0 min-h-0 flex items-center justify-center p-3 sm:p-5 lg:p-8 relative overflow-hidden select-none touch-none"
      style={{ backgroundColor: 'var(--editor-canvas-well)' }}
    >
      <div
        ref={frameRef}
        className="relative max-h-full max-w-full flex items-center justify-center rounded-[10px] overflow-hidden shadow-card"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          className="relative flex items-center justify-center transition-transform duration-fast"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        >
          {/* Edited Canvas (pixels never tinted by workspace theme) */}
          <canvas
            ref={editedCanvasRef}
            className="max-h-[calc(100dvh-340px)] sm:max-h-[calc(100dvh-350px)] lg:max-h-[calc(100dvh-124px)] max-w-full w-auto h-auto block object-contain"
          />

          {/* Original Canvas Overlay (Press-and-Hold OR Split-View) */}
          <canvas
            ref={originalCanvasRef}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-fast"
            style={
              splitMode
                ? {
                    opacity: 1,
                    clipPath: `inset(0 ${100 - splitPercent}% 0 0)`
                  }
                : {
                    opacity: isHoldingOriginal ? 1 : 0
                  }
            }
          />
        </div>

        {/* Split-view divider line & badges */}
        {splitMode && (
          <>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-chalk shadow-[0_0_12px_rgba(37,39,36,0.55)] pointer-events-none"
              style={{ left: `${splitPercent}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-[8px] bg-chalk text-graphite shadow-md flex items-center justify-center text-xs font-bold border border-stone">
                ↔
              </div>
            </div>
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-semibold tracking-wider uppercase pointer-events-none">
              Before
            </span>
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-[6px] bg-olive text-white text-[10px] font-semibold tracking-wider uppercase pointer-events-none">
              After
            </span>
          </>
        )}

        {/* Press-and-Hold indicator */}
        {!splitMode && isHoldingOriginal && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-semibold tracking-wider uppercase pointer-events-none">
            Before (Original)
          </span>
        )}

        {/* Subtle idle hint */}
        {!splitMode && !isHoldingOriginal && activePreset.id !== 'original' && zoom <= 1.05 && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-[6px] bg-graphite/75 backdrop-blur-sm text-chalk text-[10px] font-medium pointer-events-none">
            Hold to compare · Pinch to zoom
          </span>
        )}

        {/* Top-right adaptive status + optional fit zoom reset pill */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          {activePreset.lookType === 'adaptive' &&
            adaptiveStatus &&
            adaptiveStatus.status !== 'idle' &&
            !splitMode && (
              <span
                data-testid="adaptive-status-pill"
                data-adaptive-status={adaptiveStatus.status}
                data-adaptive-mode={adaptiveStatus.mode ?? ''}
                className="px-2.5 py-1 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-medium inline-flex items-center gap-1.5 backdrop-blur-sm border border-stone/25 shadow-card pointer-events-none"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    adaptiveStatus.status === 'analyzing'
                      ? 'bg-chalk animate-pulse'
                      : adaptiveStatus.status === 'ready'
                        ? 'bg-olive-soft'
                        : 'bg-amber-300'
                  }`}
                />
                <span>{adaptiveStatus.label}</span>
              </span>
            )}

          {zoom > 1.05 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="min-h-[44px] px-3 py-1.5 rounded-[8px] bg-graphite/85 text-chalk text-[11px] font-medium inline-flex items-center gap-1.5 shadow-card tabular-nums"
            >
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.8} />
              Fit ({zoom.toFixed(1)}x)
            </button>
          )}
        </div>

        {/* Loading indicator for heavy renders */}
        {isRendering && (
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-[6px] bg-graphite/80 text-chalk text-[10px] font-medium pointer-events-none">
            Preparing...
          </span>
        )}

        {/* Pro Preview Floating Pill */}
        {isLockedProPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPro();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 min-h-[44px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-graphite/90 hover:bg-graphite text-chalk border border-olive/60 backdrop-blur-md text-xs font-medium shadow-card transition duration-fast whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5 text-olive-soft" strokeWidth={1.8} />
            <span>Preview PRO · Buka via Lynk.id</span>
            <Crown className="w-3.5 h-3.5 text-olive-soft" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </main>
  );
};
