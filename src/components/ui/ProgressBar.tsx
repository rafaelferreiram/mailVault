interface Props {
  value: number;
  label?: string;
  variant?: 'accent' | 'danger' | 'ok' | 'warn';
  showPct?: boolean;
}

export function ProgressBar({ value, label, variant = 'accent', showPct = true }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const bar =
    variant === 'accent'
      ? 'bg-accent'
      : variant === 'danger'
      ? 'bg-danger'
      : variant === 'warn'
      ? 'bg-warn'
      : 'bg-ok';
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between label-mono">
          <span>{label}</span>
          {showPct && <span className="font-mono">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="h-1 w-full bg-bg-inset border border-border-subtle overflow-hidden">
        <div
          className={`h-full ${bar} transition-[width] duration-200 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
