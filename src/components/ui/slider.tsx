interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, suffix, onChange }: SliderProps) {
  return (
    <div className="w-full space-y-2 relative z-[1]">
      <div className="flex items-center justify-between">
        {label && <span className="text-sm font-medium text-[var(--foreground)]/80">{label}</span>}
        <span className="text-sm text-[var(--muted-foreground)]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="glass-slider w-full"
      />
    </div>
  );
}
