import React, { useEffect, useState } from 'react';
import { ArrowRight, Crown, FlaskConical, Heart, ImagePlus, Sparkles } from 'lucide-react';
import { PRESETS, SIGNATURE_COLLECTIONS } from '../data/presets';
import { CuratedCollectionId, LicenseState, Preset, PresetCategory, RecentEdit } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Chip';
import { AuvoriLogo } from '../components/AuvoriLogo';
import {
  renderStudioPresetPreview,
  getCollectionCoverUrl,
  getSignatureLookPreviewUrl,
  getSignatureLookObjectPosition
} from '../lib/studioPreviews';
import { SamplePhotoId } from '../lib/samplePhoto';

interface HomeScreenProps {
  license: LicenseState;
  recentEdits: RecentEdit[];
  favoriteIds: string[];
  onStartEditing: () => void;
  onStartWithSample: (sampleId: SamplePhotoId, presetId?: string) => void;
  onOpenRecentEdit: (recent: RecentEdit) => void;
  onOpenCollection: (category: PresetCategory, collectionId?: CuratedCollectionId) => void;
  onSelectPresetDetail: (preset: Preset) => void;
  onToggleFavorite: (presetId: string) => void;
  onOpenDiscover: () => void;
  onOpenProfile: () => void;
  onOpenPro: () => void;
  onOpenStudioSamples: () => void;
}

const SIGNATURE_LOOK_IDS = [
  'porcelain-bloom',
  'velvet-noir',
  'hannam-daylight',
  'amber-halation',
  'silver-gelatin'
] as const;

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
  onOpenPro,
  onOpenStudioSamples
}) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    // Only render previews for the desktop hero pair using real studio sample photos.
    // Signature Collection covers and Signature Looks cards are served as static WebP assets.
    const targets: { key: string; presetId: string; sampleId: SamplePhotoId }[] = [
      { key: 'hero:rosy-bokeh', presetId: 'rosy-bokeh', sampleId: 'real:daylight_portrait' },
      { key: 'hero:seoul-cafe', presetId: 'seoul-cafe', sampleId: 'real:cafe_interior' }
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

  const signatureLookPresets = SIGNATURE_LOOK_IDS.map((id) => PRESETS.find((p) => p.id === id)).filter(
    (p): p is Preset => Boolean(p)
  );

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[540px] md:max-w-[780px] lg:max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-8 pt-4 lg:pt-8 pb-12 space-y-8 lg:space-y-10">
        {/* 1. Mobile & Tablet Header (hidden on lg+ where TopStudioBar renders) */}
        <header className="lg:hidden h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AuvoriLogo size={30} />
            <button
              onClick={onOpenPro}
              className="focus:outline-none min-h-[44px] flex items-center"
              aria-label="Auvori Pro status"
            >
              <StatusBadge tone={license.isPro ? 'olive' : 'neutral'}>
                <Crown className="w-3 h-3" strokeWidth={1.8} />
                {license.isPro ? 'PRO' : 'Free'}
              </StatusBadge>
            </button>
          </div>

          <button
            onClick={onOpenProfile}
            aria-label="Open profile"
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-[8px] bg-surface border border-border flex items-center justify-center text-sm font-semibold text-graphite hover:border-olive transition duration-fast"
          >
            {license.email ? license.email[0].toUpperCase() : 'A'}
          </button>
        </header>

        {/* 2. Hero Editorial Block */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-olive-soft border border-stone text-[11px] font-semibold tracking-wider uppercase text-olive">
                Neutral Analog Studio
              </span>
              <h1 className="text-[32px] sm:text-[38px] lg:text-[44px] leading-[1.08] font-semibold text-textPrimary tracking-tight">
                Make every frame count.
              </h1>
              <p className="text-sm sm:text-base text-textSecondary leading-relaxed max-w-[460px]">
                Explore your look. Refine your tone. Make it yours.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="primary" onClick={onStartEditing} className="sm:min-w-[200px]">
                <ImagePlus className="w-5 h-5" strokeWidth={1.8} />
                Open a Photo
              </Button>
              <button
                onClick={onOpenStudioSamples}
                className="min-h-[44px] px-4 rounded-[10px] border border-border bg-surface hover:bg-surfaceSecondary text-xs font-medium text-textPrimary transition duration-fast flex items-center justify-center gap-2"
                aria-label="Browse studio sample photos"
              >
                <FlaskConical className="w-3.5 h-3.5 text-olive" strokeWidth={1.8} />
                <span>Try a Studio Sample</span>
              </button>
            </div>
          </div>

          {/* Desktop Studio Visual Pair */}
          <div className="hidden lg:grid lg:col-span-6 grid-cols-2 gap-4">
            {[
              {
                key: 'hero:rosy-bokeh',
                presetId: 'rosy-bokeh',
                sampleId: 'real:daylight_portrait' as SamplePhotoId,
                title: 'Rosy Bokeh',
                caption: 'Luminous Portrait'
              },
              {
                key: 'hero:seoul-cafe',
                presetId: 'seoul-cafe',
                sampleId: 'real:cafe_interior' as SamplePhotoId,
                title: 'Seoul Café',
                caption: 'Clean Indoor Light'
              }
            ].map((item) => {
              const url = previews[item.key];
              return (
                <button
                  key={item.key}
                  onClick={() => onStartWithSample(item.sampleId, item.presetId)}
                  className="text-left group focus:outline-none"
                  aria-label={`Preview ${item.title} preset`}
                >
                  <Card variant="photo" interactive>
                    <div className="relative aspect-[4/5] bg-surfaceSecondary">
                      {url ? (
                        <img
                          src={url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-normal"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full animate-pulse bg-surfaceSecondary" aria-hidden="true" />
                      )}
                      <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-[6px] bg-graphite/80 text-chalk text-[11px] font-medium">
                        {item.title}
                      </span>
                    </div>
                  </Card>
                  <div className="mt-1.5 text-[11px] font-medium text-textSecondary px-0.5">
                    {item.caption}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Recent Edits */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary tracking-tight">Recent Edits</h2>
            {recentEdits.length > 0 && (
              <span className="text-xs text-textSecondary tabular-nums">
                {recentEdits.length} saved
              </span>
            )}
          </div>

          {recentEdits.length === 0 ? (
            <Card variant="info" className="p-6 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-[10px] bg-olive-soft border border-stone flex items-center justify-center text-olive" aria-hidden="true">
                <Sparkles className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-textPrimary">No recent edits yet</h3>
                <p className="text-xs text-textSecondary">
                  Open a photo from your device or start with a studio sample.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="soft" onClick={onStartEditing} className="px-4 text-xs">
                  Open a Photo
                </Button>
                <button
                  onClick={onOpenStudioSamples}
                  className="min-h-[44px] px-4 rounded-[10px] border border-border bg-surface hover:bg-surfaceSecondary text-xs font-medium text-textPrimary transition duration-fast flex items-center justify-center gap-1.5"
                  aria-label="Browse studio sample photos"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-olive" strokeWidth={1.8} />
                  Try a Studio Sample
                </button>
              </div>
            </Card>
          ) : (
            <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3.5 overflow-x-auto no-scrollbar pb-1">
              {recentEdits.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenRecentEdit(item)}
                  className="w-[122px] md:w-auto shrink-0 text-left group focus:outline-none"
                  aria-label={`Open recent edit: ${item.presetName}`}
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

        {/* 4. Signature Collections — real photographic covers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary tracking-tight">
              Signature Collections
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {SIGNATURE_COLLECTIONS.map((col) => {
              const coverUrl = getCollectionCoverUrl(col.id);
              const memberCount = PRESETS.filter((p) => p.collectionId === col.id).length;
              return (
                <Card
                  key={col.id}
                  variant="collection"
                  interactive
                  onClick={() => onOpenCollection('all', col.id)}
                  className="text-left"
                >
                  <div className="relative aspect-[5/4] bg-surfaceSecondary overflow-hidden">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={`${col.title} collection — real photograph`}
                        className="w-full h-full object-cover"
                        draggable={false}
                        loading="lazy"
                        style={{ objectPosition: col.id === 'rosy-portrait' ? '50% 30%' : col.id === 'velvet-series' ? '50% 25%' : '50% 50%' }}
                      />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-surfaceSecondary" aria-hidden="true" />
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-[6px] bg-graphite/80 text-chalk text-[10px] font-medium tabular-nums">
                      {memberCount} looks
                    </span>
                  </div>
                  <div className="p-3 space-y-0.5 bg-surface border-t border-border/60">
                    <h3 className="text-xs font-semibold text-textPrimary truncate">{col.title}</h3>
                    <p className="text-[11px] text-textSecondary truncate">{col.subtitle}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 5. Signature Looks — preset-rendered photographic previews */}
        <section className="space-y-3" aria-label="Signature Looks">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-textPrimary tracking-tight">
              Signature Looks
            </h2>
            <button
              onClick={() => onOpenCollection('all')}
              className="min-h-[44px] px-2 text-xs font-medium text-olive hover:underline flex items-center gap-1"
              aria-label="See all presets"
            >
              See all
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {signatureLookPresets.map((preset) => {
              const thumbUrl = getSignatureLookPreviewUrl(preset.id);
              const objectPosition = getSignatureLookObjectPosition(preset.id);
              const isFav = favoriteIds.includes(preset.id);

              return (
                <Card
                  key={preset.id}
                  variant="photo"
                  interactive
                  onClick={() => onSelectPresetDetail(preset)}
                >
                  <div className="relative aspect-[4/5] bg-surfaceSecondary overflow-hidden">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`${preset.name} Signature Look photographic preview`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition }}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-surfaceSecondary" aria-hidden="true" />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(preset.id);
                      }}
                      aria-label={`${isFav ? 'Remove from' : 'Add to'} favorites: ${preset.name}`}
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
                  <div className="p-3 bg-surface border-t border-border/60">
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

        {/* 6. Editorial Journal / Discover */}
        <section>
          <Card
            variant="feature"
            interactive
            onClick={onOpenDiscover}
            className="p-5 sm:p-6 flex items-center justify-between gap-4 bg-olive-soft"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-olive">
                Editorial Journal
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-graphite leading-snug tracking-tight">
                Explore tonal recipes &amp; natural portrait lighting
              </h3>
            </div>
            <div className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-[10px] bg-surface border border-border flex items-center justify-center text-olive shrink-0" aria-hidden="true">
              <ArrowRight className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};
