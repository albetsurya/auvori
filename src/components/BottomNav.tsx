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
        className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] px-2 rounded-[12px] transition duration-fast ${
          isActive ? 'text-primary' : 'text-textSecondary hover:text-textPrimary'
        }`}
      >
        <Icon className="w-6 h-6" strokeWidth={isActive ? 2 : 1.65} />
        <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Primary Navigation"
      className="shrink-0 w-full bg-surface/95 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)] z-30"
    >
      <div className="max-w-[480px] mx-auto h-[72px] px-3 flex items-center justify-between">
        <NavButton tab="home" label="Home" icon={Home} />
        <NavButton tab="presets" label="Presets" icon={Sliders} />

        <button
          onClick={onQuickCreate}
          aria-label="Start editing photo"
          className="w-12 h-12 rounded-[16px] bg-primary text-primaryText hover:bg-primaryHover active:scale-95 shadow-card flex items-center justify-center transition duration-fast"
        >
          <Plus className="w-6 h-6" strokeWidth={2} />
        </button>

        <NavButton tab="discover" label="Discover" icon={Compass} />
        <NavButton tab="profile" label="Profile" icon={User} />
      </div>
    </nav>
  );
};
