import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  className = '',
  id,
  ...rest
}) => {
  const inputId = id || React.useId();

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-textSecondary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3.5 text-textSecondary pointer-events-none flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full h-11 rounded-[8px] bg-surface border text-sm text-textPrimary placeholder:text-textSecondary/70 transition duration-fast focus:outline-none ${
            leftIcon ? 'pl-10 pr-3.5' : 'px-3.5'
          } ${
            error
              ? 'border-error focus:border-error'
              : 'border-border focus:border-primary'
          } ${className}`}
          {...rest}
        />
      </div>
      {error && <p className="text-xs text-error font-medium">{error}</p>}
    </div>
  );
};
