import React, { useEffect, useState } from 'react';
import { Columns2, Crown, Download, Image as ImageIcon } from 'lucide-react';
import { ColorRecipe, ImageTransform, Preset } from '../types';
import { applyRecipeToCanvas, prepareTransformedSource, renderExportCanvas } from '../lib/imageEngine';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';

interface ExportModalProps {
  isOpen: boolean;
  sourceImage: HTMLImageElement | null;
  effectiveRecipe: ColorRecipe;
  transform: ImageTransform;
  activePreset: Preset;
  isProUnlocked: boolean;
  defaultWatermark: boolean;
  onClose: () => void;
  onOpenPro: () => void;
  onExportSuccess: (thumbDataUrl: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  sourceImage,
  effectiveRecipe,
  transform,
  activePreset,
  isProUnlocked,
  defaultWatermark,
  onClose,
  onOpenPro,
  onExportSuccess
}) => {
  const [mode, setMode] = useState<'single' | 'card'>('single');
  const [showWatermark, setShowWatermark] = useState(!isProUnlocked || defaultWatermark);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setShowWatermark(isProUnlocked ? defaultWatermark : true);
  }, [isProUnlocked, defaultWatermark, isOpen]);

  if (!isOpen || !sourceImage) return null;

  const isBlockedByPro = activePreset.isPro && !isProUnlocked;

  const handleDownload = () => {
    if (isBlockedByPro) {
      onClose();
      onOpenPro();
      return;
    }

    setIsExporting(true);
    setTimeout(() => {
      try {
        const outCanvas = renderExportCanvas(sourceImage, effectiveRecipe, mode, {
          showWatermark: isProUnlocked ? showWatermark : true,
          presetName: activePreset.name,
          isPro: isProUnlocked,
          transform
        });
        const link = document.createElement('a');
        const slug = activePreset.id;
        link.download =
          mode === 'card'
            ? `auvori-before-after-${slug}.jpg`
            : `auvori-${slug}.jpg`;
        link.href = outCanvas.toDataURL('image/jpeg', isProUnlocked ? 0.95 : 0.88);
        link.click();

        // Create crisp single-frame recent thumbnail for Home Recent Edits
        const hasTransform =
          transform.rotate !== 0 || transform.flipH || transform.aspect !== 'original';
        const thumbSrc = hasTransform ? prepareTransformedSource(sourceImage, transform) : sourceImage;
        const thumbCanvas = document.createElement('canvas');
        applyRecipeToCanvas(thumbSrc, thumbCanvas, effectiveRecipe, 240);
        onExportSuccess(thumbCanvas.toDataURL('image/jpeg', 0.78));
      } finally {
        setIsExporting(false);
        onClose();
      }
    }, 60);
  };

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Ready to save?"
      subtitle={`Active tone: ${activePreset.name}`}
    >
      {isBlockedByPro ? (
        <div className="p-4 rounded-[14px] bg-warning/10 border border-warning/30 space-y-2">
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
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('single')}
              className={`p-4 rounded-[16px] border text-left transition duration-fast ${
                mode === 'single'
                  ? 'bg-surfaceSecondary border-primary text-textPrimary'
                  : 'bg-surface border-border text-textSecondary hover:border-taupe'
              }`}
            >
              <ImageIcon className="w-5 h-5 mb-2 text-primary" strokeWidth={1.8} />
              <div className="text-xs font-semibold text-textPrimary">HD Photograph</div>
              <div className="text-[11px] text-textSecondary mt-0.5">
                {isProUnlocked ? 'Full original resolution' : 'Standard HD resolution'}
              </div>
            </button>

            <button
              onClick={() => setMode('card')}
              className={`p-4 rounded-[16px] border text-left transition duration-fast ${
                mode === 'card'
                  ? 'bg-surfaceSecondary border-primary text-textPrimary'
                  : 'bg-surface border-border text-textSecondary hover:border-taupe'
              }`}
            >
              <Columns2 className="w-5 h-5 mb-2 text-primary" strokeWidth={1.8} />
              <div className="text-xs font-semibold text-textPrimary">Before / After Card</div>
              <div className="text-[11px] text-textSecondary mt-0.5">
                Editorial Ivory comparison
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-[14px] bg-surfaceSecondary border border-border">
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
                className={`w-11 h-6 rounded-full transition duration-fast relative border ${
                  showWatermark ? 'bg-primary border-primary' : 'bg-surface border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-ivory shadow transition duration-fast ${
                    showWatermark ? 'left-5' : 'left-1'
                  }`}
                />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onOpenPro();
                }}
                className="px-3 py-1.5 rounded-full bg-warning/15 text-warning text-[11px] font-semibold flex items-center gap-1"
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
        onClick={handleDownload}
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
