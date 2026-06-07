import clsx from 'clsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Check,
  Trash2,
  Shield,
  Inbox,
  FolderTree,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import type { DashboardSnapshot } from '@shared/types';
import { formatBytes, formatNumber, relativeTime } from '@/lib/format';
import { DashboardCard } from './DashboardCard';
import { Button } from '../ui/Button';
import { GoogleIcon, OutlookIcon } from '../ui/ProviderIcon';

type Nav = {
  goSenders: (opts?: { search?: string; filter?: 'newsletters' | 'old' }) => void;
  goAnalyze: () => void;
  goSuggestions: () => void;
  goRules: () => void;
  goNotifications: () => void;
  onPending: () => void;
  checkNow: () => void;
  pauseLive: () => void;
};

export function StorageHistoryCard({
  data,
  animateBars,
}: {
  data: DashboardSnapshot;
  animateBars: boolean;
}) {
  const chart = data.storageHistory.map((p) => ({
    name: p.date,
    freed: Math.max(0, Math.round(p.bytesFreed / 1024)),
    emails: p.emailsDeleted,
    topSender: p.topSender,
  }));

  return (
    <DashboardCard
      label="Storage freed over time"
      colSpan="dashboard-col-8"
      footer={
        <span className="flex items-center gap-2 text-fg-muted">
          <Trophy className="w-3 h-3 text-accent" />
          Total cleaned: {formatNumber(data.storageHistoryTotal.emails)} emails ·{' '}
          {formatBytes(data.storageHistoryTotal.bytes)} freed
        </span>
      }
    >
      {chart.length === 0 ? (
        <p className="text-[12px] text-fg-muted py-8 text-center">
          Run a cleanup to see storage freed per session here.
        </p>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgb(var(--color-fg-subtle))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--color-fg-subtle))' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--color-bg-elevated))',
                  border: '1px solid rgb(var(--color-border))',
                  fontSize: 11,
                }}
                formatter={(v: number, _n, p) => [
                  `${v} KB · ${(p.payload as { emails: number }).emails} emails`,
                  'Freed',
                ]}
              />
              <Bar
                dataKey="freed"
                fill="rgb(var(--color-accent))"
                radius={0}
                className={animateBars ? 'dashboard-bar-enter' : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
}

export function NewEmailsCategoryCard({
  data,
  onCategory,
}: {
  data: DashboardSnapshot;
  onCategory: (cat: string) => void;
}) {
  const total = data.newByCategory.reduce((s, c) => s + c.count, 0);
  if (total === 0) {
    return (
      <DashboardCard label="New emails — last sync" colSpan="dashboard-col-8">
        <p className="flex items-center gap-2 text-[12px] text-fg-muted py-6">
          <Check className="w-4 h-4 text-ok" />
          No new emails since last sync
        </p>
      </DashboardCard>
    );
  }

  let acc = 0;
  const segments = data.newByCategory.map((c) => {
    const start = acc;
    acc += (c.count / total) * 100;
    return { ...c, start, width: (c.count / total) * 100 };
  });

  return (
    <DashboardCard label="New emails — last sync" colSpan="dashboard-col-8">
      <div className="h-3 flex overflow-hidden bg-bg-hover mb-3">
        {segments.map((s) => (
          <button
            key={s.category}
            type="button"
            title={`${s.label} (${s.count})`}
            className="h-full hover:opacity-80 transition-opacity"
            style={{ width: `${s.width}%`, background: s.color }}
            onClick={() => onCategory(s.category)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {data.newByCategory.map((c) => (
          <button
            key={c.category}
            type="button"
            className="flex items-center gap-1.5 text-[11px] text-fg-muted hover:text-fg"
            onClick={() => onCategory(c.category)}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
            {c.label} {c.count}
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}

export function LiveSyncCard({ data, nav }: { data: DashboardSnapshot; nav: Nav }) {
  return (
    <DashboardCard
      label="Live sync"
      colSpan="dashboard-col-4"
      headerRight={
        <div className="flex gap-1">
          <button type="button" className="text-[10px] text-accent hover:underline" onClick={nav.checkNow}>
            Check now
          </button>
          <span className="text-fg-dim">·</span>
          <button type="button" className="text-[10px] text-fg-muted hover:underline" onClick={nav.pauseLive}>
            Pause
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {data.liveAccounts.map((a) => (
          <div key={a.accountId} className="text-[12px]">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={clsx(
                  'w-2 h-2 rounded-full shrink-0',
                  a.status === 'active' && 'bg-ok dashboard-live-dot',
                  a.status === 'paused' && 'bg-warn',
                  (a.status === 'error' || a.status === 'offline') && 'bg-danger'
                )}
              />
              {a.provider === 'google' ? <GoogleIcon size={10} /> : <OutlookIcon size={10} />}
              <span className="truncate font-medium">{a.email}</span>
            </div>
            <div className="text-[10px] text-fg-subtle font-mono pl-4">
              Last check: {a.lastPollAt ? relativeTime(a.lastPollAt) : 'never'}
              {a.nextPollAt && a.status === 'active' ? ` · next ${relativeTime(a.nextPollAt)}` : ''}
            </div>
            {a.errorMessage && (
              <div className="text-[10px] text-danger pl-4 mt-0.5">{a.errorMessage}</div>
            )}
          </div>
        ))}
        {!data.liveAccounts.length && (
          <p className="text-[11px] text-fg-muted">Connect an account to enable live sync.</p>
        )}
      </div>
    </DashboardCard>
  );
}

export function SpaceHogsCard({
  data,
  onSender,
  onDelete,
}: {
  data: DashboardSnapshot;
  onSender: (email: string) => void;
  onDelete: (email: string) => void;
}) {
  const max = data.spaceHogs[0]?.bytes ?? 1;
  return (
    <DashboardCard
      label="Biggest storage hogs"
      colSpan="dashboard-col-4"
      footer={
        data.spaceHogsFooter.topBytes > 0
          ? `Top ${data.spaceHogs.length} senders · ${formatBytes(data.spaceHogsFooter.topBytes)} (${data.spaceHogsFooter.pctOfTotal}% of storage)`
          : undefined
      }
    >
      {data.spaceHogs.length === 0 ? (
        <p className="text-[12px] text-fg-muted py-4">Your inbox is clean — no major storage hogs found.</p>
      ) : (
        <ul className="space-y-2">
          {data.spaceHogs.map((h) => (
            <li
              key={h.email}
              className="group rounded-sm px-1 py-1 hover:bg-bg-hover transition-colors cursor-pointer"
              onClick={() => onSender(h.email)}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] min-h-7">
                <span className="truncate font-mono flex-1 min-w-0">{h.email}</span>
                <span className="shrink-0 tabular-nums text-fg-muted group-hover:hidden">
                  {formatNumber(h.count)} · {formatBytes(h.bytes)}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  size="xs"
                  uppercase={false}
                  iconLeft={<Trash2 className="w-3 h-3" />}
                  className="hidden group-hover:inline-flex shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(h.email);
                  }}
                >
                  Delete
                </Button>
              </div>
              <div className="h-1.5 bg-bg-hover mt-1 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${(h.bytes / max) * 100}%`, background: h.categoryColor }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

export function CategoryDonutCard({
  data,
  onCategory,
}: {
  data: DashboardSnapshot;
  onCategory: (cat: string) => void;
}) {
  const total = data.categoryBreakdown.reduce((s, c) => s + c.count, 0);
  const pie = data.categoryBreakdown.slice(0, 8);

  return (
    <DashboardCard label="Emails by category" colSpan="dashboard-col-4">
      {total === 0 ? (
        <p className="text-[12px] text-fg-muted py-6 text-center">No categorized mail yet.</p>
      ) : (
        <>
          <div className="h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={1}
                >
                  {pie.map((e) => (
                    <Cell key={e.category} fill={e.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-mono text-[14px] font-semibold tabular-nums">{formatNumber(total)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
            {pie.map((c) => {
              const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
              return (
                <button
                  key={c.category}
                  type="button"
                  className="flex items-center gap-1.5 text-[10px] text-left hover:text-fg text-fg-muted"
                  onClick={() => onCategory(c.category)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="truncate">{c.label}</span>
                  <span className="ml-auto tabular-nums">{pct}%</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </DashboardCard>
  );
}

export function ActivityFeedCard({
  data,
  onUndo,
  onShowAll,
}: {
  data: DashboardSnapshot;
  onUndo: (id: string) => void;
  onShowAll: () => void;
}) {
  const now = Date.now();
  return (
    <DashboardCard
      label="Recent activity"
      colSpan="dashboard-col-8"
      footer={
        <button type="button" className="text-accent hover:underline" onClick={onShowAll}>
          Show all →
        </button>
      }
    >
      {data.activity.length === 0 ? (
        <p className="text-[12px] text-fg-muted py-4">No automated actions yet.</p>
      ) : (
        <ul className="space-y-1 max-h-[220px] overflow-y-auto">
          {data.activity.map((a) => {
            const icon = activityIcon(a.actionType);
            const canUndo = !a.undoneAt && a.undoableUntil > now;
            const stale = a.undoableUntil <= now;
            return (
              <li
                key={a.id}
                className="group flex items-start gap-2 py-1.5 px-1 hover:bg-bg-hover text-[11px]"
              >
                <span className={clsx('mt-0.5 shrink-0', icon.className)}>{icon.node}</span>
                <span className="font-mono text-fg-subtle shrink-0 w-14">{relativeTime(a.appliedAt)}</span>
                <span className="flex-1 text-fg-muted truncate">{a.summary}</span>
                {canUndo && (
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-fg-subtle hover:text-accent shrink-0"
                    onClick={() => onUndo(a.id)}
                  >
                    Undo
                  </button>
                )}
                {stale && a.undoneAt == null && (
                  <span className="opacity-0 group-hover:opacity-40 text-[10px] text-fg-dim shrink-0">
                    Undo
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

export function FolderSummaryCard({
  data,
  onFolder,
  onJunkWarning,
}: {
  data: DashboardSnapshot;
  onFolder: (folderId: string) => void;
  onJunkWarning: () => void;
}) {
  return (
    <DashboardCard label="Your folders" colSpan="dashboard-col-4">
      <ul className="space-y-1 max-h-[220px] overflow-y-auto">
        {data.folders.slice(0, 12).map((f) => (
          <li key={f.folderId}>
            <button
              type="button"
              className="w-full flex items-center gap-2 py-1.5 px-1 text-[11px] hover:bg-bg-hover text-left"
              onClick={() => (f.junkWarning ? onJunkWarning() : onFolder(f.folderId))}
            >
              <FolderTree className="w-3 h-3 text-fg-subtle shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="tabular-nums text-fg-muted">{formatNumber(f.count)}</span>
              {f.newSinceSync > 0 && (
                <span className="text-accent font-mono text-[10px]">+{f.newSinceSync}</span>
              )}
              {f.junkWarning && (
                <span className="text-warn text-[10px]" title="Possible legitimate mail in junk">
                  ⚠
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

export function CleanupPotentialCard({ data, onStart }: { data: DashboardSnapshot; onStart: () => void }) {
  const pct = data.cleanup.deletablePct;
  const barColor = pct > 60 ? 'bg-danger' : pct > 30 ? 'bg-warn' : 'bg-ok';
  const empty = data.cleanup.deletableCount === 0;

  return (
    <DashboardCard label="Cleanup potential" colSpan="dashboard-col-4">
      {empty ? (
        <p className="text-[13px] text-fg-muted py-4">
          Nothing to clean right now. Great inbox hygiene!
        </p>
      ) : (
        <>
          <p className="text-[15px] font-medium text-fg mb-3">
            You could free {formatBytes(data.cleanup.deletableBytes)} today
          </p>
          <div className="h-2 bg-bg-hover mb-3 overflow-hidden">
            <div className={clsx('h-full', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <ul className="text-[11px] text-fg-muted space-y-1 mb-4 font-mono">
            <li>{formatNumber(data.cleanup.deletableCount)} emails eligible for deletion</li>
            <li>{formatNumber(data.cleanup.newsletterCount)} newsletter senders</li>
            <li>{data.cleanup.folderSuggestions} folder suggestions</li>
          </ul>
          <Button variant="primary" size="sm" onClick={onStart}>
            Start cleanup →
          </Button>
        </>
      )}
    </DashboardCard>
  );
}

export function SyncTimelineCard({ data, onSync }: { data: DashboardSnapshot; onSync: () => void }) {
  return (
    <DashboardCard
      label="Sync history"
      colSpan="dashboard-col-4"
      footer={
        <button type="button" className="text-accent hover:underline" onClick={onSync}>
          Sync now
        </button>
      }
    >
      <ul className="space-y-2 text-[11px] max-h-[180px] overflow-y-auto">
        {data.syncTimeline.length === 0 ? (
          <li className="text-fg-muted">No sync history yet.</li>
        ) : (
          data.syncTimeline.map((row) => (
            <li key={row.id} className={row.kind === 'live' ? 'text-fg-subtle' : 'text-fg-muted'}>
              <div className="flex gap-2">
                <span className="font-mono shrink-0 w-12">
                  {new Date(row.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className={row.kind === 'warning' ? 'text-warn' : ''}>
                  {row.kind === 'full' ? '✓' : row.kind === 'warning' ? '⚠' : '·'}
                </span>
                <span className="flex-1">
                  <span className="text-fg">{row.label}</span> — {row.detail}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </DashboardCard>
  );
}

export function QuickActionsCard({ data, nav }: { data: DashboardSnapshot; nav: Nav }) {
  return (
    <DashboardCard label="Quick actions" colSpan="dashboard-col-4">
      <div className="grid grid-cols-2 gap-2">
        <QuickBtn
          icon={Trash2}
          title="Clean newsletters"
          sub={`${formatNumber(data.quickActions.newsletterCount)} senders`}
          onClick={() => nav.goSenders({ filter: 'newsletters' })}
        />
        <QuickBtn
          icon={FolderTree}
          title="Organize inbox"
          sub={`${formatNumber(data.quickActions.organizeCount)} to sort`}
          onClick={() => nav.goSenders()}
        />
        <QuickBtn
          icon={RefreshCw}
          title="Sync now"
          sub={data.quickActions.lastSyncAt ? `Last ${relativeTime(data.quickActions.lastSyncAt)}` : 'Not synced'}
          onClick={nav.goAnalyze}
        />
        <QuickBtn
          icon={SlidersHorizontal}
          title="Review rules"
          sub={`${data.quickActions.ruleSuggestions} suggestions`}
          onClick={nav.goRules}
        />
      </div>
    </DashboardCard>
  );
}

function QuickBtn({
  icon: Icon,
  title,
  sub,
  onClick,
}: {
  icon: typeof Trash2;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel-inset p-3 text-left hover:bg-bg-hover transition-colors flex flex-col gap-2 min-h-[88px]"
    >
      <Icon className="w-4 h-4 text-accent" />
      <span className="text-[12px] font-medium text-fg">{title}</span>
      <span className="text-[10px] font-mono text-fg-subtle">{sub}</span>
    </button>
  );
}

function activityIcon(type: string) {
  if (type.includes('trash') || type === 'delete')
    return { node: <Trash2 className="w-3.5 h-3.5" />, className: 'text-fg-subtle' };
  if (type.includes('rule'))
    return { node: <SlidersHorizontal className="w-3.5 h-3.5" />, className: 'text-info' };
  if (type.includes('junk') || type.includes('inbox'))
    return { node: <Inbox className="w-3.5 h-3.5" />, className: 'text-ok' };
  if (type.includes('block'))
    return { node: <Shield className="w-3.5 h-3.5" />, className: 'text-danger' };
  return { node: <Sparkles className="w-3.5 h-3.5" />, className: 'text-accent' };
}
