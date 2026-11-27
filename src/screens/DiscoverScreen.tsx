import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { DISCOVER_STORIES, PRESETS } from '../data/presets';
import { Preset } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Chip';
import {
  renderStudioPresetPreview,
  getSignatureLookPreviewUrl,
  getSignatureLookSourceUrl,
  getSignatureLookObjectPosition
} from '../lib/studioPreviews';
import { getPresetSampleId, getSamplePhotoUrl, SamplePhotoId } from '../lib/samplePhoto';

interface DiscoverScreenProps {
  onTryLook: (preset: Preset, sampleId: SamplePhotoId) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ onTryLook }) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [holdingId, setHoldingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    DISCOVER_STORIES.forEach((story) => {
      if (getSignatureLookPreviewUrl(story.presetId)) return;
      const realSampleId = getPresetSampleId(story.presetId);
      renderStudioPresetPreview(story.presetId, realSampleId).then((url) => {
        if (active && url) {
          setPreviews((prev) => ({ ...prev, [story.id]: url }));
        }
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[540px] md:max-w-[780px] lg:max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold text-textPrimary tracking-tight">
            Discover
          </h1>
          <p className="text-xs sm:text-sm text-textSecondary">
            Editorial tone notes &amp; lookbooks. Hold any photograph to compare Before / After.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {DISCOVER_STORIES.map((story) => {
            const preset = PRESETS.find((p) => p.id === story.presetId);
            if (!preset) return null;
            const realSampleId = getPresetSampleId(story.presetId, preset.category);
            const afterUrl = getSignatureLookPreviewUrl(story.presetId) || previews[story.id];
            const beforeUrl = getSignatureLookSourceUrl(story.presetId) || getSamplePhotoUrl(realSampleId);
            const objectPosition = getSignatureLookObjectPosition(story.presetId);
            const isHolding = holdingId === story.id;

            return (
              <Card key={story.id} variant="feature" className="flex flex-col">
                <div
                  className="relative aspect-[4/5] bg-surfaceSecondary select-none cursor-pointer overflow-hidden"
                  onPointerDown={() => setHoldingId(story.id)}
                  onPointerUp={() => setHoldingId(null)}
                  onPointerLeave={() => setHoldingId(null)}
                >
                  {afterUrl ? (
                    <img
                      src={isHolding ? beforeUrl : afterUrl}
                      alt={story.title}
                      className="w-full h-full object-cover"
                      style={{ objectPosition }}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-surfaceSecondary" />
                  )}

                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-medium">
                    {isHolding ? 'Before (Original)' : 'Hold to compare'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4 bg-surface border-t border-border/60">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge tone="neutral">{story.tag}</StatusBadge>
                      <span className="text-[11px] font-semibold text-olive">{preset.name}</span>
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-textPrimary leading-snug tracking-tight">
                        {story.title}
                      </h2>
                      <p className="text-xs text-textSecondary leading-relaxed">{story.excerpt}</p>
                    </div>
                  </div>

                  <Button
                    variant="soft"
                    fullWidth
                    onClick={() => onTryLook(preset, realSampleId)}
                  >
                    <Sparkles className="w-4 h-4 text-olive" strokeWidth={1.8} />
                    Try {preset.name} in Editor
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
