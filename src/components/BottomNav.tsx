import React from 'react';
import { Compass, Home, LucideIcon, Plus, Sliders, User } from 'lucide-react';
import { AppTab } from '../types';

interface BottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onQuickCreate: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onQuickCreate
}) => {
  const NavButton = ({
    tab,
    label,
    icon: Icon
  }: {
    tab: AppTab;
    label: string;
    icon: LucideIcon;
  }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => onSelectTab(tab)}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 min-w-[52px] min-h-[44px] px-2.5 py-1 rounded-[8px] transition duration-fast ${
          isActive
            ? 'text-olive bg-olive-soft/70'
            : 'text-textSecondary hover:text-textPrimary'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.1 : 1.7} />
        <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Primary Navigation"
      className="lg:hidden shrink-0 w-full bg-surface/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)] z-30"
    >
      <div className="max-w-[560px] mx-auto h-[68px] px-4 flex items-center justify-between">
        <NavButton tab="home" label="Home" icon={Home} />
        <NavButton tab="presets" label="Presets" icon={Sliders} />

        <button
          onClick={onQuickCreate}
          aria-label="Open a Photo"
          className="min-w-[44px] min-h-[44px] w-12 h-11 rounded-[10px] bg-olive text-white hover:bg-olive-hover active:scale-95 shadow-card flex items-center justify-center transition duration-fast"
        >
          <Plus className="w-5 h-5" strokeWidth={2.1} />
        </button>

        <NavButton tab="discover" label="Discover" icon={Compass} />
        <NavButton tab="profile" label="Profile" icon={User} />
      </div>
    </nav>
  );
};
