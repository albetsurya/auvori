import React from 'react';
import { Compass, Crown, Home, ImagePlus, LucideIcon, Sliders, User, HardDrive } from 'lucide-react';
import { AppTab, LicenseState } from '../types';
import { StatusBadge } from './ui/Chip';
import { AuvoriLogo } from './AuvoriLogo';

interface TopStudioBarProps {
  activeTab: AppTab;
  license: LicenseState;
  onSelectTab: (tab: AppTab) => void;
  onOpenPhoto: () => void;
  onOpenPro: () => void;
  onOpenOfflineManager: () => void;
}

const NAV_ITEMS: { tab: AppTab; label: string; icon: LucideIcon }[] = [
  { tab: 'home', label: 'Home', icon: Home },
  { tab: 'presets', label: 'Presets', icon: Sliders },
  { tab: 'discover', label: 'Discover', icon: Compass },
  { tab: 'profile', label: 'Profile', icon: User }
];

export const TopStudioBar: React.FC<TopStudioBarProps> = ({
  activeTab,
  license,
  onSelectTab,
  onOpenPhoto,
  onOpenPro,
  onOpenOfflineManager
}) => {
  return (
    <header className="hidden lg:block shrink-0 w-full bg-surface/95 backdrop-blur-md border-b border-border z-30">
      <div className="max-w-[1280px] mx-auto h-16 px-8 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center focus:outline-none group"
            aria-label="Auvori Home"
          >
            <AuvoriLogo size={32} />
          </button>

          <button
            onClick={onOpenPro}
            aria-label="Auvori Pro status"
            className="focus:outline-none"
          >
            <StatusBadge tone={license.isPro ? 'olive' : 'neutral'}>
              <Crown className="w-3 h-3" strokeWidth={1.8} />
              {license.isPro ? 'PRO' : 'Free'}
            </StatusBadge>
          </button>
        </div>

        <nav aria-label="Studio Navigation" className="flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => onSelectTab(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] px-4 rounded-[8px] text-xs font-medium inline-flex items-center gap-2 transition duration-fast ${
                  isActive
                    ? 'bg-olive-soft text-graphite font-semibold'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary/60'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={onOpenOfflineManager}
          className="min-h-[44px] h-11 px-3 rounded-[10px] text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary/60 transition duration-fast flex items-center justify-center"
          aria-label="Offline Resources"
        >
          <HardDrive className="w-5 h-5" strokeWidth={1.75} />
        </button>

        <button
          onClick={onOpenPhoto}
          className="min-h-[44px] h-11 px-4 rounded-[10px] bg-olive hover:bg-olive-hover text-white font-medium text-xs inline-flex items-center gap-2 shadow-card active:scale-[0.985] transition duration-fast"
        >
          <ImagePlus className="w-4 h-4" strokeWidth={1.85} />
          <span>Open a Photo</span>
        </button>
      </div>
    </header>
  );
};
