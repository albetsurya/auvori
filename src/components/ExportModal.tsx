import React, { useEffect, useMemo, useState } from 'react';
import { Columns2, Crown, Download, Image as ImageIcon } from 'lucide-react';
import { ColorRecipe, ExportFormat, ImageTransform, Preset } from '../types';
import { AnalysisResult } from '../engine/analysis/analysis-types';
import {
  applyRecipeToCanvas,
  composeBeforeAfterCard,
  computeExportDimensions,
  getSourceDimensions,
  prepareTransformedSource
} from '../lib/imageEngine';
import { exportPhotographBlob } from '../engine/pipeline/export-pipeline';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';

export interface ExportSuccessMeta {
  sizeBytes: number;
  format: ExportFormat;
  width: number;
  height: number;
}

interface ExportModalProps {
  isOpen: boolean;
  sourceImage: HTMLImageElement | null;
  sourceRevision?: number;
  transformRevision?: number;
  maxHardwareTextureSize?: number;
  effectiveRecipe: ColorRecipe;
  transform: ImageTransform;
  activePreset: Preset;
  analysisResult?: AnalysisResult | null;
  isProUnlocked: boolean;
  defaultWatermark: boolean;
  onClose: () => void;
  onOpenPro: () => void;
  onExportSuccess: (thumbDataUrl: string, meta?: ExportSuccessMeta) => void;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function estimateExportBytes(
  width: number,
  height: number,
  mode: 'single' | 'card',
  format: ExportFormat,
  jpegQualityPct: number
): number {
  const pixelCount = mode === 'card' ? width * height * 2.25 : width * height;
  if (format === 'png') {
    // Typical lossless PNG photographic compression (~1.6–2.0 bytes/px)
    return Math.round(pixelCount * 1.75);
  }
  const q = jpegQualityPct / 100;
  const bytesPerPixel = 0.14 + Math.pow(q, 2.2) * 0.58;
  return Math.round(pixelCount * bytesPerPixel);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  sourceImage,
  sourceRevision = 1,
  transformRevision = 1,
  maxHardwareTextureSize = 4096,
  effectiveRecipe,
  transform,
  activePreset,
  analysisResult = null,
  isProUnlocked,
  defaultWatermark,
  onClose,
  onOpenPro,
  onExportSuccess
}) => {
  const [mode, setMode] = useState<'single' | 'card'>('single');
  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState<number>(90);
  const [showWatermark, setShowWatermark] = useState(!isProUnlocked || defaultWatermark);
  const [isExporting, setIsExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    setShowWatermark(isProUnlocked ? defaultWatermark : true);
  }, [isProUnlocked, defaultWatermark, isOpen]);

  // Generate lightweight preview thumbnail once when modal opens or mode/watermark changes
  useEffect(() => {
    if (!isOpen || !sourceImage) {
      setPreviewUrl('');
      return;
    }
    const hasTransform =
      transform.rotate !== 0 || transform.flipH || transform.aspect !== 'original';
    const baseSrc = hasTransform ? prepareTransformedSource(sourceImage, transform) : sourceImage;
    const edited = document.createElement('canvas');
    applyRecipeToCanvas(baseSrc, edited, effectiveRecipe, 320, {
      cacheKey: {
        sourceId: 'editor-source',
        sourceRevision,
        transformRevision
      },
      analysisResult
    });

    if (mode === 'card') {
      const card = composeBeforeAfterCard(baseSrc, edited, {
        showWatermark: isProUnlocked ? showWatermark : true,
        presetName: activePreset.name
      });
      setPreviewUrl(card.toDataURL('image/jpeg', 0.85));
    } else {
      setPreviewUrl(edited.toDataURL('image/jpeg', 0.85));
    }
  }, [
    isOpen,
    sourceImage,
    mode,
    showWatermark,
    isProUnlocked,
    activePreset.name,
    effectiveRecipe,
    analysisResult,
    transform,
    sourceRevision,
    transformRevision
  ]);

  const singleDims = useMemo(() => {
    if (!sourceImage) return { width: 0, height: 0, isOriginalResolution: true };
    const { width, height } = getSourceDimensions(sourceImage);
    return computeExportDimensions(
      width,
      height,
      isProUnlocked,
      'single',
      transform,
      maxHardwareTextureSize
    );
  }, [sourceImage, isProUnlocked, transform, maxHardwareTextureSize]);

  const cardDims = useMemo(() => {
    if (!sourceImage) return { width: 0, height: 0, isOriginalResolution: false };
    const { width, height } = getSourceDimensions(sourceImage);
    return computeExportDimensions(
      width,
      height,
      isProUnlocked,
      'card',
      transform,
      maxHardwareTextureSize
    );
  }, [sourceImage, isProUnlocked, transform, maxHardwareTextureSize]);

  if (!isOpen || !sourceImage) return null;

  const isBlockedByPro = activePreset.isPro && !isProUnlocked;
  const activeDims = mode === 'card' ? cardDims : singleDims;
  const approxBytes = estimateExportBytes(
    activeDims.width,
    activeDims.height,
    mode,
    format,
    jpegQuality
  );

  const handleDownload = async () => {
    if (isBlockedByPro) {
      onClose();
      onOpenPro();
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportPhotographBlob({
        source: sourceImage,
        sourceId: 'editor-source',
        sourceRevision,
        transformRevision,
        recipe: effectiveRecipe,
        analysisResult,
        mode,
        options: {
          showWatermark: isProUnlocked ? showWatermark : true,
          presetName: activePreset.name,
          isPro: isProUnlocked,
          transform,
          format,
          quality: format === 'jpeg' ? jpegQuality / 100 : 1
        }
      });

      const blobUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      const slug = activePreset.id;
      const ext = format === 'png' ? 'png' : 'jpg';
      link.download =
        mode === 'card'
          ? `auvori-before-after-${slug}.${ext}`
          : `auvori-${slug}.${ext}`;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

      // Compact single-frame recent thumbnail (240px) for Home Recent Edits
      const hasTransform =
        transform.rotate !== 0 || transform.flipH || transform.aspect !== 'original';
      const thumbSrc = hasTransform ? prepareTransformedSource(sourceImage, transform) : sourceImage;
      const thumbCanvas = document.createElement('canvas');
      applyRecipeToCanvas(thumbSrc, thumbCanvas, effectiveRecipe, 240, {
        cacheKey: {
          sourceId: 'editor-source',
          sourceRevision,
          transformRevision
        },
        analysisResult
      });
      onExportSuccess(thumbCanvas.toDataURL('image/jpeg', 0.78), {
        sizeBytes: result.blob.size,
        format,
        width: result.width,
        height: result.height
      });
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const singleResolutionLabel = isProUnlocked
    ? singleDims.isOriginalResolution
      ? `Full original (${singleDims.width}×${singleDims.height} px)`
      : `High-res (${singleDims.width}×${singleDims.height} px)`
    : `Standard HD (${singleDims.width}×${singleDims.height} px)`;

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Export Photograph"
      subtitle={`Active look: ${activePreset.name}`}
    >
      {isBlockedByPro ? (
        <div className="p-4 rounded-[12px] bg-warning/10 border border-warning/30 space-y-2">
          <div className="flex items-center gap-2 text-warning font-semibold text-sm">
            <Crown className="w-4 h-4" strokeWidth={1.8} />
            Termasuk Paket Auvori Pro
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            Kamu bebas mencoba semua preset Pro langsung di layar. Untuk menyimpan hasil dengan{' '}
            <strong className="text-textPrimary">{activePreset.name}</strong> tanpa watermark,
            aktifkan Auvori Pro lewat Lynk.id.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Live Export Preview Thumbnail */}
          <div className="flex items-center gap-3.5 p-3 rounded-[12px] bg-surfaceSecondary border border-border">
            <div className="w-16 h-20 rounded-[8px] overflow-hidden bg-chalk border border-border shrink-0 flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Export preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full animate-pulse bg-border/40" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-semibold text-textPrimary truncate">
                {mode === 'card' ? 'Before / After Comparison' : activePreset.name}
              </div>
              <div className="text-[11px] text-textSecondary tabular-nums">
                {mode === 'single' ? singleResolutionLabel : `Panel ${cardDims.width}×${cardDims.height} px`}
              </div>
              <div className="text-[11px] text-textSecondary tabular-nums">
                Est. size: <span className="font-medium text-textPrimary">{formatBytes(approxBytes)}</span>{' '}
                <span className="text-[10px]">(Approximate)</span>
              </div>
            </div>
          </div>

          {/* Export Mode Selector */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setMode('single')}
              className={`p-3.5 rounded-[12px] border text-left transition duration-fast ${
                mode === 'single'
                  ? 'bg-surfaceSecondary border-primary text-textPrimary'
                  : 'bg-surface border-border text-textSecondary hover:border-olive'
              }`}
            >
              <ImageIcon className="w-4 h-4 mb-1.5 text-primary" strokeWidth={1.8} />
              <div className="text-xs font-semibold text-textPrimary">HD Photograph</div>
              <div className="text-[11px] text-textSecondary mt-0.5 tabular-nums">
                {singleResolutionLabel}
              </div>
            </button>

            <button
              onClick={() => setMode('card')}
              className={`p-3.5 rounded-[12px] border text-left transition duration-fast ${
                mode === 'card'
                  ? 'bg-surfaceSecondary border-primary text-textPrimary'
                  : 'bg-surface border-border text-textSecondary hover:border-olive'
              }`}
            >
              <Columns2 className="w-4 h-4 mb-1.5 text-primary" strokeWidth={1.8} />
              <div className="text-xs font-semibold text-textPrimary">Before / After Card</div>
              <div className="text-[11px] text-textSecondary mt-0.5">
                Neutral Chalk studio frame
              </div>
            </button>
          </div>

          {/* Format & Quality */}
          <div className="p-3.5 rounded-[12px] bg-surfaceSecondary border border-border space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-textPrimary">File Format</div>
                <div className="text-[11px] text-textSecondary">
                  {format === 'jpeg' ? 'Compact & crisp for sharing' : 'Lossless PNG archival'}
                </div>
              </div>
              <div className="grid grid-cols-2 bg-surface p-0.5 rounded-[8px] border border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setFormat('jpeg')}
                  className={`min-h-[36px] px-3 rounded-[6px] text-xs font-semibold transition duration-fast ${
                    format === 'jpeg'
                      ? 'bg-primary text-primaryText'
                      : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  JPEG
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('png')}
                  className={`min-h-[36px] px-3 rounded-[6px] text-xs font-semibold transition duration-fast ${
                    format === 'png'
                      ? 'bg-primary text-primaryText'
                      : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  PNG
                </button>
              </div>
            </div>

            {format === 'jpeg' && (
              <div className="pt-1 border-t border-border/70">
                <Slider
                  label="JPEG Quality"
                  min={60}
                  max={100}
                  step={5}
                  value={jpegQuality}
                  formatValue={(v) => `${v}%`}
                  onChange={setJpegQuality}
                  ariaLabel="JPEG Quality"
                />
              </div>
            )}
          </div>

          {/* Watermark Switch */}
          <div className="flex items-center justify-between px-4 py-3 rounded-[12px] bg-surfaceSecondary border border-border">
            <div>
              <div className="text-xs font-semibold text-textPrimary">Auvori Watermark</div>
              <div className="text-[11px] text-textSecondary">
                {isProUnlocked ? 'Optional subtle studio mark' : 'Upgrade Pro to remove watermark'}
              </div>
            </div>
            {isProUnlocked ? (
              <button
                onClick={() => setShowWatermark((v) => !v)}
                role="switch"
                aria-checked={showWatermark}
                aria-label="Toggle watermark"
                className={`w-12 h-7 rounded-full transition duration-fast relative border shrink-0 ${
                  showWatermark ? 'bg-primary border-primary' : 'bg-stone border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition duration-fast ${
                    showWatermark ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onOpenPro();
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-[8px] bg-warning/15 text-warning text-[11px] font-semibold flex items-center gap-1"
              >
                <Crown className="w-3 h-3" strokeWidth={1.8} />
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        fullWidth
        loading={isExporting}
        onClick={() => void handleDownload()}
      >
        {isBlockedByPro ? (
          <>
            <Crown className="w-4 h-4" strokeWidth={1.8} />
            Buka Auvori Pro via Lynk.id
          </>
        ) : (
          <>
            <Download className="w-4 h-4" strokeWidth={1.8} />
            {isExporting
              ? 'Preparing your photo...'
              : mode === 'card'
              ? 'Save Before / After Card'
              : 'Save Photograph'}
          </>
        )}
      </Button>
    </ModalSheet>
  );
};
