import React, { useEffect, useState } from 'react';
import { ArrowRight, Crown, Heart, ImagePlus, Sparkles } from 'lucide-react';
import { EDITORIAL_COLLECTIONS, PRESETS } from '../data/presets';
import { LicenseState, Preset, PresetCategory, RecentEdit } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Chip';
import { renderStudioPresetPreview } from '../lib/studioPreviews';
import { SamplePhotoId } from '../lib/samplePhoto';

interface HomeScreenProps {
  license: LicenseState;
  recentEdits: RecentEdit[];
  favoriteIds: string[];
  onStartEditing: () => void;
  onStartWithSample: (sampleId: SamplePhotoId, presetId?: string) => void;
  onOpenRecentEdit: (recent: RecentEdit) => void;
  onOpenCollection: (category: PresetCategory) => void;
  onSelectPresetDetail: (preset: Preset) => void;
  onToggleFavorite: (presetId: string) => void;
  onOpenDiscover: () => void;
  onOpenProfile: () => void;
  onOpenPro: () => void;
}

const RECOMMENDED_IDS = ['rosy-bokeh', 'seoul-cafe', 'portra-400', 'classic-chrome'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  license,
  recentEdits,
  favoriteIds,
  onStartEditing,
  onStartWithSample,
  onOpenRecentEdit,
  onOpenCollection,
  onSelectPresetDetail,
  onToggleFavorite,
  onOpenDiscover,
  onOpenProfile,
  onOpenPro
}) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const targets: { key: string; presetId: string; sampleId: SamplePhotoId }[] = [
      ...EDITORIAL_COLLECTIONS.map((c) => ({
        key: `col:${c.id}`,
        presetId: c.coverPresetId,
        sampleId: c.sampleId
      })),
      ...RECOMMENDED_IDS.map((pid) => ({
        key: `rec:${pid}`,
        presetId: pid,
        sampleId: (pid === 'rosy-bokeh' ? 'park' : pid === 'portra-400' || pid === 'classic-chrome' ? 'window' : 'cafe') as SamplePhotoId
      }))
    ];

    targets.forEach(({ key, presetId, sampleId }) => {
      renderStudioPresetPreview(presetId, sampleId).then((url) => {
        if (active && url) {
          setPreviews((prev) => ({ ...prev, [key]: url }));
        }
      });
    });

    return () => {
      active = false;
    };
  }, []);

  const recommendedPresets = RECOMMENDED_IDS.map((id) => PRESETS.find((p) => p.id === id)).filter(
    (p): p is Preset => Boolean(p)
  );

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[480px] md:max-w-[760px] mx-auto px-5 pt-4 pb-10 space-y-8">
        {/* 1. Brand header & profile avatar */}
        <header className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-semibold tracking-tight text-textPrimary">
              Auvori
            </span>
            <button
              onClick={onOpenPro}
              className="focus:outline-none"
              aria-label="Auvori Pro status"
            >
              <StatusBadge tone={license.isPro ? 'mocha' : 'neutral'}>
                <Crown className="w-3 h-3" strokeWidth={1.8} />
                {license.isPro ? 'PRO' : 'Free'}
              </StatusBadge>
            </button>
          </div>

          <button
            onClick={onOpenProfile}
            aria-label="Open profile"
            className="w-11 h-11 rounded-full bg-surfaceSecondary border border-border flex items-center justify-center text-sm font-semibold text-primary hover:border-taupe transition duration-fast"
          >
            {license.email ? license.email[0].toUpperCase() : 'A'}
          </button>
        </header>

        {/* 2. Greeting editorial */}
        <section className="space-y-2">
          <h1 className="font-display text-[36px] leading-[1.08] font-normal text-textPrimary tracking-tight">
            Make today beautiful.
          </h1>
          <p className="text-sm text-textSecondary leading-relaxed">
            Your moments, in your own tone. Less interface, more expression.
          </p>
        </section>

        {/* 3. CTA Start Editing */}
        <section className="space-y-3">
          <Button variant="primary" fullWidth onClick={onStartEditing}>
            <ImagePlus className="w-5 h-5" strokeWidth={1.8} />
            Create your look
          </Button>
          <button
            onClick={() => onStartWithSample('park', 'rosy-bokeh')}
            className="w-full py-2 text-xs font-medium text-textSecondary hover:text-primary transition duration-fast flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-taupe" strokeWidth={1.8} />
            <span>Preview Rosy Bokeh on studio portrait</span>
          </button>
        </section>

        {/* 4. Recent Edits */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary">Recent Edits</h2>
            {recentEdits.length > 0 && (
              <span className="text-xs text-textSecondary">{recentEdits.length} saved</span>
            )}
          </div>

          {recentEdits.length === 0 ? (
            <Card variant="info" className="p-6 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-[12px] bg-surfaceSecondary flex items-center justify-center text-taupe">
                <Sparkles className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-textPrimary">No edits yet</h3>
                <p className="text-xs text-textSecondary">Your creative journey starts here.</p>
              </div>
              <Button variant="soft" onClick={onStartEditing} className="h-10 px-4 text-xs">
                Start Editing
              </Button>
            </Card>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {recentEdits.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenRecentEdit(item)}
                  className="w-[116px] shrink-0 text-left group focus:outline-none"
                >
                  <Card variant="photo" interactive className="aspect-[4/5]">
                    <img
                      src={item.thumbDataUrl}
                      alt={item.presetName}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-normal"
                      draggable={false}
                    />
                  </Card>
                  <p className="mt-1.5 text-xs font-medium text-textPrimary truncate">
                    {item.presetName}
                  </p>
                  <p className="text-[11px] text-textSecondary truncate">{item.title}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 5. Featured Collections */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary">Featured Collections</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EDITORIAL_COLLECTIONS.map((col) => {
              const coverUrl = previews[`col:${col.id}`];
              return (
                <Card
                  key={col.id}
                  variant="collection"
                  interactive
                  onClick={() => onOpenCollection(col.category)}
                  className="text-left"
                >
                  <div className="aspect-[5/4] bg-surfaceSecondary overflow-hidden">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={col.title}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-surfaceSecondary" />
                    )}
                  </div>
                  <div className="p-3 space-y-0.5 bg-surface">
                    <h3 className="text-xs font-semibold text-textPrimary truncate">{col.title}</h3>
                    <p className="text-[11px] text-textSecondary truncate">{col.subtitle}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 6. Recommended Presets */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary">Recommended Presets</h2>
            <button
              onClick={() => onOpenCollection('all')}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              See all
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recommendedPresets.map((preset) => {
              const thumbUrl = previews[`rec:${preset.id}`];
              const isFav = favoriteIds.includes(preset.id);

              return (
                <Card
                  key={preset.id}
                  variant="photo"
                  interactive
                  onClick={() => onSelectPresetDetail(preset)}
                >
                  <div className="relative aspect-[4/5] bg-surfaceSecondary">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
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
                      aria-label={`Favorite ${preset.name}`}
                      className="absolute top-2 right-2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-border flex items-center justify-center text-textPrimary shadow-card hover:scale-105 transition duration-fast"
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
        </section>

        {/* 7. Inspiration / Discover */}
        <section className="space-y-3">
          <Card
            variant="feature"
            interactive
            onClick={onOpenDiscover}
            className="p-5 flex items-center justify-between gap-4 bg-surfaceSecondary"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Editorial Journal
              </span>
              <h3 className="font-display text-xl font-semibold text-textPrimary leading-snug">
                Explore tonal recipes &amp; natural portrait lighting
              </h3>
            </div>
            <div className="w-11 h-11 rounded-[12px] bg-surface border border-border flex items-center justify-center text-primary shrink-0">
              <ArrowRight className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};
