import { Sparkles } from 'lucide-react';
import { formatBytes } from '@/lib/format';

interface Props {
  totalCount: number;
  totalAffected: number;
  totalSize: number;
}

export function SummaryCard({ totalCount, totalAffected, totalSize }: Props) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <div className="label-mono">Analysis summary</div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Metric label="emails to act on" value={totalAffected.toLocaleString()} />
        <Metric label="storage to free" value={formatBytes(totalSize)} />
        <Metric label="actions" value={totalCount.toLocaleString()} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[20px] font-semibold tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-fg-muted mt-0.5">{label}</div>
    </div>
  );
}
