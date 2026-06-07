import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronUp,
  ChevronDown,
  X,
  Mail,
  Users,
  HardDrive,
  Newspaper,
  Lightbulb,
  StopCircle,
  CheckCircle2,
  Activity,
  Timer,
} from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUIStore } from '@/stores/uiStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { formatBytes, formatDuration, formatNumber, formatTimestampHHMMSS } from '@/lib/format';
import { estimateRemainingMs, formatEtaEstimate } from '@/lib/syncEta';
import { StageProgressBar } from '../ui/StageProgressBar';

const STAGE_LABELS: Record<string, string> = {
  fetch: 'Fetching email metadata',
  group: 'Grouping by sender',
  storage: 'Calculating storage usage',
  detect: 'Detecting newsletters',
  suggest: 'Building suggestions',
};

export function SyncDrawer() {
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const showDrawer = usePrefsStore((s) => s.prefs.panels.syncDrawer);
  const cancel = useSyncStore((s) => s.cancel);
  const setCollapsed = useSyncStore((s) => s.setCollapsed);
  const closeDrawer = useSyncStore((s) => s.closeDrawer);
  const setRoute = useUIStore((s) => s.setRoute);

  const logRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!sync?.active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [sync?.active]);

  const remainingMs =
    sync?.active && sync.startedAt && sync.estimatedDurationMs
      ? estimateRemainingMs({
          estimatedTotalMs: sync.estimatedDurationMs,
          startedAt: sync.startedAt,
          stage: sync.stage,
        })
      : null;
  void tick;

  // Auto-scroll log to bottom on new entries.
  useEffect(() => {
    if (sync?.log && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [sync?.log.length]);

  if (!showDrawer || !sync || !sync.drawerOpen) return null;

  const collapsed = sync.drawerCollapsed;

  // Set CSS var so toasts don't overlap the drawer.
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(
      '--drawer-h',
      collapsed ? '36px' : '288px'
    );
  }

  if (collapsed) {
    return <CollapsedBar onExpand={() => setCollapsed(false)} />;
  }

  const stage = sync.stage;
  const stats = sync.stats;
  const elapsed = sync.startedAt ? Date.now() - sync.startedAt : 0;
  const completed = !!sync.completedAt && !sync.error;
  const failed = !!sync.error;

  return (
    <div className="h-72 shrink-0 border-t border-border bg-bg-elevated flex flex-col animate-fade-in">
      {/* Drawer header */}
      <div className="h-9 shrink-0 px-3 border-b border-border flex items-center gap-3">
        <Activity className={clsx('w-3 h-3 text-accent', sync.active && 'animate-pulse-soft')} />
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
          Sync Engine
        </div>
        <div
          className={clsx(
            'text-[10px] font-mono uppercase tracking-widest',
            sync.active ? 'text-accent animate-sync-pulse' : 'text-fg-subtle'
          )}
        >
          {sync.active
            ? `Running · ${formatDuration(elapsed)}${
                remainingMs != null ? ` · ${formatEtaEstimate(remainingMs)} left` : ''
              }`
            : completed
            ? `Complete · ${formatDuration(sync.completedAt! - (sync.startedAt ?? sync.completedAt!))}`
            : failed
            ? `Error · ${sync.error}`
            : 'Idle'}
        </div>

        <div className="flex-1" />

        {sync.active && (
          <button
            onClick={() => activeId && cancel(activeId)}
            className="btn btn-ghost !h-6 !px-2 gap-1.5"
          >
            <StopCircle className="w-3 h-3" />
            Cancel
          </button>
        )}
        {completed && (
          <button
            onClick={() => setRoute('senders')}
            className="btn btn-primary !h-6 !px-2.5"
          >
            View Results
          </button>
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="text-fg-subtle hover:text-fg p-1"
          title="Minimize"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => activeId && closeDrawer(activeId)}
          className="text-fg-subtle hover:text-fg p-1"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stage progress */}
      <div className="px-3 pt-2 pb-2 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Stage {stage?.index ?? 0}/{stage?.total ?? 5}
            </span>
            <span className="text-[12px] text-fg">
              {completed ? 'Done' : stage?.label ?? '—'}
            </span>
            {sync.active && stage && (
              <span className="font-mono text-[10px] text-accent tabular-nums">
                {Math.round((stage.progress ?? 0) * 100)}%
              </span>
            )}
            {sync.active && remainingMs != null && (
              <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
                ETA {formatEtaEstimate(remainingMs)}
              </span>
            )}
            {completed && <CheckCircle2 className="w-3 h-3 text-ok" />}
          </div>
        </div>
        <StageProgressBar
          current={completed ? 5 : stage?.index ?? 0}
          total={stage?.total ?? 5}
          stageProgress={completed ? 1 : stage?.progress ?? 0}
        />
        {sync.active && <div className="loading-bar mt-2" aria-hidden><div className="loading-bar__track" /></div>}
      </div>

      {/* Body: log + stats sidebar */}
      <div className="flex-1 min-h-0 flex">
        {/* Activity log */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-border-subtle">
          <div className="px-3 h-7 border-b border-border-subtle flex items-center gap-3">
            <span className="label-mono">Activity log</span>
            <span className="font-mono text-[10px] text-fg-subtle">
              {sync.log.length} entries
            </span>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto py-1">
            {sync.log.map((entry, i) => (
              <div key={i} className={`log-line log-${entry.level}`}>
                <span className="text-fg-subtle shrink-0">
                  [{formatTimestampHHMMSS(entry.ts)}]
                </span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))}
            {!sync.log.length && (
              <div className="px-3 py-2 text-[11px] text-fg-subtle font-mono">
                No activity yet…
              </div>
            )}
          </div>
        </div>

        {/* Live stats sidebar */}
        <div className="w-[260px] shrink-0 flex flex-col">
          <div className="px-3 h-7 border-b border-border-subtle flex items-center">
            <span className="label-mono">Live stats</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <StatRow
              icon={Mail}
              label="Emails fetched"
              value={formatNumber(stats.emailsFetched)}
            />
            <StatRow
              icon={Users}
              label="Senders discovered"
              value={formatNumber(stats.sendersDiscovered)}
            />
            <StatRow
              icon={HardDrive}
              label="Storage accounted"
              value={formatBytes(stats.bytesAccounted)}
            />
            <StatRow
              icon={Newspaper}
              label="Newsletters"
              value={formatNumber(stats.newslettersDetected)}
            />
            <StatRow
              icon={Lightbulb}
              label="Suggestions"
              value={formatNumber(stats.suggestionsBuilt)}
              accent
            />
            {sync.active && sync.estimatedDurationMs != null && remainingMs != null && (
              <StatRow
                icon={Timer}
                label="Time remaining"
                value={formatEtaEstimate(remainingMs)}
                accent
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-inset px-2.5 h-9 flex items-center gap-2.5">
      <Icon className={`w-3 h-3 shrink-0 ${accent ? 'text-accent' : 'text-fg-subtle'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle truncate">
          {label}
        </div>
      </div>
      <div
        className={`font-mono text-[12px] tabular-nums ${
          accent ? 'text-accent' : 'text-fg'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CollapsedBar({ onExpand }: { onExpand: () => void }) {
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!sync?.active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [sync?.active]);

  if (!sync?.drawerOpen) return null;

  const stage = sync.stage;
  const completed = !!sync.completedAt && !sync.error;
  const remainingMs =
    sync.active && sync.startedAt && sync.estimatedDurationMs
      ? estimateRemainingMs({
          estimatedTotalMs: sync.estimatedDurationMs,
          startedAt: sync.startedAt,
          stage: sync.stage,
        })
      : null;
  void tick;
  const fillPct =
    stage && !completed
      ? ((stage.index - 1 + (stage.progress ?? 0)) / Math.max(stage.total, 1)) * 100
      : 100;

  return (
    <div
      onClick={onExpand}
      className="h-9 shrink-0 border-t border-border bg-bg-elevated flex items-center gap-3 px-3 cursor-pointer hover:bg-bg-hover"
    >
      {sync.active ? (
        <Activity className="w-3 h-3 text-accent animate-pulse-soft" />
      ) : (
        <CheckCircle2 className="w-3 h-3 text-ok" />
      )}
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
        Stage {stage?.index ?? 0}/{stage?.total ?? 5}
      </span>
      <span className="text-[11px] text-fg flex-1 truncate">
        {completed ? 'Sync complete' : STAGE_LABELS[stage?.id ?? 'fetch'] ?? 'Working…'}
      </span>
      <div className="w-48 h-1 bg-bg-inset border border-border-subtle relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-[width]"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-accent tabular-nums">
        {Math.round(fillPct)}%
        {remainingMs != null ? ` · ${formatEtaEstimate(remainingMs)}` : ''}
      </span>
      <ChevronUp className="w-3.5 h-3.5 text-fg-subtle" />
    </div>
  );
}
