import React, { useState } from 'react';
import { Check, CheckCircle2, Crown, Heart, Moon, Sun, Trash2 } from 'lucide-react';
import { EditorBackdrop, LicenseState } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Chip';
import { ModalSheet } from '../components/ui/ModalSheet';

interface ProfileScreenProps {
  license: LicenseState;
  editorBackdrop: EditorBackdrop;
  defaultWatermark: boolean;
  favoritesCount: number;
  recentsCount: number;
  onChangeEditorBackdrop: (next: EditorBackdrop) => void;
  onToggleDefaultWatermark: (next: boolean) => void;
  onOpenPro: (tab: 'buy' | 'activate') => void;
  onOpenFavorites: () => void;
  onClearRecents: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  license,
  editorBackdrop,
  defaultWatermark,
  favoritesCount,
  recentsCount,
  onChangeEditorBackdrop,
  onToggleDefaultWatermark,
  onOpenPro,
  onOpenFavorites,
  onClearRecents
}) => {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[540px] md:max-w-[720px] lg:max-w-[820px] mx-auto px-5 sm:px-6 pt-6 lg:pt-8 pb-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold text-textPrimary tracking-tight">
            Studio Profile
          </h1>
          <p className="text-xs sm:text-sm text-textSecondary">
            Manage Auvori Pro access, editor workspace backdrop, and export preferences.
          </p>
        </div>

        {/* License / Membership Card */}
        <Card variant="info" className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] bg-olive-soft border border-stone flex items-center justify-center text-lg font-semibold text-graphite">
                {license.email ? license.email[0].toUpperCase() : 'A'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-textPrimary">
                    {license.isPro ? 'Auvori Pro Member' : 'Auvori Free Studio'}
                  </span>
                  <StatusBadge tone={license.isPro ? 'success' : 'neutral'}>
                    {license.isPro ? 'Active' : 'Free'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-textSecondary mt-0.5">
                  {license.isPro
                    ? license.email
                    : 'Buka semua preset Pro & ekspor HD tanpa watermark'}
                </p>
              </div>
            </div>
          </div>

          {license.isPro ? (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-success font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
                {license.plan || 'Pro Lifetime'}
              </span>
              <Button variant="ghost" onClick={() => onOpenPro('activate')} className="text-xs">
                Manage License
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="primary" onClick={() => onOpenPro('buy')} className="text-xs">
                <Crown className="w-4 h-4" strokeWidth={1.8} />
                Beli via Lynk.id
              </Button>
              <Button
                variant="secondary"
                onClick={() => onOpenPro('activate')}
                className="text-xs"
              >
                Aktifkan Kode
              </Button>
            </div>
          )}
        </Card>

        {/* Editor Workspace & Preferences */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-textSecondary px-1">
            Studio Preferences
          </h2>

          <Card variant="settings" className="divide-y divide-border">
            {/* Editor Backdrop Selector */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-textPrimary">Editor Backdrop</div>
                  <div className="text-xs text-textSecondary mt-0.5">
                    Applies to the Photo Editor workspace only. Browse screens stay Chalk Light and
                    photo tones remain unaffected.
                  </div>
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label="Editor Backdrop"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={editorBackdrop === 'graphite'}
                  onClick={() => onChangeEditorBackdrop('graphite')}
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-[10px] border text-left flex items-center justify-between gap-3 transition duration-fast ${
                    editorBackdrop === 'graphite'
                      ? 'border-olive bg-olive-soft/70 text-graphite'
                      : 'border-border bg-surface text-textPrimary hover:bg-surfaceSecondary/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-[6px] bg-graphite border border-graphite/30 text-chalk flex items-center justify-center shrink-0">
                      <Moon className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">Graphite Dark</div>
                      <div className="text-[11px] text-textSecondary truncate">
                        Default studio workspace
                      </div>
                    </div>
                  </div>
                  {editorBackdrop === 'graphite' && (
                    <span className="w-5 h-5 rounded-[6px] bg-olive text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={editorBackdrop === 'chalk'}
                  onClick={() => onChangeEditorBackdrop('chalk')}
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-[10px] border text-left flex items-center justify-between gap-3 transition duration-fast ${
                    editorBackdrop === 'chalk'
                      ? 'border-olive bg-olive-soft/70 text-graphite'
                      : 'border-border bg-surface text-textPrimary hover:bg-surfaceSecondary/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-[6px] bg-chalk border border-stone text-graphite flex items-center justify-center shrink-0">
                      <Sun className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">Chalk Light</div>
                      <div className="text-[11px] text-textSecondary truncate">
                        Daylight workspace option
                      </div>
                    </div>
                  </div>
                  {editorBackdrop === 'chalk' && (
                    <span className="w-5 h-5 rounded-[6px] bg-olive text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Favorites shortcut */}
            <button
              onClick={onOpenFavorites}
              className="w-full min-h-[60px] p-4 flex items-center justify-between gap-3 text-left hover:bg-surfaceSecondary/50 transition duration-fast"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-olive-soft border border-stone flex items-center justify-center text-olive">
                  <Heart className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-sm font-medium text-textPrimary">Saved Favorites</div>
                  <div className="text-xs text-textSecondary">Your personal preset collection</div>
                </div>
              </div>
              <StatusBadge tone="neutral" className="tabular-nums">
                {favoritesCount}
              </StatusBadge>
            </button>

            {/* Default Watermark (Pro) */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-textPrimary">Export Watermark</div>
                <div className="text-xs text-textSecondary">
                  {license.isPro
                    ? 'Include subtle Auvori signature by default'
                    : 'Upgrade Pro to remove watermark'}
                </div>
              </div>
              <button
                role="switch"
                disabled={!license.isPro}
                aria-checked={license.isPro ? defaultWatermark : true}
                aria-label="Toggle default watermark"
                onClick={() => onToggleDefaultWatermark(!defaultWatermark)}
                className={`w-12 h-7 rounded-full transition duration-fast relative border shrink-0 ${
                  !license.isPro
                    ? 'opacity-45 bg-stone border-border cursor-not-allowed'
                    : defaultWatermark
                    ? 'bg-primary border-primary'
                    : 'bg-stone border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition duration-fast ${
                    (license.isPro ? defaultWatermark : true) ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </Card>
        </div>

        {/* Storage */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-textSecondary px-1">
            Workspace Data
          </h2>
          <Card variant="settings" className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-textPrimary">Recent Edits</div>
              <div className="text-xs text-textSecondary tabular-nums">
                {recentsCount} local snapshots stored on device
              </div>
            </div>
            <Button
              variant="ghost"
              disabled={recentsCount === 0}
              onClick={() => setConfirmClearOpen(true)}
              className="text-error text-xs"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.8} />
              Clear
            </Button>
          </Card>
        </div>

        {/* About & Photo Credits */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-textSecondary px-1">
            About & Credits
          </h2>
          <Card variant="settings" className="p-4 space-y-1.5">
            <div className="text-sm font-medium text-textPrimary">Sample & Collection Photography</div>
            <p className="text-xs text-textSecondary leading-relaxed">
              Curated from verified open-source archives under Creative Commons CC0 1.0 Universal public domain.
              Photographs by Allef Vinicius, Cayton Heath, William Stitt, Pierrick Le Cunff, Nick Clement, Kevin Lee, Matthew Sleeper, Christian Joudrey, David East, Hisu Lee, Dan Bøțan, Sergey Zolkin, Juan Ignacio Tapia, and Angelina Litvin.
            </p>
          </Card>
        </div>

        <p className="text-[11px] text-center text-textSecondary pt-2">
          Auvori Studio · Neutral Analog Workspace · 100% private on-device processing.
        </p>
      </div>

      {/* Confirmation dialog before discarding user data */}
      <ModalSheet
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        variant="modal"
        title="Clear recent edits?"
        subtitle="Saved local history will be removed from this device."
      >
        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" fullWidth onClick={() => setConfirmClearOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            fullWidth
            onClick={() => {
              onClearRecents();
              setConfirmClearOpen(false);
            }}
          >
            Clear History
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
};
