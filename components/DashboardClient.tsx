'use client';

import { useState, useMemo } from 'react';
import type { DailyIndicator, EventAnnotation } from '@/lib/db';
import TimeRangeFilter from './TimeRangeFilter';
import HormuzPanel from './HormuzPanel';
import TacoPanel from './TacoPanel';

interface DashboardClientProps {
  latest: DailyIndicator;
  history: DailyIndicator[]; // full 365 days, already reversed (ascending)
  events: EventAnnotation[];
}

export default function DashboardClient({ latest, history, events }: DashboardClientProps) {
  const [selectedDays, setSelectedDays] = useState(365);

  const filteredHistory = useMemo(() => {
    if (selectedDays === 0) return history;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return history.filter((d) => d.date >= cutoffStr);
  }, [history, selectedDays]);

  return (
    <>
      <TimeRangeFilter selected={selectedDays} onChange={setSelectedDays} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <HormuzPanel
          latest={latest}
          history={filteredHistory}
          events={events}
        />
        <TacoPanel
          latest={latest}
          history={filteredHistory}
          events={events}
        />
      </div>
    </>
  );
}
