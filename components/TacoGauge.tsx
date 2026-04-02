'use client';

interface TacoGaugeProps {
  score: number;
  componentsAvailable: number;
}

function getScoreColor(score: number): string {
  if (score < 4) return '#22c55e';
  if (score < 7) return '#eab308';
  return '#ef4444';
}

export default function TacoGauge({ score, componentsAvailable }: TacoGaugeProps) {
  const color = getScoreColor(score);
  const pct = Math.min(Math.max((score / 10) * 100, 0), 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-mono font-bold text-5xl font-tabular" style={{ color }}>
        {score.toFixed(1)}
        <span className="text-muted text-lg font-normal">/10</span>
      </p>
      {/* Gradient bar with marker */}
      <div className="relative w-full h-1 rounded-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)',
          }}
        />
        <div
          className="absolute top-[-3px] h-[10px] w-[3px] rounded-sm bg-white"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      {componentsAvailable < 4 && (
        <p className="text-muted text-xs">({componentsAvailable}/4 components)</p>
      )}
    </div>
  );
}
