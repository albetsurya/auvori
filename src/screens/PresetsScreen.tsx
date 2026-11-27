import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Heart, Search, Sparkles } from 'lucide-react';
import { PRESET_CATEGORIES, PRESETS, SIGNATURE_COLLECTIONS } from '../data/presets';
import { CuratedCollectionId, LicenseState, Preset, PresetCategory } from '../types';
import { Card } from '../components/ui/Card';
import { FilterChip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  renderStudioPresetPreview,
  getSignatureLookPreviewUrl,
  getSignatureLookObjectPosition
} from '../lib/studioPreviews';
import { getPresetSampleId } from '../lib/samplePhoto';

interface PresetsScreenProps {
  license: LicenseState;
  category: PresetCategory;
  collectionId?: CuratedCollectionId | null;
  favoriteIds: string[];
  onChangeCategory: (cat: PresetCategory) => void;
  onChangeCollection?: (col: CuratedCollectionId | null) => void;
  onToggleFavorite: (presetId: string) => void;
  onSelectPresetDetail: (preset: Preset) => void;
}

export const PresetsScreen: React.FC<PresetsScreenProps> = ({
  license,
  category,
  collectionId = null,
  favoriteIds,
  onChangeCategory,
  onChangeCollection,
  onToggleFavorite,
  onSelectPresetDetail
}) => {
  const [query, setQuery] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const activeCollection = useMemo(
    () => SIGNATURE_COLLECTIONS.find((c) => c.id === collectionId) ?? null,
    [collectionId]
  );

  const visiblePresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRESETS.filter((p) => {
      if (p.id === 'original') return false;
      if (collectionId && p.collectionId !== collectionId) return false;
      if (category === 'free' && p.isPro) return false;
      if (category === 'favorites' && !favoriteIds.includes(p.id)) return false;
      if (
        !collectionId &&
        category !== 'all' &&
        category !== 'free' &&
        category !== 'favorites' &&
        p.category !== category
      ) {
        return false;
      }
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !(p.description || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [category, collectionId, favoriteIds, query]);

  useEffect(() => {
    let active = true;
    visiblePresets.forEach((p, idx) => {
      if (getSignatureLookPreviewUrl(p.id) || previews[p.id]) return;
      const sampleId = getPresetSampleId(p.id, p.category);
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
      <div className="max-w-[540px] md:max-w-[780px] lg:max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-12 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold text-textPrimary tracking-tight">
              {activeCollection ? activeCollection.title : 'Find your signature tone.'}
            </h1>
            <p className="text-xs sm:text-sm text-textSecondary">
              {activeCollection
                ? activeCollection.description
                : 'Curated color science designed for natural skin, analog curves & editorial depth.'}
            </p>
          </div>

          <div className="w-full lg:w-[340px]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search looks (e.g. Porcelain, Velvet, Halation)..."
              leftIcon={<Search className="w-4 h-4" strokeWidth={1.8} />}
            />
          </div>
        </div>

        {/* Curated Signature Collections Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <FilterChip
            selected={!collectionId && category === 'all'}
            onClick={() => {
              onChangeCollection?.(null);
              onChangeCategory('all');
            }}
          >
            All Looks
          </FilterChip>
          {SIGNATURE_COLLECTIONS.map((col) => (
            <FilterChip
              key={col.id}
              selected={collectionId === col.id}
              onClick={() => {
                onChangeCategory('all');
                onChangeCollection?.(collectionId === col.id ? null : col.id);
              }}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />
              {col.title}
            </FilterChip>
          ))}
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {PRESET_CATEGORIES.map((cat) => (
            <FilterChip
              key={cat.id}
              selected={!collectionId && category === cat.id}
              onClick={() => {
                onChangeCollection?.(null);
                onChangeCategory(cat.id);
              }}
            >
              {cat.id === 'favorites' && (
                <Heart
                  className={`w-3.5 h-3.5 ${!collectionId && category === 'favorites' ? 'fill-current' : ''}`}
                  strokeWidth={1.8}
                />
              )}
              {cat.label}
            </FilterChip>
          ))}
        </div>

        {visiblePresets.length === 0 ? (
          <Card variant="info" className="p-6 text-center space-y-3">
            <div className="w-11 h-11 mx-auto rounded-[10px] bg-surfaceSecondary flex items-center justify-center text-olive">
              <Heart className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-textPrimary">
                {category === 'favorites' ? 'Your favorites will live here.' : 'No looks found'}
              </h3>
              <p className="text-xs text-textSecondary">
                {category === 'favorites'
                  ? 'Tap the heart on any look to build your personal studio collection.'
                  : 'Try another filter or search keyword.'}
              </p>
            </div>
            <Button
              variant="soft"
              onClick={() => {
                setQuery('');
                onChangeCollection?.(null);
                onChangeCategory('all');
              }}
              className="px-4 text-xs"
            >
              Explore all looks
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {visiblePresets.map((preset) => {
              const signatureUrl = getSignatureLookPreviewUrl(preset.id);
              const url = signatureUrl || previews[preset.id];
              const objectPosition = signatureUrl
                ? getSignatureLookObjectPosition(preset.id)
                : preset.category === 'portrait' || preset.id === 'gangnam-glass' || preset.id === 'portra-400' || preset.id === 'mono-leica'
                  ? '50% 25%'
                  : '50% 50%';
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
                        style={objectPosition ? { objectPosition } : undefined}
                        loading="lazy"
                        decoding="async"
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
                      className="absolute top-2 right-2 min-w-[44px] min-h-[44px] w-11 h-11 rounded-[8px] bg-surface/90 backdrop-blur-sm border border-border flex items-center justify-center text-textPrimary shadow-card hover:scale-105 transition duration-fast"
                    >
                      <Heart
                        className={`w-4 h-4 ${isFav ? 'fill-primary text-primary' : ''}`}
                        strokeWidth={1.8}
                      />
                    </button>

                    {preset.isPro && !license.isPro ? (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-[6px] bg-graphite/85 text-chalk text-[10px] font-semibold tracking-wider flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" strokeWidth={1.8} />
                        PRO
                      </span>
                    ) : preset.badge ? (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-[6px] bg-olive text-white text-[10px] font-semibold">
                        {preset.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3 bg-surface border-t border-border/60 space-y-0.5">
                    <div className="text-xs font-semibold text-textPrimary truncate">
                      {preset.name}
                    </div>
                    <div className="text-[11px] text-textSecondary truncate">
                      {preset.description || preset.category}
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
