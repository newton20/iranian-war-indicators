'use client';

import type { DailyIndicator, EventAnnotation } from '@/lib/db';
import TacoGauge from './TacoGauge';
import HistoricalChart from './HistoricalChart';

interface TacoPanelProps {
  latest: DailyIndicator;
  history: DailyIndicator[];
  events: EventAnnotation[];
}

function StatItem({ label, value, suffix }: { label: string; value: number | null; suffix: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted text-xs">{label}</p>
      <p className="font-mono text-sm font-tabular text-foreground">
        {value !== null ? `${value.toFixed(1)}${suffix}` : '—'}
      </p>
    </div>
  );
}

export default function TacoPanel({ latest, history, events }: TacoPanelProps) {
  return (
    <div className="rounded-lg bg-surface border border-border p-5 flex flex-col gap-4">
      <h2 className="text-foreground text-lg font-semibold">TACO Stress Index</h2>

      <TacoGauge
        score={latest.taco_score ?? 0}
        componentsAvailable={latest.taco_components_available}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatItem label="Approval" value={latest.approval_rating} suffix="%" />
        <StatItem label="S&P 500 30d" value={latest.sp500_30d_return !== null ? latest.sp500_30d_return * 100 : null} suffix="%" />
        <StatItem label="Inflation 1Y" value={latest.inflation_1y !== null ? latest.inflation_1y * 100 : null} suffix="%" />
        <StatItem label="T-bill 3M" value={latest.tbill_3m !== null ? latest.tbill_3m * 100 : null} suffix="%" />
      </div>

      {latest.taco_components_available < 4 && (
        <p className="text-muted text-xs">
          ({latest.taco_components_available}/4 components)
        </p>
      )}

      <HistoricalChart
        data={history}
        lines={[
          { dataKey: 'taco_score', color: '#a78bfa', name: 'TACO Composite' },
        ]}
        events={events}
      />
    </div>
  );
}
