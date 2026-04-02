interface DataQualityIndicatorProps {
  quality: string;
  componentsAvailable?: number;
}

const QUALITY_STYLES: Record<string, { color: string; label: string; icon?: string }> = {
  complete: { color: '#22c55e', label: 'Complete' },
  partial:  { color: '#eab308', label: 'Partial', icon: '⚠' },
  stale:    { color: '#ef4444', label: 'Stale' },
};

export default function DataQualityIndicator({ quality, componentsAvailable }: DataQualityIndicatorProps) {
  const style = QUALITY_STYLES[quality] ?? QUALITY_STYLES.stale;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: style.color }}
      />
      <span style={{ color: style.color }}>
        {style.icon && `${style.icon} `}{style.label}
      </span>
      {componentsAvailable !== undefined && componentsAvailable < 4 && (
        <span className="text-muted">({componentsAvailable}/4 components)</span>
      )}
    </span>
  );
}
