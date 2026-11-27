import React from 'react';
import { FlaskConical, ImagePlus } from 'lucide-react';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { SamplePhotoId } from '../lib/samplePhoto';

interface GalleryPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPickDevicePhoto: () => void;
  onSelectSample?: (sampleId: SamplePhotoId) => void;
  onOpenStudioSamples: () => void;
}

/**
 * Phase 6.3: GalleryPickerSheet now offers two clear paths:
 * 1. Choose from Gallery (device file picker)
 * 2. Try a Studio Sample → opens StudioSampleLibrary with real CC0 photographs
 *
 * Legacy synthetic sample grid removed in favor of the full StudioSampleLibrary.
 */
export const GalleryPickerSheet: React.FC<GalleryPickerSheetProps> = ({
  isOpen,
  onClose,
  onPickDevicePhoto,
  onOpenStudioSamples
}) => {
  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      title="Open a Photo"
      subtitle="Choose from your device or explore studio samples."
    >
      <div className="space-y-3">
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

        <Button
          variant="soft"
          fullWidth
          onClick={() => {
            onClose();
            onOpenStudioSamples();
          }}
          aria-label="Browse studio sample photographs"
        >
          <FlaskConical className="w-4.5 h-4.5" strokeWidth={1.8} />
          Try a Studio Sample
        </Button>

        <p className="text-[10px] text-textSecondary text-center pt-1">
          Studio samples are real CC0-licensed photographs
        </p>
      </div>
    </ModalSheet>
  );
};
