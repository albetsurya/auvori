import React from 'react';

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  selected = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      className={`min-h-[44px] px-3.5 rounded-[8px] text-xs font-medium whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition duration-fast shrink-0 ${
        selected
          ? 'bg-primary text-primaryText border border-primary'
          : 'bg-surface border border-border text-textSecondary hover:text-textPrimary hover:bg-surfaceSecondary'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export type BadgeTone = 'neutral' | 'olive' | 'mocha' | 'warning' | 'success' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surfaceSecondary text-textPrimary border border-border',
  olive: 'bg-primary text-primaryText',
  mocha: 'bg-primary text-primaryText',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  success: 'bg-success/15 text-success border border-success/30',
  info: 'bg-info/15 text-info border border-info/30'
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone = 'neutral',
  className = '',
  children
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-semibold tracking-wider uppercase leading-tight ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
};
