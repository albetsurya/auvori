import React from 'react';

interface AuvoriMarkProps {
  size?: number;
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Geometric Neutral Analog Studio brand emblem:
 * 35mm optical viewfinder corner ticks + Olive aperture ring + architectural 'A' focal mark.
 */
export const AuvoriMark: React.FC<AuvoriMarkProps> = ({
  size = 32,
  variant = 'light',
  className = ''
}) => {
  const isDark = variant === 'dark';
  const frameBg = isDark ? '#30332F' : '#FFFFFF';
  const frameStroke = isDark ? '#484C45' : '#DADBD4';
  const tickStroke = isDark ? '#AEB2A7' : '#7C8990';
  const letterFill = isDark ? '#F2F2ED' : '#252724';
  const ringStroke = isDark ? '#8E9D7F' : '#68735D';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" fill={frameBg} stroke={frameStroke} strokeWidth="1.25" />
      {/* 35mm Viewfinder Corner Ticks */}
      <path
        d="M5 7.75V5H7.75M24.25 5H27V7.75M5 24.25V27H7.75M24.25 27H27V24.25"
        stroke={tickStroke}
        strokeOpacity="0.65"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Calibrated Olive Aperture Ring */}
      <circle cx="16" cy="16" r="8.25" stroke={ringStroke} strokeWidth="1.45" />
      {/* Architectural A Monogram */}
      <path
        d="M16 9.6L20.75 21.6H18.35L16 15.1L13.65 21.6H11.25L16 9.6Z"
        fill={letterFill}
      />
      {/* Aperture Focal Point */}
      <circle cx="16" cy="19.9" r="1.4" fill={ringStroke} />
    </svg>
  );
};

interface AuvoriLogoProps {
  size?: number;
  variant?: 'light' | 'dark';
  showStudioLabel?: boolean;
}

export const AuvoriLogo: React.FC<AuvoriLogoProps> = ({
  size = 30,
  variant = 'light',
  showStudioLabel = false
}) => {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <AuvoriMark size={size} variant={variant} />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[19px] font-semibold tracking-[-0.025em] ${
            variant === 'dark' ? 'text-chalk' : 'text-graphite'
          }`}
        >
          Auvori
        </span>
        {showStudioLabel && (
          <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-olive mt-0.5">
            Photo Studio
          </span>
        )}
      </span>
    </span>
  );
};
