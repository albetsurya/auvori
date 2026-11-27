import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  ariaLabel?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
  ariaLabel
}) => {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const formatted = formatValue ? formatValue(value) : value > 0 && min < 0 ? `+${value}` : String(value);

  return (
    <div className="flex items-center gap-3 min-h-[34px]">
      <span className="text-xs font-medium text-textPrimary w-24 shrink-0 truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--slider-pct': `${pct}%` } as React.CSSProperties}
        className="auvori-slider flex-1"
        aria-label={ariaLabel || label}
      />
      <span className="text-xs font-medium text-textSecondary w-10 text-right tabular-nums shrink-0">
        {formatted}
      </span>
    </div>
  );
};
