/**
 * StudioSampleLibrary — Phase 6.3
 *
 * Curated sample photo gallery using CC0-verified real photographs.
 * Allows users to browse and select a sample to open in the existing editor.
 *
 * Photos are served as bundled static WebP assets from /assets/studio-samples/.
 * No backend upload is required or performed.
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { STUDIO_SAMPLES, RealSamplePhotoId } from '../lib/samplePhoto';
import { ModalSheet } from './ui/ModalSheet';

interface StudioSampleLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sampleId: RealSamplePhotoId, suggestedPresetId?: string) => void;
}

const SCENE_LABELS: Record<string, string> = {
  portrait: 'Portrait',
  interior: 'Interior',
  food: 'Food',
  night: 'Night',
  film: 'Film',
  landscape: 'Landscape'
};

export const StudioSampleLibrary: React.FC<StudioSampleLibraryProps> = ({
  isOpen,
  onClose,
  onSelectSample
}) => {
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const handleThumbError = (id: string) => {
    setFailedThumbs((prev) => new Set(prev).add(id));
  };

  if (!isOpen) return null;

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Studio Samples"
      subtitle="Real CC0-licensed photographs. Select one to open in the editor."
    >
      <div className="pb-safe">
        {/* Attribution notice */}
        <p className="text-[10px] text-textSecondary mb-4 leading-relaxed">
          All photographs are CC0 1.0 Universal — freely usable, no attribution required.
          Creator credits in <span className="font-medium text-olive">Profile → Photo Credits</span>.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STUDIO_SAMPLES.map((sample) => {
            const failed = failedThumbs.has(sample.id);
            return (
              <button
                key={sample.id}
                onClick={() => {
                  onSelectSample(sample.id, sample.suggestedPresetId);
                  onClose();
                }}
                className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-[10px]"
                aria-label={`Open ${sample.title} in editor`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/5] rounded-[10px] overflow-hidden bg-surfaceSecondary border border-border/60 group-hover:border-olive/50 transition duration-fast">
                  {failed ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-textSecondary bg-surfaceSecondary">
                      <AlertCircle className="w-6 h-6" strokeWidth={1.5} />
                      <span className="text-[10px] text-center px-2">Photo unavailable</span>
                    </div>
                  ) : (
                    <img
                      src={sample.thumbPath}
                      alt={sample.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-normal"
                      draggable={false}
                      loading="lazy"
                      onError={() => handleThumbError(sample.id)}
                    />
                  )}

                  {/* Scene badge */}
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-[4px] bg-graphite/80 text-chalk text-[9px] font-semibold tracking-wider uppercase">
                    {SCENE_LABELS[sample.scene] ?? sample.scene}
                  </span>
                </div>

                {/* Label */}
                <div className="mt-1.5 px-0.5 space-y-0.5">
                  <p className="text-xs font-semibold text-textPrimary truncate">{sample.title}</p>
                  <p className="text-[10px] text-textSecondary truncate">{sample.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ModalSheet>
  );
};
