import React, { useMemo, useState } from 'react';
import {
  Check,
  Crop,
  Crown,
  FlipHorizontal2,
  Heart,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import {
  ACTIVE_ADAPTIVE_COLOR_DEFAULT_STRENGTH,
  AspectRatioOption,
  DEFAULT_ADAPTIVE_COLOR_STRENGTH,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  ImageTransform,
  ManualAdjustments,
  Preset,
  PresetCategory
} from '../types';
import { PRESET_CATEGORIES, PRESETS } from '../data/presets';
import { FilterChip } from './ui/Chip';
import { Slider } from './ui/Slider';

interface PresetDrawerProps {
  activePreset: Preset;
  intensity: number;
  manual: ManualAdjustments;
  transform: ImageTransform;
  adaptiveColorStrength: number;
  adaptiveColorStatus: 'idle' | 'analyzing' | 'ready' | 'error';
  adaptiveColorError?: string | null;
  thumbnails: Record<string, string>;
  favoriteIds: string[];
  isProUnlocked: boolean;
  onSelectPreset: (preset: Preset) => void;
  onChangeIntensity: (val: number) => void;
  onCommitIntensity: () => void;
  onChangeManual: (next: ManualAdjustments) => void;
  onCommitManual: () => void;
  onChangeAdaptiveColorStrength: (val: number) => void;
  onCommitAdaptiveColorStrength: (val?: number) => void;
  onChangeTransform: (next: ImageTransform) => void;
  onToggleFavorite: (presetId: string) => void;
}

const ASPECT_OPTIONS: { id: AspectRatioOption; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: '4:5', label: '4:5 Portrait' },
  { id: '1:1', label: '1:1 Square' },
  { id: '16:9', label: '16:9 Wide' }
];

const ADJUST_CONTROLS: { key: keyof ManualAdjustments; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'Exposure', min: -35, max: 35 },
  { key: 'contrast', label: 'Contrast', min: -35, max: 35 },
  { key: 'temperature', label: 'Warmth', min: -35, max: 35 },
  { key: 'saturation', label: 'Saturation', min: -35, max: 35 },
  { key: 'skinRosy', label: 'Rosy Skin', min: 0, max: 45 },
  { key: 'bgDarken', label: 'Darken BG', min: 0, max: 50 },
  { key: 'bgBokeh', label: 'Pro Bokeh', min: 0, max: 40 },
  { key: 'grain', label: 'Film Grain', min: 0, max: 35 }
];

export const PresetDrawer: React.FC<PresetDrawerProps> = ({
  activePreset,
  intensity,
  manual,
  transform,
  adaptiveColorStrength,
  adaptiveColorStatus,
  adaptiveColorError,
  thumbnails,
  favoriteIds,
  isProUnlocked,
  onSelectPreset,
  onChangeIntensity,
  onCommitIntensity,
  onChangeManual,
  onCommitManual,
  onChangeAdaptiveColorStrength,
  onCommitAdaptiveColorStrength,
  onChangeTransform,
  onToggleFavorite
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'adjust' | 'crop'>('presets');
  const [category, setCategory] = useState<PresetCategory>('all');

  const filteredPresets = useMemo(() => {
    if (category === 'all') return PRESETS;
    if (category === 'free') return PRESETS.filter((p) => !p.isPro);
    if (category === 'favorites') {
      return PRESETS.filter((p) => p.id === 'original' || favoriteIds.includes(p.id));
    }
    return PRESETS.filter((p) => p.id === 'original' || p.category === category);
  }, [category, favoriteIds]);

  const isActiveFav = favoriteIds.includes(activePreset.id);
  const hasManualChanges = Object.values(manual).some((v) => v !== 0);

  return (
    <aside
      aria-label="Editor Inspector"
      className="bg-surface border-t border-border pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 z-20 lg:w-[344px] xl:w-[368px] lg:h-full lg:border-t-0 lg:border-l lg:pt-4 lg:pb-5 lg:flex lg:flex-col lg:overflow-hidden"
    >
      {/* Top control bar: single responsive mode switcher + intensity / section header */}
      <div className="px-4 pb-2.5 flex items-center lg:flex-col lg:items-stretch gap-2.5 lg:gap-3 min-h-[44px] shrink-0">
        {/* Mode Switcher: right-aligned on mobile, full-width top segmented control on desktop */}
        <div className="order-2 lg:order-1 flex lg:grid lg:grid-cols-3 items-center gap-0.5 lg:gap-1 bg-surfaceSecondary rounded-[8px] p-0.5 lg:p-1 border border-border shrink-0">
          {[
            { id: 'presets', label: 'Looks', icon: Sparkles, activeDot: false },
            {
              id: 'adjust',
              label: 'Adjust',
              icon: SlidersHorizontal,
              activeDot: adaptiveColorStrength > 0 || hasManualChanges
            },
            { id: 'crop', label: 'Crop', icon: Crop, activeDot: false }
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={tab.label}
                aria-pressed={selected}
                onClick={() => setActiveTab(tab.id as 'presets' | 'adjust' | 'crop')}
                className={`relative min-w-[44px] min-h-[44px] lg:min-h-[40px] px-2 lg:px-2.5 py-1.5 rounded-[6px] text-[11px] lg:text-xs font-medium flex items-center justify-center gap-1.5 transition duration-fast ${
                  selected
                    ? 'bg-primary text-primaryText shadow-card'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.activeDot && !selected && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Intensity slider OR section header */}
        <div className="order-1 lg:order-2 flex-1 flex items-center gap-2 min-w-0">
          {activeTab === 'presets' ? (
            activePreset.id !== 'original' ? (
              <>
                <button
                  onClick={() => onToggleFavorite(activePreset.id)}
                  aria-label={`Favorite ${activePreset.name}`}
                  className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-[8px] flex items-center justify-center text-textSecondary hover:text-primary hover:bg-surfaceSecondary transition duration-fast shrink-0"
                >
                  <Heart
                    className={`w-4 h-4 ${isActiveFav ? 'fill-primary text-primary' : ''}`}
                    strokeWidth={1.8}
                  />
                </button>
                <span className="text-xs font-medium text-textPrimary w-16 sm:w-20 truncate shrink-0">
                  {activePreset.name}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={intensity}
                  onChange={(e) => onChangeIntensity(Number(e.target.value))}
                  onPointerUp={onCommitIntensity}
                  onKeyUp={onCommitIntensity}
                  style={{ '--slider-pct': `${intensity}%` } as React.CSSProperties}
                  className="auvori-slider flex-1 min-w-[60px]"
                  aria-label="Intensitas Preset"
                />
                <span className="text-xs font-medium text-textSecondary w-9 text-right tabular-nums shrink-0">
                  {intensity}%
                </span>
              </>
            ) : (
              <span className="text-xs text-textSecondary truncate">
                Select a look below to style your photograph
              </span>
            )
          ) : activeTab === 'adjust' ? (
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-textPrimary">Fine-tune Tones</span>
              {hasManualChanges && (
                <button
                  onClick={() => {
                    onChangeManual(DEFAULT_ADJUSTMENTS);
                    onCommitManual();
                  }}
                  className="min-h-[36px] px-2.5 rounded-[6px] text-[11px] font-medium text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary inline-flex items-center gap-1 transition duration-fast"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.8} />
                  Reset
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 text-xs font-semibold text-textPrimary">Crop &amp; Orientation</div>
          )}
        </div>
      </div>

      {activeTab === 'presets' ? (
        <div className="lg:flex-1 lg:flex lg:flex-col lg:min-h-0">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar shrink-0">
            {PRESET_CATEGORIES.map((cat) => (
              <FilterChip
                key={cat.id}
                selected={category === cat.id}
                onClick={() => setCategory(cat.id)}
                className="min-h-[40px] h-10 px-3 text-[11px]"
              >
                {cat.label}
              </FilterChip>
            ))}
          </div>

          {/* Mobile horizontal 4:5 carousel / Desktop 3-col scrollable grid */}
          <div className="flex items-center gap-2.5 px-4 overflow-x-auto no-scrollbar pb-1 lg:grid lg:grid-cols-3 lg:gap-2.5 lg:overflow-y-auto lg:overflow-x-hidden lg:flex-1 lg:content-start lg:pb-2">
            {filteredPresets.map((preset) => {
              const isSelected = activePreset.id === preset.id;
              const thumb = thumbnails[preset.id];
              const showLockBadge = preset.isPro && !isProUnlocked;

              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className="flex flex-col items-center gap-1.5 shrink-0 lg:w-full group focus:outline-none"
                >
                  <div
                    className={`relative w-[68px] h-[85px] lg:w-full lg:h-auto lg:aspect-[4/5] rounded-[10px] overflow-hidden border-2 transition duration-normal bg-surfaceSecondary ${
                      isSelected
                        ? 'border-primary shadow-card scale-[1.02]'
                        : 'border-border group-hover:border-primary/60'
                    }`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={preset.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div
                        className="w-full h-full opacity-40"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                    )}

                    {/* Pro or Editorial Badge */}
                    {showLockBadge ? (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-graphite/85 text-chalk text-[9px] font-semibold flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" strokeWidth={1.8} />
                        PRO
                      </span>
                    ) : preset.badge ? (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-primary text-primaryText text-[9px] font-semibold">
                        {preset.badge}
                      </span>
                    ) : null}

                    {/* Applied state indicator */}
                    {isSelected && (
                      <span className="absolute bottom-1 left-1 w-4 h-4 rounded-[5px] bg-primary text-primaryText flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] max-w-[70px] lg:max-w-full truncate ${
                      isSelected ? 'font-semibold text-textPrimary' : 'font-medium text-textSecondary'
                    }`}
                  >
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'adjust' ? (
        /* Adaptive Color Correction + Quick Fine-Tune Sliders */
        <div
          className="px-4 py-1.5 space-y-2.5 max-h-[164px] lg:max-h-none lg:flex-1 overflow-y-auto no-scrollbar"
          onPointerUp={onCommitManual}
        >
          {/* Adaptive Color Correction Card */}
          <section
            aria-label="Adaptive Color Correction"
            data-testid="adaptive-color-card"
            className="p-3 rounded-[10px] bg-surfaceSecondary border border-border space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold text-textPrimary truncate">
                  Adaptive Color Correction
                </span>
                <span
                  data-testid="adaptive-color-badge"
                  className={`px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                    adaptiveColorStrength > 0
                      ? 'bg-primary text-primaryText'
                      : 'bg-surface border border-border text-textSecondary'
                  }`}
                >
                  Auto
                </span>
              </div>

              {adaptiveColorStrength > 0 ? (
                <button
                  type="button"
                  data-testid="adaptive-color-reset"
                  onClick={() => {
                    onChangeAdaptiveColorStrength(DEFAULT_ADAPTIVE_COLOR_STRENGTH);
                    onCommitAdaptiveColorStrength(DEFAULT_ADAPTIVE_COLOR_STRENGTH);
                  }}
                  className="min-h-[32px] px-2 rounded-[6px] text-[11px] font-medium text-textSecondary hover:text-textPrimary hover:bg-surface inline-flex items-center gap-1 transition duration-fast shrink-0"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.8} />
                  Reset
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="adaptive-color-apply"
                  onClick={() => {
                    onChangeAdaptiveColorStrength(ACTIVE_ADAPTIVE_COLOR_DEFAULT_STRENGTH);
                    onCommitAdaptiveColorStrength(ACTIVE_ADAPTIVE_COLOR_DEFAULT_STRENGTH);
                  }}
                  className="min-h-[32px] px-2.5 rounded-[6px] text-[11px] font-medium bg-surface border border-border text-textPrimary hover:border-primary/60 transition duration-fast shrink-0"
                >
                  Apply
                </button>
              )}
            </div>

            <p className="text-[11px] text-textSecondary leading-snug">
              Automatically adjusts color and lighting based on your photo.
            </p>

            <div className="flex items-center gap-2.5 pt-0.5">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={adaptiveColorStrength}
                onChange={(e) => onChangeAdaptiveColorStrength(Number(e.target.value))}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onCommitAdaptiveColorStrength();
                }}
                onKeyUp={() => onCommitAdaptiveColorStrength()}
                style={{ '--slider-pct': `${adaptiveColorStrength}%` } as React.CSSProperties}
                className="auvori-slider flex-1 min-w-[60px]"
                aria-label="Adaptive Color Correction Strength"
                data-testid="adaptive-color-slider"
              />
              <span
                data-testid="adaptive-color-percent"
                className="text-xs font-medium text-textSecondary w-10 text-right tabular-nums shrink-0"
              >
                {adaptiveColorStrength}%
              </span>
            </div>

            {adaptiveColorStatus === 'analyzing' && adaptiveColorStrength > 0 && (
              <div className="text-[11px] text-textSecondary" data-testid="adaptive-color-loading">
                Analyzing photo...
              </div>
            )}
            {adaptiveColorStatus === 'error' && adaptiveColorError && (
              <div className="text-[11px] text-error" role="status" data-testid="adaptive-color-error">
                {adaptiveColorError}
              </div>
            )}
          </section>

          {ADJUST_CONTROLS.map((ctrl) => (
            <Slider
              key={ctrl.key}
              label={ctrl.label}
              min={ctrl.min}
              max={ctrl.max}
              value={manual[ctrl.key]}
              onChange={(val) =>
                onChangeManual({
                  ...manual,
                  [ctrl.key]: val
                })
              }
            />
          ))}
        </div>
      ) : (
        /* Crop & Rotate Controls */
        <div className="px-4 py-2 space-y-3 min-h-[132px] lg:flex-1">
          <div className="flex lg:grid lg:grid-cols-2 items-center gap-2 overflow-x-auto no-scrollbar">
            {ASPECT_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.id}
                selected={transform.aspect === opt.id}
                onClick={() => onChangeTransform({ ...transform, aspect: opt.id })}
                className="min-h-[44px] px-3.5 text-xs"
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() =>
                onChangeTransform({
                  ...transform,
                  rotate: ((transform.rotate + 90) % 360) as ImageTransform['rotate']
                })
              }
              className="flex-1 min-h-[44px] h-11 rounded-[8px] bg-surfaceSecondary border border-border hover:border-primary/60 text-xs font-medium text-textPrimary flex items-center justify-center gap-1.5 transition duration-fast"
            >
              <RotateCw className="w-4 h-4" strokeWidth={1.8} />
              Rotate 90°
            </button>
            <button
              onClick={() => onChangeTransform({ ...transform, flipH: !transform.flipH })}
              className={`flex-1 min-h-[44px] h-11 rounded-[8px] border text-xs font-medium flex items-center justify-center gap-1.5 transition duration-fast ${
                transform.flipH
                  ? 'bg-primary text-primaryText border-primary'
                  : 'bg-surfaceSecondary border-border text-textPrimary hover:border-primary/60'
              }`}
            >
              <FlipHorizontal2 className="w-4 h-4" strokeWidth={1.8} />
              Flip
            </button>
            <button
              onClick={() => onChangeTransform(DEFAULT_TRANSFORM)}
              className="min-h-[44px] h-11 px-4 rounded-[8px] border border-border text-xs font-medium text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary transition duration-fast"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
