import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Lock, Maximize2 } from 'lucide-react';
import { ColorRecipe, ImageTransform, Preset } from '../types';
import { applyRecipeToCanvas, prepareTransformedSource } from '../lib/imageEngine';

interface PhotoCanvasProps {
  sourceImage: HTMLImageElement;
  effectiveRecipe: ColorRecipe;
  transform: ImageTransform;
  activePreset: Preset;
  isProUnlocked: boolean;
  splitMode: boolean;
  onOpenPro: () => void;
}

export const PhotoCanvas: React.FC<PhotoCanvasProps> = ({
  sourceImage,
  effectiveRecipe,
  transform,
  activePreset,
  isProUnlocked,
  splitMode,
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

  // Real-time render of edited canvas
  useEffect(() => {
    if (!editedCanvasRef.current) return;
    setIsRendering(true);
    const raf = requestAnimationFrame(() => {
      if (editedCanvasRef.current) {
        applyRecipeToCanvas(transformedSource, editedCanvasRef.current, effectiveRecipe, 1080);
      }
      setIsRendering(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [transformedSource, effectiveRecipe]);

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
      const nextZoom = Math.max(1, Math.min(3.5, pinchStartZoomRef.current * (dist / pinchStartDistRef.current)));
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
      className="flex-1 flex items-center justify-center p-4 sm:p-5 relative overflow-hidden select-none touch-none"
      style={{ backgroundColor: 'var(--color-canvas-well)' }}
    >
      <div
        ref={frameRef}
        className="relative max-h-full max-w-full flex items-center justify-center rounded-[16px] overflow-hidden shadow-card"
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
          {/* Edited Canvas (never tinted by dark mode) */}
          <canvas
            ref={editedCanvasRef}
            className="max-h-[calc(100dvh-318px)] sm:max-h-[calc(100dvh-330px)] max-w-full w-auto h-auto block object-contain"
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
              className="absolute top-0 bottom-0 w-0.5 bg-ivory shadow-[0_0_12px_rgba(40,35,31,0.5)] pointer-events-none"
              style={{ left: `${splitPercent}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-ivory text-ink shadow-md flex items-center justify-center text-xs font-bold border border-sand">
                ↔
              </div>
            </div>
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink/75 text-ivory text-[10px] font-medium tracking-wider uppercase pointer-events-none">
              Before
            </span>
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-mocha/90 text-ivory text-[10px] font-medium tracking-wider uppercase pointer-events-none">
              After
            </span>
          </>
        )}

        {/* Press-and-Hold indicator */}
        {!splitMode && isHoldingOriginal && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink/80 text-ivory text-[10px] font-medium tracking-wider uppercase pointer-events-none">
            Before (Original)
          </span>
        )}

        {/* Subtle idle hint */}
        {!splitMode && !isHoldingOriginal && activePreset.id !== 'original' && zoom <= 1.05 && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink/75 backdrop-blur-sm text-ivory text-[10px] font-medium pointer-events-none">
            Hold to compare · Pinch to zoom
          </span>
        )}

        {/* Fit zoom reset pill when zoomed */}
        {zoom > 1.05 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-ink/80 text-ivory text-[11px] font-medium inline-flex items-center gap-1.5 shadow-card"
          >
            <Maximize2 className="w-3 h-3" strokeWidth={1.8} />
            Fit ({zoom.toFixed(1)}x)
          </button>
        )}

        {/* Loading indicator for heavy exports/renders */}
        {isRendering && (
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-ink/70 text-ivory text-[10px] font-medium pointer-events-none">
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
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ink/85 hover:bg-ink text-ivory border border-taupe/50 backdrop-blur-md text-xs font-medium shadow-card transition duration-fast"
          >
            <Lock className="w-3 h-3 text-taupe" strokeWidth={1.8} />
            <span>Preview PRO · Buka via Lynk.id</span>
            <Crown className="w-3 h-3 text-taupe" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </main>
  );
};
