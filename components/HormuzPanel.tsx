'use client';

import type { DailyIndicator, EventAnnotation } from '@/lib/db';
import HistoricalChart from './HistoricalChart';
import VesselBreakdown from './VesselBreakdown';

interface HormuzPanelProps {
  latest: DailyIndicator;
  history: DailyIndicator[];
  events: EventAnnotation[];
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  OPEN:       { color: '#22c55e', label: 'OPEN' },
  RESTRICTED: { color: '#f97316', label: 'RESTRICTED' },
  CLOSED:     { color: '#ef4444', label: 'CLOSED' },
  UNKNOWN:    { color: '#6b7280', label: 'UNKNOWN' },
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
          {latest.n_tanker ?? '—'}
        </p>
        <p className="text-muted text-sm mt-1">oil tankers in transit</p>
        <p className="text-muted text-xs mt-0.5 opacity-70">
          ({latest.hormuz_transits ?? '—'} total vessels)
        </p>
      </div>

      <VesselBreakdown
        nTanker={latest.n_tanker}
        nContainer={latest.n_container}
        nDryBulk={latest.n_dry_bulk}
        nCargo={latest.n_cargo}
        total={latest.hormuz_transits}
      />

      {/* Vessel transit trend — separate chart for clear visibility */}
      <div>
        <p className="text-muted text-xs mb-1">Daily Vessel Transits</p>
        <HistoricalChart
          data={history}
          lines={[
            { dataKey: 'hormuz_transits', color: '#60a5fa', name: 'Daily Transits', strokeWidth: 2 },
            { dataKey: 'n_tanker', color: '#f59e0b', name: 'Tankers', strokeWidth: 1.5, strokeDasharray: '4 3' },
          ]}
          events={events}
          height={180}
        />
      </div>

      {/* Oil price trend */}
      <div>
        <p className="text-muted text-xs mb-1">Brent Crude Oil ($)</p>
        <HistoricalChart
          data={history}
          lines={[
            { dataKey: 'oil_price_brent', color: '#f97316', name: 'Brent Oil ($)' },
          ]}
          events={[]}
          height={180}
        />
      </div>
    </div>
  );
}
