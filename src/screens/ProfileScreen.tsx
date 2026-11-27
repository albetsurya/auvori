import React, { useState } from 'react';
import { CheckCircle2, Crown, Heart, Moon, Sun, Trash2 } from 'lucide-react';
import { LicenseState, ThemeMode } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Chip';
import { ModalSheet } from '../components/ui/ModalSheet';

interface ProfileScreenProps {
  license: LicenseState;
  theme: ThemeMode;
  defaultWatermark: boolean;
  favoritesCount: number;
  recentsCount: number;
  onToggleTheme: (next: ThemeMode) => void;
  onToggleDefaultWatermark: (next: boolean) => void;
  onOpenPro: (tab: 'buy' | 'activate') => void;
  onOpenFavorites: () => void;
  onClearRecents: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  license,
  theme,
  defaultWatermark,
  favoritesCount,
  recentsCount,
  onToggleTheme,
  onToggleDefaultWatermark,
  onOpenPro,
  onOpenFavorites,
  onClearRecents
}) => {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-[480px] mx-auto px-5 pt-6 pb-10 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-[30px] leading-tight font-medium text-textPrimary">
            Studio Profile
          </h1>
          <p className="text-xs text-textSecondary">
            Manage Auvori Pro access, theme appearance, and export preferences.
          </p>
        </div>

        {/* License / Membership Card */}
        <Card variant="info" className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surfaceSecondary border border-border flex items-center justify-center font-display text-xl font-semibold text-primary">
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
              <Button variant="ghost" onClick={() => onOpenPro('activate')} className="text-xs h-9">
                Manage License
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="primary" onClick={() => onOpenPro('buy')} className="h-11 text-xs">
                <Crown className="w-4 h-4" strokeWidth={1.8} />
                Beli via Lynk.id
              </Button>
              <Button
                variant="secondary"
                onClick={() => onOpenPro('activate')}
                className="h-11 text-xs"
              >
                Aktifkan Kode
              </Button>
            </div>
          )}
        </Card>

        {/* Appearance & Preferences */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-textSecondary px-1">
            Appearance &amp; Preferences
          </h2>

          <Card variant="settings" className="divide-y divide-border">
            {/* Theme Mode Toggle */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-surfaceSecondary flex items-center justify-center text-primary">
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5" strokeWidth={1.75} />
                  ) : (
                    <Sun className="w-5 h-5" strokeWidth={1.75} />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-textPrimary">Appearance</div>
                  <div className="text-xs text-textSecondary">
                    {theme === 'dark' ? 'Dark Mode (#1F1C19)' : 'Warm Ivory (Default)'}
                  </div>
                </div>
              </div>

              <button
                role="switch"
                aria-checked={theme === 'dark'}
                aria-label="Toggle dark mode"
                onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-12 h-7 rounded-full transition duration-fast relative border ${
                  theme === 'dark'
                    ? 'bg-primary border-primary'
                    : 'bg-surfaceSecondary border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition duration-fast ${
                    theme === 'dark' ? 'left-6' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Favorites shortcut */}
            <button
              onClick={onOpenFavorites}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surfaceSecondary/60 transition duration-fast"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-surfaceSecondary flex items-center justify-center text-primary">
                  <Heart className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-sm font-medium text-textPrimary">Saved Favorites</div>
                  <div className="text-xs text-textSecondary">Your personal preset collection</div>
                </div>
              </div>
              <StatusBadge tone="neutral">{favoritesCount}</StatusBadge>
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
                className={`w-12 h-7 rounded-full transition duration-fast relative border ${
                  !license.isPro
                    ? 'opacity-45 bg-surfaceSecondary border-border cursor-not-allowed'
                    : defaultWatermark
                    ? 'bg-primary border-primary'
                    : 'bg-surfaceSecondary border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition duration-fast ${
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
              <div className="text-xs text-textSecondary">
                {recentsCount} local snapshots stored on device
              </div>
            </div>
            <Button
              variant="ghost"
              disabled={recentsCount === 0}
              onClick={() => setConfirmClearOpen(true)}
              className="text-error text-xs h-10"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.8} />
              Clear
            </Button>
          </Card>
        </div>

        <p className="text-[11px] text-center text-textSecondary pt-2">
          Auvori Studio v1.0 · 100% private photo processing on your device.
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
