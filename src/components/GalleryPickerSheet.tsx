import React from 'react';
import { ImagePlus, Sparkles } from 'lucide-react';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { createSamplePhotoDataUrl, SAMPLE_PHOTOS, SamplePhotoId } from '../lib/samplePhoto';

interface GalleryPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickDevicePhoto: () => void;
  onSelectSample: (sampleId: SamplePhotoId) => void;
}

export const GalleryPickerSheet: React.FC<GalleryPickerSheetProps> = ({
  isOpen,
  onClose,
  onPickDevicePhoto,
  onSelectSample
}) => {
  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Open a Photo"
      subtitle="Select a photo from your device or start with a studio sample."
    >
      <div className="space-y-5">
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            onClose();
            onPickDevicePhoto();
          }}
        >
          <ImagePlus className="w-5 h-5" strokeWidth={1.8} />
          Choose from Gallery
        </Button>

        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-textSecondary">
            <Sparkles className="w-3.5 h-3.5 text-olive" strokeWidth={1.8} />
            <span>Studio sample photos</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SAMPLE_PHOTOS.map((sample) => {
              const src = createSamplePhotoDataUrl(sample.id);
              return (
                <button
                  key={sample.id}
                  onClick={() => {
                    onClose();
                    onSelectSample(sample.id);
                  }}
                  className="text-left group focus:outline-none"
                >
                  <div className="aspect-[4/5] rounded-[10px] overflow-hidden border border-border bg-surfaceSecondary group-hover:border-olive transition duration-normal">
                    <img
                      src={src}
                      alt={sample.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-normal"
                      draggable={false}
                    />
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-textPrimary truncate">
                    {sample.title}
                  </div>
                  <div className="text-[10px] text-textSecondary truncate">{sample.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ModalSheet>
  );
};
