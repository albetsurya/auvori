import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'icon' | 'destructive';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'h-[52px] px-5 rounded-[14px] bg-primary text-primaryText hover:bg-primaryHover active:brightness-95 font-medium text-sm shadow-card',
  secondary:
    'h-12 px-5 rounded-[14px] bg-transparent border border-border text-textPrimary hover:bg-surfaceSecondary active:brightness-95 font-medium text-sm',
  soft:
    'h-12 px-5 rounded-[14px] bg-surfaceSecondary text-textPrimary hover:brightness-95 active:brightness-90 font-medium text-sm',
  ghost:
    'h-10 px-3 rounded-[12px] bg-transparent text-textPrimary hover:bg-surfaceSecondary active:brightness-95 font-medium text-sm',
  icon:
    'min-w-[44px] min-h-[44px] w-11 h-11 rounded-[12px] bg-surface border border-border text-textPrimary hover:bg-surfaceSecondary active:scale-95',
  destructive:
    'h-12 px-5 rounded-[14px] bg-[#A6534D] text-ivory hover:brightness-95 active:brightness-90 font-medium text-sm'
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 transition duration-fast select-none ${
        VARIANT_CLASSES[variant]
      } ${fullWidth ? 'w-full' : ''} ${
        isDisabled ? 'opacity-45 pointer-events-none' : 'active:scale-[0.985]'
      } ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" strokeWidth={1.8} />}
      {children}
    </button>
  );
};
