'use client';

const BADGE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  GREEN:   { bg: 'var(--badge-green-bg)',   text: 'var(--badge-green-text)',   label: 'LOW RISK' },
  YELLOW:  { bg: 'var(--badge-yellow-bg)',  text: 'var(--badge-yellow-text)',  label: 'ELEVATED' },
  RED:     { bg: 'var(--badge-red-bg)',     text: 'var(--badge-red-text)',     label: 'HIGH RISK' },
  UNKNOWN: { bg: 'var(--badge-unknown-bg)', text: 'var(--badge-unknown-text)', label: 'DATA UNAVAILABLE' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

interface RiskBadgeProps {
  badge: string;
  date: string;
  dataQuality: string;
}

export default function RiskBadge({ badge, date, dataQuality }: RiskBadgeProps) {
  const config = BADGE_CONFIG[badge] ?? BADGE_CONFIG.UNKNOWN;

  return (
    <div
      className="w-full rounded-lg py-6 px-4 text-center"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <p className="text-2xl font-bold tracking-wide">{config.label}</p>
      <p className="mt-1 text-sm opacity-80">Status as of {formatDate(date)}</p>
      {dataQuality === 'partial' && (
        <p className="mt-2 text-xs opacity-70">
          ⚠ Some data sources were unavailable. Assessment based on partial data.
        </p>
      )}
    </div>
  );
}
