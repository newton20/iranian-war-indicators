'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { DailyIndicator, EventAnnotation } from '@/lib/db';

interface ChartLine {
  dataKey: string;
  color: string;
  yAxisId?: string;
  name: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

interface HistoricalChartProps {
  data: DailyIndicator[];
  lines: ChartLine[];
  events: EventAnnotation[];
  height?: number;
}

function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function HistoricalChart({
  data,
  lines,
  events,
  height = 240,
}: HistoricalChartProps) {
  const hasRightAxis = lines.some((l) => l.yAxisId === 'right');
  // Sort data ascending by date for the chart
  const sorted = [...data].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={sorted} margin={{ top: 8, right: hasRightAxis ? 8 : 4, bottom: 0, left: 4 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          stroke="#27272a"
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          stroke="#27272a"
          tickLine={false}
          width={40}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            stroke="#27272a"
            tickLine={false}
            width={40}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: '#171717',
            border: '1px solid #27272a',
            borderRadius: 6,
            color: '#fafafa',
            fontSize: 12,
          }}
          labelFormatter={(label: unknown) => formatDateTick(String(label))}
        />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            yAxisId={line.yAxisId ?? 'left'}
            stroke={line.color}
            name={line.name}
            dot={false}
            strokeWidth={line.strokeWidth ?? 2}
            strokeDasharray={line.strokeDasharray}
            connectNulls
          />
        ))}
        {events.map((evt) => (
          <ReferenceLine
            key={`${evt.date}-${evt.label}`}
            x={evt.date}
            yAxisId="left"
            stroke="#525252"
            strokeDasharray="4 4"
            label={{
              value: evt.label,
              position: 'top',
              fill: '#a1a1aa',
              fontSize: 10,
            }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
