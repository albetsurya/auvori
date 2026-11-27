import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Heart, Search } from 'lucide-react';
import { PRESET_CATEGORIES, PRESETS } from '../data/presets';
import { LicenseState, Preset, PresetCategory } from '../types';
import { Card } from '../components/ui/Card';
import { FilterChip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { renderStudioPresetPreview } from '../lib/studioPreviews';
import { SamplePhotoId } from '../lib/samplePhoto';

interface PresetsScreenProps {
  license: LicenseState;
  category: PresetCategory;
  favoriteIds: string[];
  onChangeCategory: (cat: PresetCategory) => void;
  onToggleFavorite: (presetId: string) => void;
  onSelectPresetDetail: (preset: Preset) => void;
}

export const PresetsScreen: React.FC<PresetsScreenProps> = ({
  license,
  category,
  favoriteIds,
  onChangeCategory,
  onToggleFavorite,
  onSelectPresetDetail
}) => {
  const [query, setQuery] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const visiblePresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRESETS.filter((p) => {
      if (p.id === 'original') return false;
      if (category === 'free' && p.isPro) return false;
      if (category === 'favorites' && !favoriteIds.includes(p.id)) return false;
      if (
        category !== 'all' &&
        category !== 'free' &&
        category !== 'favorites' &&
        p.category !== category
      ) {
        return false;
      }
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [category, favoriteIds, query]);

  useEffect(() => {
    let active = true;
    visiblePresets.forEach((p, idx) => {
      if (previews[p.id]) return;
      const sampleId: SamplePhotoId =
        p.category === 'portrait' ? 'park' : p.category === 'film' ? 'window' : 'cafe';
      setTimeout(() => {
        if (!active) return;
        renderStudioPresetPreview(p.id, sampleId).then((url) => {
          if (active && url) {
            setPreviews((prev) => ({ ...prev, [p.id]: url }));
          }
        });
      }, idx * 12);
    });
    return () => {
      active = false;
    };
  }, [visiblePresets, previews]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[480px] md:max-w-[760px] mx-auto px-5 pt-6 pb-10 space-y-5">
        <div className="space-y-1">
          <h1 className="font-display text-[30px] leading-tight font-medium text-textPrimary">
            Find your signature tone.
          </h1>
          <p className="text-xs text-textSecondary">
            Curated color recipes designed for natural skin &amp; editorial depth.
          </p>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search presets (e.g. Rosy, Seoul, Portra)..."
          leftIcon={<Search className="w-4 h-4" strokeWidth={1.8} />}
        />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {PRESET_CATEGORIES.map((cat) => (
            <FilterChip
              key={cat.id}
              selected={category === cat.id}
              onClick={() => onChangeCategory(cat.id)}
            >
              {cat.id === 'favorites' && (
                <Heart
                  className={`w-3.5 h-3.5 ${category === 'favorites' ? 'fill-current' : ''}`}
                  strokeWidth={1.8}
                />
              )}
              {cat.label}
            </FilterChip>
          ))}
        </div>

        {visiblePresets.length === 0 ? (
          <Card variant="info" className="p-6 text-center space-y-3">
            <div className="w-11 h-11 mx-auto rounded-[12px] bg-surfaceSecondary flex items-center justify-center text-taupe">
              <Heart className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">
                {category === 'favorites' ? 'Your favorites will live here.' : 'No presets found'}
              </h3>
              <p className="text-xs text-textSecondary">
                {category === 'favorites'
                  ? 'Tap the heart on any preset to build your personal studio collection.'
                  : 'Try another filter or search keyword.'}
              </p>
            </div>
            <Button
              variant="soft"
              onClick={() => {
                setQuery('');
                onChangeCategory('all');
              }}
              className="h-10 px-4 text-xs"
            >
              Explore all presets
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {visiblePresets.map((preset) => {
              const url = previews[preset.id];
              const isFav = favoriteIds.includes(preset.id);

              return (
                <Card
                  key={preset.id}
                  variant="photo"
                  interactive
                  onClick={() => onSelectPresetDetail(preset)}
                >
                  <div className="relative aspect-[4/5] bg-surfaceSecondary">
                    {url ? (
                      <img
                        src={url}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-surfaceSecondary" />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(preset.id);
                      }}
                      aria-label={`Toggle favorite ${preset.name}`}
                      className="absolute top-2 right-2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-border flex items-center justify-center text-textPrimary shadow-card"
                    >
                      <Heart
                        className={`w-4 h-4 ${isFav ? 'fill-primary text-primary' : ''}`}
                        strokeWidth={1.8}
                      />
                    </button>

                    {preset.isPro && !license.isPro ? (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-[6px] bg-ink/80 text-ivory text-[10px] font-medium flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" strokeWidth={1.8} />
                        PRO
                      </span>
                    ) : preset.badge ? (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-[6px] bg-primary text-primaryText text-[10px] font-medium">
                        {preset.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3 bg-surface">
                    <div className="text-xs font-semibold text-textPrimary truncate">
                      {preset.name}
                    </div>
                    <div className="text-[11px] text-textSecondary capitalize mt-0.5">
                      {preset.category}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
