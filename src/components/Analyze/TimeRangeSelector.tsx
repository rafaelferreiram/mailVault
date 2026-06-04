import { useEffect } from 'react';
import clsx from 'clsx';
import { Calendar } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { RANGES, rangeFromKey } from '@/lib/timeRange';
import type { TimeRangeKey } from '@shared/types';
import { formatNumber } from '@/lib/format';
import { Skeleton } from '../ui/Skeleton';

export function TimeRangeSelector() {
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const setRange = useSyncStore((s) => s.setRange);
  const probe = useSyncStore((s) => s.probe);
  const probeAll = useSyncStore((s) => s.probeAll);

  useEffect(() => {
    if (!activeId) return;
    // Kick off all probes once when arriving on the screen.
    void probeAll(activeId);
  }, [activeId, probeAll]);

  const selectedKey = sync?.selectedRange.key ?? '30d';

  const onSelect = (k: TimeRangeKey) => {
    if (!activeId) return;
    const range = rangeFromKey(k);
    setRange(activeId, range);
    if (!sync?.probes[k]) void probe(activeId, range);
  };

  return (
    <div data-tour="time-range" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-fg">
            Sync Window
          </div>
          <div className="text-xs text-fg-muted mt-0.5">
            Pick a time range. We'll probe each provider for an estimate before fetching.
          </div>
        </div>
      </div>

      {/* Timeline-bar selector */}
      <div className="flex items-stretch border border-border bg-bg-elevated">
        {RANGES.map((r, i) => {
          const probe = sync?.probes[r.key];
          const selected = selectedKey === r.key;
          return (
            <button
              key={r.key}
              onClick={() => onSelect(r.key)}
              className={clsx(
                'flex-1 px-2 py-3 text-left transition-colors relative group min-w-0',
                i < RANGES.length - 1 && 'border-r border-border-subtle',
                selected
                  ? 'bg-accent/10 text-accent shadow-[inset_0_2px_0_0_theme(colors.accent.DEFAULT)]'
                  : 'text-fg-muted hover:text-fg hover:bg-bg-hover'
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest opacity-80">
                {r.short}
              </div>
              <div className="text-[12px] mt-0.5 font-medium">{r.label}</div>
              <div className="text-[10px] font-mono mt-1.5 tabular-nums">
                {probe?.loading || probe === undefined ? (
                  <Skeleton className="h-3 w-12" />
                ) : probe.count > 0 ? (
                  <span className={selected ? 'text-accent' : 'text-fg-subtle'}>
                    ~{formatNumber(probe.count, { compact: true })}
                  </span>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom range slot */}
        <button
          disabled
          className="w-[120px] px-2 py-3 text-left text-fg-subtle border-l border-border-subtle opacity-40 cursor-not-allowed"
          title="Custom date range — coming soon"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            CUSTOM
          </div>
          <div className="text-[12px] mt-0.5">Date range</div>
          <div className="text-[10px] font-mono mt-1.5">—</div>
        </button>
      </div>
    </div>
  );
}
