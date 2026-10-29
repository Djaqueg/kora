import type { ScrollMode } from '../types';

export const TEXT_SIZES = [
  { id: 's', label: 'Texto pequeño', size: 17, tier: 'sm' },
  { id: 'm', label: 'Texto mediano', size: 20, tier: 'md' },
  { id: 'l', label: 'Texto grande', size: 23, tier: 'lg' },
] as const;

export function sizeTier(fontSize: number): (typeof TEXT_SIZES)[number]['id'] {
  if (fontSize >= 23) return 'l';
  if (fontSize <= 18) return 's';
  return 'm';
}

export function TextSizePicker({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const active = sizeTier(value);
  return (
    <div className="size-picks" role="group" aria-label="Tamaño de texto">
      {TEXT_SIZES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`size-a size-${item.tier}${active === item.id ? ' on' : ''}`}
          aria-label={item.label}
          aria-pressed={active === item.id}
          onClick={() => onChange(item.size)}
        >
          A
        </button>
      ))}
    </div>
  );
}

export function ScrollSwitch({ value, onChange }: { value: ScrollMode; onChange: (mode: ScrollMode) => void }) {
  const on = value !== 'page';
  return (
    <button
      className={`switch${on ? ' on' : ''}`}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Desplazamiento"
      onClick={() => onChange(on ? 'page' : 'scroll')}
    />
  );
}

export function BrightnessSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      className="bright-slider"
      type="range"
      min={52}
      max={100}
      value={value}
      aria-label="Brillo y calidez"
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
