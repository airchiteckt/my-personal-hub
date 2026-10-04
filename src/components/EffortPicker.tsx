import { cn } from '@/lib/utils';

export const EFFORT_SIZES = [
  { minutes: 15, label: '15m', hint: 'Rapida' },
  { minutes: 30, label: '30m', hint: '' },
  { minutes: 60, label: '1h', hint: '' },
  { minutes: 120, label: '2h', hint: '' },
  { minutes: 240, label: '4h', hint: 'Deep' },
];

/** Snap any minute value to the nearest effort size. */
export function snapEffort(mins: number): number {
  return EFFORT_SIZES.reduce((best, s) =>
    Math.abs(s.minutes - mins) < Math.abs(best - mins) ? s.minutes : best, 30);
}

export function EffortPicker({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const current = snapEffort(value);
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {EFFORT_SIZES.map(s => (
        <button
          key={s.minutes}
          type="button"
          onClick={() => onChange(s.minutes)}
          className={cn(
            'rounded-md border px-1 py-2 text-sm font-medium transition-colors',
            current === s.minutes
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background hover:bg-muted'
          )}
        >
          {s.label}
          {s.hint && <span className="block text-[10px] font-normal opacity-70">{s.hint}</span>}
        </button>
      ))}
    </div>
  );
}
