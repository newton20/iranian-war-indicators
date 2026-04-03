'use client';

interface TimeRangeFilterProps {
  selected: number; // days (7, 30, 90, 365, 0 for ALL)
  onChange: (days: number) => void;
}

const OPTIONS = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 365, label: '1Y' },
  { days: 0, label: 'ALL' },
] as const;

export default function TimeRangeFilter({ selected, onChange }: TimeRangeFilterProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      {OPTIONS.map(({ days, label }) => {
        const active = selected === days;
        return (
          <button
            key={days}
            onClick={() => onChange(days)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              active
                ? 'bg-zinc-700 text-[var(--foreground)]'
                : 'bg-zinc-800/50 text-[var(--muted)] hover:bg-zinc-700/50 hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
