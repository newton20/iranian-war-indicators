'use client';

import type { DailyIndicator, EventAnnotation } from '@/lib/db';
import HistoricalChart from './HistoricalChart';

interface HormuzPanelProps {
  latest: DailyIndicator;
  history: DailyIndicator[];
  events: EventAnnotation[];
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  OPEN:    { color: '#22c55e', label: 'OPEN' },
  CLOSED:  { color: '#ef4444', label: 'CLOSED' },
  UNKNOWN: { color: '#6b7280', label: 'UNKNOWN' },
};

export default function HormuzPanel({ latest, history, events }: HormuzPanelProps) {
  const status = STATUS_STYLES[latest.hormuz_status ?? 'UNKNOWN'] ?? STATUS_STYLES.UNKNOWN;

  return (
    <div className="rounded-lg bg-surface border border-border p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Strait of Hormuz</h2>
        <span className="text-xs font-semibold tracking-wide" style={{ color: status.color }}>
          {status.label}
        </span>
      </div>

      <div>
        <p className="font-mono font-bold text-4xl font-tabular text-foreground">
          {latest.hormuz_transits ?? '—'}
        </p>
        <p className="text-muted text-sm mt-1">vessels in transit</p>
      </div>

      <HistoricalChart
        data={history}
        lines={[
          { dataKey: 'oil_price_brent', color: '#f97316', yAxisId: 'right', name: 'Brent Oil ($)' },
          { dataKey: 'hormuz_transits', color: '#60a5fa', name: 'Daily Transits', strokeWidth: 2.5 },
        ]}
        events={events}
        height={320}
      />
    </div>
  );
}
