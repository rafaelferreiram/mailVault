import { Play, Mail, Users, HardDrive, Rocket, Activity } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUIStore } from '@/stores/uiStore';
import { LiveSyncControl } from '@/components/LiveSync/LiveSyncControl';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { TimeRangeSelector } from './TimeRangeSelector';
import { formatBytes, formatNumber } from '@/lib/format';
import { rangeFromKey, RANGES, AVG_MSG_BYTES } from '@/lib/timeRange';

export function Analyze() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const start = useSyncStore((s) => s.start);
  const setRoute = useUIStore((s) => s.setRoute);

  if (!account || !activeId) return null;

  const selected = sync?.selectedRange ?? rangeFromKey('30d');
  const probe = sync?.probes[selected.key];
  const count = probe?.count ?? 0;
  const bytes = probe?.bytes ?? count * AVG_MSG_BYTES;

  const canStart = !!account && !sync?.active;

  const onStart = () => {
    if (!canStart) return;
    void start(activeId, { range: selected, maxMessages: 10_000 });
  };

  const completed = !!sync?.completedAt && !sync?.error;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Analyze"
        subtitle={`Configure and run a sync against ${account.email}`}
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
      />

      <div className="p-6 space-y-6 max-w-[1240px]">
        {/* Time range selector */}
        <div className="panel p-5">
          <TimeRangeSelector />

          {/* Estimate readout */}
          <div className="mt-4 p-3 panel-inset flex items-center gap-6">
            <Stat
              icon={Mail}
              label="Emails"
              value={count > 0 ? `~${formatNumber(count)}` : probe?.loading ? '—' : '—'}
            />
            <span className="text-fg-dim font-mono">·</span>
            <Stat
              icon={HardDrive}
              label="Estimated storage"
              value={count > 0 ? `~${formatBytes(bytes)}` : '—'}
            />
            <span className="text-fg-dim font-mono">·</span>
            <Stat
              icon={Users}
              label="Senders"
              value="discovered during sync"
              valueClass="text-fg-subtle font-normal italic text-[11px]"
            />

            <div className="flex-1" />

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
              iconLeft={<Play className="w-4 h-4" />}
              onClick={onStart}
              disabled={!canStart}
            >
              {sync?.active ? 'Sync running…' : 'Start Analysis'}
            </Button>
          </div>

          {/* Reasoning footer */}
          <div className="mt-3 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
            Estimates use the provider's count API · Storage is a 60 KB / message heuristic ·
            Per-message size is exact only after sync
          </div>
        </div>

        {/* Live sync — watch Inbox + Junk after initial analysis */}
        <LiveSyncControl variant="card" />

        {/* What happens during sync */}
        <div className="panel p-5">
          <div className="label-mono mb-3">What runs during sync</div>
          <div className="grid grid-cols-5 gap-2">
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
        <div className="panel p-5">
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
