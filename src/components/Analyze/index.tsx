import { Play, Mail, Users, HardDrive, Rocket, Activity, Loader2, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUIStore } from '@/stores/uiStore';
import { LiveSyncControl } from '@/components/LiveSync/LiveSyncControl';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { TimeRangeSelector } from './TimeRangeSelector';
import { formatBytes, formatNumber } from '@/lib/format';
import { rangeFromKey, RANGES, AVG_MSG_BYTES } from '@/lib/timeRange';
import {
  averageProbeLatency,
  connectionLabel,
  estimateSyncDurationMs,
  formatEtaEstimate,
} from '@/lib/syncEta';

export function Analyze() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const start = useSyncStore((s) => s.start);
  const setRoute = useUIStore((s) => s.setRoute);
  const showToast = useUIStore((s) => s.showToast);

  if (!account || !activeId) return null;

  const selected = sync?.selectedRange ?? rangeFromKey('30d');
  const probe = sync?.probes[selected.key];
  const count = probe?.count ?? 0;
  const bytes = probe?.bytes ?? count * AVG_MSG_BYTES;
  const probeReady = !!probe && !probe.loading;
  const avgProbeMs = averageProbeLatency(sync?.probes ?? {});
  const etaMs = estimateSyncDurationMs({
    rangeKey: selected.key,
    emailCount: count,
    avgProbeMs,
  });

  const canStart = !!account && !sync?.active;

  const onStart = async () => {
    if (!canStart) return;
    try {
      await start(activeId, { range: selected, maxMessages: 10_000 });
      const err = useSyncStore.getState().byAccount[activeId]?.error;
      if (err) {
        showToast('err', err.replace(/^Error invoking remote method 'sync:start': Error: /, ''));
      }
    } catch (e) {
      showToast('err', (e as Error).message);
    }
  };

  const completed = !!sync?.completedAt && !sync?.error;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Analyze"
        subtitle={`Configure and run a sync against ${account.email}`}
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
      />

      <div className="page-content page-content--narrow space-y-6">
        {/* Time range selector */}
        <div className="panel p-4 sm:p-5">
          <TimeRangeSelector />

          {/* Estimate readout */}
          <div className="mt-4 p-3 panel-inset flex flex-wrap items-center gap-x-4 gap-y-3">
            <Stat
              icon={Mail}
              label="Emails"
              value={
                probe?.loading
                  ? '…'
                  : probeReady && count > 0
                    ? `~${formatNumber(count)}`
                    : probeReady
                      ? '0'
                      : '—'
              }
            />
            <span className="hidden sm:inline text-fg-dim font-mono">·</span>
            <Stat
              icon={HardDrive}
              label="Estimated storage"
              value={
                probe?.loading
                  ? '…'
                  : probeReady && count > 0
                    ? `~${formatBytes(bytes)}`
                    : probeReady
                      ? formatBytes(0)
                      : '—'
              }
            />
            <span className="hidden sm:inline text-fg-dim font-mono">·</span>
            <Stat
              icon={Clock}
              label="Est. sync time"
              value={
                probe?.loading
                  ? '…'
                  : probeReady
                    ? formatEtaEstimate(etaMs)
                    : '—'
              }
            />
            <span className="hidden sm:inline text-fg-dim font-mono">·</span>
            <Stat
              icon={Users}
              label="Senders"
              value="discovered during sync"
              valueClass="text-fg-subtle font-normal italic text-[11px]"
            />

            <div className="w-full sm:flex-1" />

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {completed && (
                <Button
                  variant="secondary"
                  onClick={() => setRoute('senders')}
                  iconLeft={<Activity className="w-3.5 h-3.5" />}
                >
                  View Last Results
                </Button>
              )}

              <Button
                variant="primary"
                size="lg"
                iconLeft={
                  sync?.active ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )
                }
                onClick={onStart}
                disabled={!canStart}
                className={clsx('w-full sm:w-auto', sync?.active && 'sync-active-glow')}
              >
                {sync?.active ? 'Sync running…' : 'Start Analysis'}
              </Button>
            </div>
          </div>

          {/* Reasoning footer */}
          <div className="mt-3 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
            Estimates use the provider count API · Storage uses a 60 KB / message heuristic · Sync
            ETA scales with range, volume
            {avgProbeMs != null ? ` and ${connectionLabel(avgProbeMs)}` : ''}
          </div>
        </div>

        {/* Live sync — watch Inbox + Junk after initial analysis */}
        <LiveSyncControl variant="card" />

        {/* What happens during sync */}
        <div className="panel p-4 sm:p-5">
          <div className="label-mono mb-3">What runs during sync</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {[
              { n: 1, label: 'Fetch metadata', desc: 'List + metadata-only fetch via API' },
              { n: 2, label: 'Group by sender', desc: 'Bucket every message by from address' },
              { n: 3, label: 'Storage', desc: 'Tally bytes per sender from sizeEstimate' },
              { n: 4, label: 'Detect newsletters', desc: 'List-Unsubscribe + bulk-pattern signals' },
              { n: 5, label: 'Suggest folders', desc: 'Domain + category heuristics' },
            ].map((s) => (
              <div key={s.n} className="panel-inset p-3 relative">
                <div className="font-mono text-[10px] text-accent tracking-widest">STAGE {s.n}</div>
                <div className="text-[12px] font-medium mt-1">{s.label}</div>
                <div className="text-[10px] text-fg-muted mt-1 leading-snug">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Help */}
        <div className="panel p-4 sm:p-5">
          <div className="label-mono mb-2 flex items-center gap-2">
            <Rocket className="w-3 h-3" />
            <span>Tips</span>
          </div>
          <ul className="text-xs text-fg-muted space-y-1 list-disc list-inside">
            <li>
              The sync runs in the background — you can navigate freely while it works. Watch
              progress in the bottom drawer.
            </li>
            <li>
              Smaller windows finish faster. If you want a complete picture but can't wait, sync{' '}
              <span className="font-mono text-fg">{RANGES[5].label}</span> first then run again on{' '}
              <span className="font-mono text-fg">{RANGES[7].label}</span> later.
            </li>
            <li>
              Nothing is deleted or moved during sync — analysis is read-only.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueClass = 'font-mono text-[14px] tabular-nums text-fg',
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-fg-subtle shrink-0" />
      <div className="min-w-0">
        <div className="label-mono">{label}</div>
        <div className={valueClass}>{value}</div>
      </div>
    </div>
  );
}
