import { useEffect } from 'react';
import clsx from 'clsx';
import { Calendar } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { RANGES, rangeFromKey, AVG_MSG_BYTES } from '@/lib/timeRange';
import type { TimeRangeKey } from '@shared/types';
import { formatBytes, formatNumber } from '@/lib/format';
import {
  averageProbeLatency,
  connectionLabel,
  estimateSyncDurationMs,
  formatEtaEstimate,
} from '@/lib/syncEta';
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
  const avgProbeMs = averageProbeLatency(sync?.probes ?? {});

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
      <div className="scroll-row -mx-1 px-1">
        <div className="scroll-row__inner items-stretch border border-border bg-bg-elevated min-w-full">
        {RANGES.map((r, i) => {
          const probe = sync?.probes[r.key];
          const selected = selectedKey === r.key;
          return (
            <button
              key={r.key}
              onClick={() => onSelect(r.key)}
              className={clsx(
                'flex-1 min-w-[100px] px-2 py-3 text-left transition-colors relative group',
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
              <div className="text-[10px] font-mono mt-1.5 tabular-nums space-y-0.5">
                {probe?.loading || probe === undefined ? (
                  <>
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-10" />
                  </>
                ) : (
                  <>
                    <div className={selected ? 'text-accent' : 'text-fg-subtle'}>
                      {probe.count > 0 ? (
                        <>~{formatNumber(probe.count, { compact: true })} emails</>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className={selected ? 'text-accent/80' : 'text-fg-subtle'}>
                      {probe.count > 0 ? (
                        <>~{formatBytes(probe.bytes ?? probe.count * AVG_MSG_BYTES, { compact: true })}</>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className={selected ? 'text-accent/70' : 'text-fg-dim'}>
                      {formatEtaEstimate(
                        estimateSyncDurationMs({
                          rangeKey: r.key,
                          emailCount: probe.count,
                          avgProbeMs,
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom range slot */}
        <button
          disabled
          className="w-[120px] shrink-0 px-2 py-3 text-left text-fg-subtle border-l border-border-subtle opacity-40 cursor-not-allowed"
          title="Custom date range — coming soon"
        >
          <div className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            CUSTOM
          </div>
          <div className="text-[12px] mt-0.5">Date range</div>
          <div className="text-[10px] font-mono mt-1.5 space-y-0.5">
            <div>—</div>
            <div>—</div>
            <div>—</div>
          </div>
        </button>
        </div>
      </div>
      {avgProbeMs != null && (
        <div className="text-[10px] font-mono text-fg-subtle">
          Sync ETA adjusted for {connectionLabel(avgProbeMs)} (probe {Math.round(avgProbeMs)}ms)
        </div>
      )}
    </div>
  );
}
