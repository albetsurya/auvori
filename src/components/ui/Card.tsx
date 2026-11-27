import React from 'react';

export type CardVariant = 'photo' | 'collection' | 'info' | 'feature' | 'settings';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

const RADIUS_CLASSES: Record<CardVariant, string> = {
  photo: 'rounded-[12px] overflow-hidden bg-surface border border-border shadow-card',
  collection: 'rounded-[12px] overflow-hidden bg-surface border border-border shadow-card',
  info: 'rounded-[12px] bg-surface border border-border shadow-card',
  feature: 'rounded-[14px] overflow-hidden bg-surface border border-border shadow-card',
  settings: 'rounded-[12px] bg-surface border border-border'
};

export const Card: React.FC<CardProps> = ({
  variant = 'info',
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`${RADIUS_CLASSES[variant]} ${
        interactive
          ? 'cursor-pointer transition duration-normal hover:border-olive active:scale-[0.99]'
          : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
