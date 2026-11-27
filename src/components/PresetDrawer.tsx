import React, { useMemo, useState } from 'react';
import {
  Check,
  Crop,
  Crown,
  FlipHorizontal2,
  Heart,
  RotateCw,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import {
  AspectRatioOption,
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
  thumbnails: Record<string, string>;
  favoriteIds: string[];
  isProUnlocked: boolean;
  onSelectPreset: (preset: Preset) => void;
  onChangeIntensity: (val: number) => void;
  onCommitIntensity: () => void;
  onChangeManual: (next: ManualAdjustments) => void;
  onCommitManual: () => void;
  onChangeTransform: (next: ImageTransform) => void;
  onToggleFavorite: (presetId: string) => void;
}

const ASPECT_OPTIONS: { id: AspectRatioOption; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: '4:5', label: '4:5 Portrait' },
  { id: '1:1', label: '1:1 Square' },
  { id: '16:9', label: '16:9 Wide' }
];

export const PresetDrawer: React.FC<PresetDrawerProps> = ({
  activePreset,
  intensity,
  manual,
  transform,
  thumbnails,
  favoriteIds,
  isProUnlocked,
  onSelectPreset,
  onChangeIntensity,
  onCommitIntensity,
  onChangeManual,
  onCommitManual,
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

  return (
    <section className="bg-surface border-t border-border pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 z-20">
      {/* Top control bar: Intensity slider OR section header + 3-mode switcher */}
      <div className="px-4 pb-2 flex items-center gap-3 min-h-[40px]">
        {activeTab === 'presets' ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {activePreset.id !== 'original' ? (
              <>
                <button
                  onClick={() => onToggleFavorite(activePreset.id)}
                  aria-label={`Favorite ${activePreset.name}`}
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center text-textSecondary hover:text-primary hover:bg-surfaceSecondary transition duration-fast shrink-0"
                >
                  <Heart
                    className={`w-4 h-4 ${isActiveFav ? 'fill-primary text-primary' : ''}`}
                    strokeWidth={1.8}
                  />
                </button>
                <span className="text-xs font-medium text-textPrimary w-20 truncate shrink-0">
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
                Select a tone below to style your photograph
              </span>
            )}
          </div>
        ) : activeTab === 'adjust' ? (
          <div className="flex-1 text-xs font-semibold text-textPrimary">Fine-tune Tones</div>
        ) : (
          <div className="flex-1 text-xs font-semibold text-textPrimary">Crop &amp; Orientation</div>
        )}

        <div className="flex items-center bg-surfaceSecondary rounded-full p-0.5 border border-border shrink-0">
          {[
            { id: 'presets', label: 'Presets', icon: Sparkles },
            { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
            { id: 'crop', label: 'Crop', icon: Crop }
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'presets' | 'adjust' | 'crop')}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition duration-fast ${
                  selected
                    ? 'bg-primary text-primaryText'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'presets' ? (
        <>
          {/* Category pills */}
          <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
            {PRESET_CATEGORIES.map((cat) => (
              <FilterChip
                key={cat.id}
                selected={category === cat.id}
                onClick={() => setCategory(cat.id)}
                className="h-8 px-3 text-[11px]"
              >
                {cat.label}
              </FilterChip>
            ))}
          </div>

          {/* Horizontal 4:5 live thumbnail strip */}
          <div className="flex items-center gap-2.5 px-4 overflow-x-auto no-scrollbar pb-1">
            {filteredPresets.map((preset) => {
              const isSelected = activePreset.id === preset.id;
              const thumb = thumbnails[preset.id];
              const showLockBadge = preset.isPro && !isProUnlocked;

              return (
                <button
                  key={preset.id}
                  onClick={() => onSelectPreset(preset)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
                >
                  <div
                    className={`relative w-[64px] h-[78px] rounded-[12px] overflow-hidden border-2 transition duration-normal bg-surfaceSecondary ${
                      isSelected
                        ? 'border-primary shadow-card scale-[1.03]'
                        : 'border-border group-hover:border-taupe'
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
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-ink/80 text-ivory text-[9px] font-medium flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" strokeWidth={1.8} />
                        PRO
                      </span>
                    ) : preset.badge ? (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[5px] bg-primary text-primaryText text-[9px] font-medium">
                        {preset.badge}
                      </span>
                    ) : null}

                    {/* Applied state indicator (beyond border color alone per Section 6.5) */}
                    {isSelected && (
                      <span className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-primary text-primaryText flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] max-w-[68px] truncate ${
                      isSelected ? 'font-semibold text-primary' : 'font-medium text-textSecondary'
                    }`}
                  >
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : activeTab === 'adjust' ? (
        /* Quick Fine-Tune Sliders */
        <div
          className="px-4 py-1.5 space-y-2 max-h-[152px] overflow-y-auto no-scrollbar"
          onPointerUp={onCommitManual}
        >
          {[
            { key: 'exposure', label: 'Exposure', min: -35, max: 35 },
            { key: 'contrast', label: 'Contrast', min: -35, max: 35 },
            { key: 'temperature', label: 'Warmth', min: -35, max: 35 },
            { key: 'saturation', label: 'Saturation', min: -35, max: 35 },
            { key: 'skinRosy', label: 'Rosy Skin', min: 0, max: 45 },
            { key: 'bgDarken', label: 'Darken BG', min: 0, max: 50 },
            { key: 'bgBokeh', label: 'Pro Bokeh', min: 0, max: 40 },
            { key: 'grain', label: 'Film Grain', min: 0, max: 35 }
          ].map((ctrl) => (
            <Slider
              key={ctrl.key}
              label={ctrl.label}
              min={ctrl.min}
              max={ctrl.max}
              value={manual[ctrl.key as keyof ManualAdjustments]}
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
        <div className="px-4 py-2 space-y-3 min-h-[132px]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {ASPECT_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.id}
                selected={transform.aspect === opt.id}
                onClick={() => onChangeTransform({ ...transform, aspect: opt.id })}
                className="h-9 px-3.5 text-xs"
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
              className="flex-1 h-11 rounded-[12px] bg-surfaceSecondary border border-border hover:border-taupe text-xs font-medium text-textPrimary flex items-center justify-center gap-1.5 transition duration-fast"
            >
              <RotateCw className="w-4 h-4" strokeWidth={1.8} />
              Rotate 90°
            </button>
            <button
              onClick={() => onChangeTransform({ ...transform, flipH: !transform.flipH })}
              className={`flex-1 h-11 rounded-[12px] border text-xs font-medium flex items-center justify-center gap-1.5 transition duration-fast ${
                transform.flipH
                  ? 'bg-primary text-primaryText border-primary'
                  : 'bg-surfaceSecondary border-border text-textPrimary hover:border-taupe'
              }`}
            >
              <FlipHorizontal2 className="w-4 h-4" strokeWidth={1.8} />
              Flip
            </button>
            <button
              onClick={() => onChangeTransform(DEFAULT_TRANSFORM)}
              className="h-11 px-4 rounded-[12px] border border-border text-xs font-medium text-textSecondary hover:text-textPrimary transition duration-fast"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
