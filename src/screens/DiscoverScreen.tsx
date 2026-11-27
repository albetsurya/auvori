import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { DISCOVER_STORIES, PRESETS } from '../data/presets';
import { Preset } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Chip';
import { renderStudioPresetPreview } from '../lib/studioPreviews';
import { createSamplePhotoDataUrl, SamplePhotoId } from '../lib/samplePhoto';

interface DiscoverScreenProps {
  onTryLook: (preset: Preset, sampleId: SamplePhotoId) => void;
}

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ onTryLook }) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [holdingId, setHoldingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    DISCOVER_STORIES.forEach((story) => {
      renderStudioPresetPreview(story.presetId, story.sampleId).then((url) => {
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
      <div className="max-w-[480px] md:max-w-[760px] mx-auto px-5 pt-6 pb-10 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-[30px] leading-tight font-medium text-textPrimary">
            Discover
          </h1>
          <p className="text-xs text-textSecondary">
            Editorial tone notes &amp; lookbooks. Hold any photograph to compare Before / After.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DISCOVER_STORIES.map((story) => {
            const preset = PRESETS.find((p) => p.id === story.presetId);
            if (!preset) return null;
            const afterUrl = previews[story.id];
            const beforeUrl = createSamplePhotoDataUrl(story.sampleId);
            const isHolding = holdingId === story.id;

            return (
              <Card key={story.id} variant="feature">
                <div
                  className="relative aspect-[4/5] bg-surfaceSecondary select-none cursor-pointer"
                  onPointerDown={() => setHoldingId(story.id)}
                  onPointerUp={() => setHoldingId(null)}
                  onPointerLeave={() => setHoldingId(null)}
                >
                  {afterUrl ? (
                    <img
                      src={isHolding ? beforeUrl : afterUrl}
                      alt={story.title}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-surfaceSecondary" />
                  )}

                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink/75 text-ivory text-[10px] font-medium">
                    {isHolding ? 'Before (Original)' : 'Hold to compare'}
                  </span>
                </div>

                <div className="p-5 space-y-3 bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge tone="neutral">{story.tag}</StatusBadge>
                    <span className="text-[11px] font-semibold text-primary">{preset.name}</span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="font-display text-2xl font-semibold text-textPrimary leading-snug">
                      {story.title}
                    </h2>
                    <p className="text-xs text-textSecondary leading-relaxed">{story.excerpt}</p>
                  </div>

                  <Button
                    variant="soft"
                    fullWidth
                    onClick={() => onTryLook(preset, story.sampleId)}
                  >
                    <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.8} />
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
