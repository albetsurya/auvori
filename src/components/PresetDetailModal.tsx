import React, { useEffect, useState } from 'react';
import { Crown, Heart, Sparkles } from 'lucide-react';
import { PRESET_CATEGORIES, SIGNATURE_COLLECTIONS } from '../data/presets';
import { Preset } from '../types';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/Chip';
import {
  renderStudioPresetPreview,
  getSignatureLookPreviewUrl,
  getSignatureLookSourceUrl,
  getSignatureLookObjectPosition
} from '../lib/studioPreviews';
import {
  getPresetSampleId,
  getSamplePhotoUrl,
  SamplePhotoId,
  SIGNATURE_LOOK_PREVIEWS
} from '../lib/samplePhoto';

interface PresetDetailModalProps {
  preset: Preset | null;
  isProUnlocked: boolean;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (presetId: string) => void;
  onUsePreset: (preset: Preset, sampleId: SamplePhotoId) => void;
}

export const PresetDetailModal: React.FC<PresetDetailModalProps> = ({
  preset,
  isProUnlocked,
  isFavorite,
  onClose,
  onToggleFavorite,
  onUsePreset
}) => {
  const [afterUrl, setAfterUrl] = useState<string>('');
  const [showBefore, setShowBefore] = useState(false);

  const signatureMeta = preset ? SIGNATURE_LOOK_PREVIEWS[preset.id] : undefined;
  const sampleId: SamplePhotoId = preset
    ? getPresetSampleId(preset.id, preset.category)
    : 'real:cafe_interior';
  const beforeUrl = preset
    ? (getSignatureLookSourceUrl(preset.id) ?? getSamplePhotoUrl(sampleId))
    : '';
  const objectPosition = preset && signatureMeta ? getSignatureLookObjectPosition(preset.id) : undefined;

  useEffect(() => {
    let active = true;
    setAfterUrl('');
    setShowBefore(false);
    if (!preset) return;
    const staticSignaturePreview = getSignatureLookPreviewUrl(preset.id);
    if (staticSignaturePreview) {
      setAfterUrl(staticSignaturePreview);
      return () => {
        active = false;
      };
    }
    renderStudioPresetPreview(preset.id, sampleId).then((url) => {
      if (active) setAfterUrl(url);
    });
    return () => {
      active = false;
    };
  }, [preset, sampleId]);

  if (!preset) return null;

  const traits: string[] = [];
  if (preset.lookType === 'adaptive') {
    traits.push(preset.id === 'night-cinema' ? 'Adaptive Night' : 'Adaptive Flash');
  }
  if (preset.recipe.relighting) {
    traits.push(
      preset.recipe.relighting.profile === 'night-cinema' ? 'Night Relight' : 'Subject Relight'
    );
  }
  if (preset.recipe.toneCurve) traits.push('Tone Curve');
  if (preset.recipe.colorGrading) traits.push('3-Way Grade');
  if (preset.recipe.effects && preset.recipe.effects.bloomStrength > 0) traits.push('Highlight Bloom');
  if (preset.recipe.effects && preset.recipe.effects.halationStrength > 0) traits.push('Analog Halation');
  if (preset.recipe.skinRosy > 0) traits.push('Rosy Skin');
  if (preset.recipe.bgDarken > 0) traits.push('Dark Background');
  if (preset.recipe.bgBokeh > 0) traits.push('Subtle Bokeh');
  if (preset.recipe.shadowCyan > 0) traits.push('Cool Shadows');
  if (preset.recipe.shadowWarm > 0) traits.push('Warm Tones');
  if (preset.recipe.fade > 0) traits.push('Film Fade');
  if (preset.recipe.grain > 0) traits.push('Organic Grain');
  if (traits.length === 0) traits.push('Balanced Tone');

  const collectionTitle =
    SIGNATURE_COLLECTIONS.find((c) => c.id === preset.collectionId)?.title ??
    (preset.collectionId === 'direct-flash'
      ? 'Direct Flash'
      : preset.collectionId === 'night-cinema'
        ? 'Night Cinema'
        : undefined);
  const catLabel = PRESET_CATEGORIES.find((c) => c.id === preset.category)?.label ?? preset.category;
  const subtitleText = collectionTitle
    ? `${collectionTitle.toUpperCase()} · ${(preset.lookType || 'signature').toUpperCase()}`
    : `${catLabel.toUpperCase()} COLLECTION`;

  return (
    <ModalSheet
      isOpen={Boolean(preset)}
      onClose={onClose}
      variant="sheet"
      title={preset.name}
      subtitle={subtitleText}
    >
      <div className="space-y-4">
        <div
          className="relative aspect-[4/5] max-h-[320px] mx-auto rounded-[12px] overflow-hidden border border-border bg-surfaceSecondary select-none cursor-pointer"
          onPointerDown={() => setShowBefore(true)}
          onPointerUp={() => setShowBefore(false)}
          onPointerLeave={() => setShowBefore(false)}
        >
          {afterUrl ? (
            <img
              src={showBefore ? beforeUrl : afterUrl}
              alt={preset.name}
              className="w-full h-full object-cover"
              style={objectPosition ? { objectPosition } : undefined}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full animate-pulse bg-surfaceSecondary" />
          )}

          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-medium">
            {showBefore ? 'Before' : 'Hold to compare'}
          </span>

          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {preset.isPro && !isProUnlocked ? (
              <StatusBadge tone="warning">
                <Crown className="w-3 h-3" strokeWidth={1.8} />
                PRO
              </StatusBadge>
            ) : preset.badge ? (
              <StatusBadge tone="olive">{preset.badge}</StatusBadge>
            ) : null}
          </div>
        </div>

        <p className="text-sm text-textSecondary leading-relaxed">
          {preset.description ||
            'Crafted for clean natural tones, balanced highlights, and editorial clarity.'}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {traits.slice(0, 4).map((t) => (
            <StatusBadge key={t} tone="neutral">
              {t}
            </StatusBadge>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            variant="icon"
            aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            onClick={() => onToggleFavorite(preset.id)}
            className={isFavorite ? 'border-primary text-primary bg-surfaceSecondary' : ''}
          >
            <Heart
              className={`w-5 h-5 ${isFavorite ? 'fill-primary text-primary' : ''}`}
              strokeWidth={1.8}
            />
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              onClose();
              onUsePreset(preset, sampleId);
            }}
          >
            <Sparkles className="w-4 h-4" strokeWidth={1.8} />
            Try in Editor
          </Button>
        </div>
      </div>
    </ModalSheet>
  );
};
