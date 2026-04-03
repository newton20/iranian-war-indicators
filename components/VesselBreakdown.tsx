'use client';

interface VesselBreakdownProps {
  nTanker: number | null;
  nContainer: number | null;
  nDryBulk: number | null;
  nCargo: number | null;
  total: number | null;
}

const VESSEL_TYPES = [
  { key: 'tanker' as const, label: 'Tanker', color: '#f59e0b', highlight: true },
  { key: 'container' as const, label: 'Container', color: '#60a5fa', highlight: false },
  { key: 'dryBulk' as const, label: 'Dry Bulk', color: '#a78bfa', highlight: false },
  { key: 'cargo' as const, label: 'Cargo', color: '#6b7280', highlight: false },
] as const;

export default function VesselBreakdown({
  nTanker,
  nContainer,
  nDryBulk,
  nCargo,
  total,
}: VesselBreakdownProps) {
  const values: Record<string, number | null> = {
    tanker: nTanker,
    container: nContainer,
    dryBulk: nDryBulk,
    cargo: nCargo,
  };

  const allNull = nTanker === null && nContainer === null && nDryBulk === null && nCargo === null;

  if (allNull) {
    return (
      <div className="text-sm text-[var(--muted)] py-2">
        Vessel type data unavailable
      </div>
    );
  }

  // Use total if provided, otherwise sum known values
  const maxVal = total ?? Object.values(values).reduce((sum: number, v) => sum + (v ?? 0), 0);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[var(--muted)] text-xs mb-0.5">Vessel Breakdown</p>
      {VESSEL_TYPES.map(({ key, label, color, highlight }) => {
        const count = values[key];
        if (count === null) return null;
        const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;

        return (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span
              className={`w-20 shrink-0 text-xs ${highlight ? 'font-semibold' : ''}`}
              style={{ color: highlight ? color : 'var(--muted)' }}
            >
              {label}
            </span>
            <span
              className={`w-8 shrink-0 text-right font-mono text-xs tabular-nums ${highlight ? 'text-[var(--foreground)] font-semibold' : 'text-[var(--muted)]'}`}
            >
              {count}
            </span>
            <div className="flex-1 h-3 rounded-sm bg-zinc-800/50 overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  backgroundColor: color,
                  opacity: highlight ? 1 : 0.7,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
