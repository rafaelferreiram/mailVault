import { useEffect, useMemo, useState } from 'react';
import { Trash2, ArrowRight, Search, ShieldOff, Activity } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUIStore } from '@/stores/uiStore';
import { groupBySender, sortGroups, type SortKey } from '@/lib/grouping';
import { formatBytes, formatNumber } from '@/lib/format';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { SkeletonRows } from '../ui/Skeleton';
import { SenderRow } from './SenderRow';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function InboxCleaner() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const setRoute = useUIStore((s) => s.setRoute);
  const selected = useUIStore((s) => s.selectedSenders);
  const toggleSender = useUIStore((s) => s.toggleSender);
  const selectMany = useUIStore((s) => s.selectMany);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const expanded = useUIStore((s) => s.expandedSender);
  const toggleExpanded = useUIStore((s) => s.toggleExpanded);
  const setReviewOpen = useUIStore((s) => s.setReviewOpen);
  const reviewOpen = useUIStore((s) => s.reviewOpen);
  const openMovePicker = useUIStore((s) => s.openMovePicker);

  const [sortKey, setSortKey] = useState<SortKey>('count');
  const sendersFilterPref = useUIStore((s) => s.sendersFilter);
  const sendersSearchPref = useUIStore((s) => s.sendersSearch);
  const setSendersSearchPref = useUIStore((s) => s.setSendersSearch);
  const [filter, setFilter] = useState<'all' | 'newsletters' | 'unread' | 'old'>(sendersFilterPref);
  const [search, setSearch] = useState(sendersSearchPref ?? '');

  useEffect(() => {
    if (sendersFilterPref !== 'all') setFilter(sendersFilterPref);
    if (sendersSearchPref) {
      setSearch(sendersSearchPref);
      setSendersSearchPref(null);
    }
  }, [sendersFilterPref, sendersSearchPref, setSendersSearchPref]);

  const messages = sync?.messages ?? [];

  const filteredMessages = useMemo(() => {
    let m = messages;
    if (filter === 'unread') m = m.filter((x) => x.isUnread);
    if (filter === 'old') {
      const cutoff = Date.now() - 6 * 30 * 86400_000;
      m = m.filter((x) => x.receivedAt < cutoff);
    }
    if (filter === 'newsletters') m = m.filter((x) => x.hasListUnsubscribe);
    if (search.trim()) {
      const q = search.toLowerCase();
      m = m.filter(
        (x) =>
          x.fromEmail.toLowerCase().includes(q) ||
          x.fromName.toLowerCase().includes(q) ||
          x.subject.toLowerCase().includes(q)
      );
    }
    return m;
  }, [messages, filter, search]);

  const groups = useMemo(() => groupBySender(filteredMessages), [filteredMessages]);
  const sortedGroups = useMemo(() => sortGroups(groups, sortKey), [groups, sortKey]);

  const expandedGroup = useMemo(
    () => (expanded ? sortedGroups.find((g) => g.email === expanded) : undefined),
    [expanded, sortedGroups]
  );
  const expandedMessages = useMemo(() => {
    if (!expanded) return [];
    return filteredMessages.filter((m) => m.fromEmail === expanded);
  }, [expanded, filteredMessages]);

  const totalSelectedMessages = useMemo(() => {
    let n = 0;
    for (const g of groups) if (selected.has(g.email)) n += g.count;
    return n;
  }, [groups, selected]);

  const totalSelectedBytes = useMemo(() => {
    let b = 0;
    for (const g of groups) if (selected.has(g.email)) b += g.totalBytes;
    return b;
  }, [groups, selected]);

  const allSelected =
    sortedGroups.length > 0 && sortedGroups.every((g) => selected.has(g.email));
  const someSelected = sortedGroups.some((g) => selected.has(g.email));

  const toggleAll = () => {
    if (allSelected) clearSelection();
    else selectMany(sortedGroups.map((g) => g.email));
  };

  useKeyboardShortcuts({
    enter: () => {
      if (selected.size > 0 && !reviewOpen) setReviewOpen(true);
    },
    escape: () => {
      if (reviewOpen) setReviewOpen(false);
      else clearSelection();
    },
    a: () => toggleAll(),
    m: () => {
      if (selected.size > 0) openMovePicker(Array.from(selected));
    },
    '/': (e) => {
      e.preventDefault();
      (document.getElementById('senders-search') as HTMLInputElement | null)?.focus();
    },
  });

  if (!account) return null;

  if (!sync?.completedAt && !sync?.active && !messages.length) {
    return (
      <div data-tour="sender-grid" className="flex-1 flex flex-col min-h-0">
        <PageHeader
          title="Senders"
          subtitle="Group every email by sender"
          badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="panel p-8 max-w-md">
            <Activity className="w-5 h-5 text-accent mb-3" />
            <div className="font-mono text-[14px] font-semibold tracking-[0.04em]">
              Run a sync first
            </div>
            <div className="text-[12px] text-fg-muted mt-1">
              The sender grid is built from your last analysis. Pick a time range and start a sync
              to populate this view.
            </div>
            <div className="mt-4">
              <Button variant="primary" onClick={() => setRoute('analyze')}>
                Open Analyze
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-tour="sender-grid" className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Senders"
        subtitle={`${formatNumber(messages.length)} emails grouped by ${formatNumber(groups.length)} senders`}
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<ArrowRight className="w-3 h-3" />}
              disabled={selected.size === 0}
              onClick={() => openMovePicker(Array.from(selected))}
            >
              Move
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Trash2 className="w-3 h-3" />}
              disabled={selected.size === 0}
              onClick={() => setReviewOpen(true)}
            >
              Review &amp; Delete{selected.size > 0 ? ` · ${selected.size}` : ''}
            </Button>
          </>
        }
      />

      <div className="senders-panes flex-1 flex flex-col min-h-0 min-w-0">
        <div className="senders-list-pane flex-1 flex flex-col min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="page-content py-2 border-b border-border-subtle flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle" />
          <input
            id="senders-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search senders or subjects… (/)"
            className="input pl-8"
          />
        </div>

        <SegmentSelect
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          options={[
            { value: 'count', label: 'Count' },
            { value: 'size', label: 'Size' },
            { value: 'recent', label: 'Recent' },
          ]}
        />
        <SegmentSelect
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'newsletters', label: 'Newsletters' },
            { value: 'unread', label: 'Unread' },
            { value: 'old', label: '> 6 mo' },
          ]}
        />

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-fg-muted animate-fade-in">
            <span>
              <span className="text-accent">{selected.size}</span> senders
            </span>
            <span>
              <span className="text-accent">{formatNumber(totalSelectedMessages)}</span> emails
            </span>
            <span>
              <span className="text-accent">{formatBytes(totalSelectedBytes)}</span> reclaimable
            </span>
            <button
              onClick={clearSelection}
              className="text-fg-subtle hover:text-fg underline-offset-2 hover:underline normal-case tracking-normal"
            >
              clear
            </button>
          </div>
        )}
      </div>

      {/* Header row */}
      <div className="page-content pt-2">
        <div className="data-grid-header grid grid-cols-12 px-3 h-7 panel-inset items-center gap-2 label-mono">
          <div className="col-span-1">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onChange={toggleAll}
              size="sm"
            />
          </div>
          <div className="col-span-5">Sender</div>
          <div className="col-span-1 text-right">Count</div>
          <div className="col-span-2 text-right">Size</div>
          <div className="col-span-2 text-right">Range</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto page-content pb-6 pt-1">
        {sync?.active && !messages.length ? (
          <SkeletonRows rows={10} />
        ) : sortedGroups.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
            No senders match filter
          </div>
        ) : (
          <div className="space-y-px zebra mt-1">
            {sortedGroups.map((g) => (
              <SenderRow
                key={g.email}
                group={g}
                selected={selected.has(g.email)}
                expanded={expanded === g.email}
                onToggleSelect={() => toggleSender(g.email)}
                onToggleExpand={() => toggleExpanded(g.email)}
                messages={filteredMessages.filter((m) => m.fromEmail === g.email)}
                accountId={activeId!}
              />
            ))}
          </div>
        )}
      </div>
        </div>

        <div className="senders-detail-pane">
          {expandedGroup ? (
            <div className="flex flex-col min-h-0 h-full">
              <div className="px-4 py-3 border-b border-border-subtle shrink-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  Sender detail
                </div>
                <div className="text-[13px] font-medium mt-1 truncate">{expandedGroup.name}</div>
                <div className="text-[10px] font-mono text-fg-muted truncate">{expandedGroup.email}</div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
                <div className="label-mono mb-2">
                  Recent subjects · showing {Math.min(expandedMessages.length, 25)} of{' '}
                  {expandedMessages.length}
                </div>
                <div className="space-y-0.5">
                  {expandedMessages
                    .slice()
                    .sort((a, b) => b.receivedAt - a.receivedAt)
                    .slice(0, 25)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[10px] font-mono text-fg-muted py-1 hover:text-fg border-b border-border-subtle/50 last:border-0"
                      >
                        <span className="text-fg-subtle shrink-0">
                          {new Date(m.receivedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: '2-digit',
                          })}
                        </span>
                        <span className={`flex-1 truncate ${m.isUnread ? 'text-fg' : ''}`}>
                          {m.subject}
                        </span>
                        <span className="text-fg-subtle shrink-0">{formatBytes(m.sizeBytes)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
              Select a sender to inspect messages
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal />
    </div>
  );
}

function SegmentSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex items-stretch border border-border bg-bg-elevated h-7">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors border-r border-border-subtle last:border-r-0 ${
            value === opt.value ? 'bg-accent/10 text-accent' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
