import { useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  FolderTree,
  Filter as FilterIcon,
  ShieldOff,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { IntelligenceProgress, Suggestion, SuggestionGroupType } from '@shared/types';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSuggestionsStore } from '@/stores/suggestionsStore';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/PageHeader';
import { SuggestionItem } from './SuggestionItem';
import { SummaryCard } from './SummaryCard';

const GROUP_META: Record<
  SuggestionGroupType,
  { label: string; Icon: typeof Trash2; tone: string }
> = {
  cleanup: { label: 'Cleanup', Icon: Trash2, tone: 'text-danger' },
  organize: { label: 'Organize', Icon: FolderTree, tone: 'text-accent' },
  rules: { label: 'Rules', Icon: FilterIcon, tone: 'text-info' },
  security: { label: 'Security', Icon: ShieldOff, tone: 'text-warn' },
};

type TabId = 'all' | SuggestionGroupType;

const PAGE_SIZE = 9;

export function SuggestionFeed() {
  const activeId = useAccountsStore((s) => s.activeId);
  const data = useSuggestionsStore((s) => (activeId ? s.byAccount[activeId] : null));
  const filter = useSuggestionsStore((s) => s.filter);
  const setFilter = useSuggestionsStore((s) => s.setFilter);
  const loadSuggestions = useSuggestionsStore((s) => s.loadSuggestions);
  const rerun = useSuggestionsStore((s) => s.rerun);

  const [tab, setTab] = useState<TabId>('all');
  const [page, setPage] = useState(0);

  // Initial load + reload whenever the status filter changes.
  useEffect(() => {
    if (!activeId) return;
    void loadSuggestions(activeId);
  }, [activeId, filter.status, loadSuggestions]);

  // Auto-refresh once intelligence completes.
  useEffect(() => {
    if (!activeId) return;
    const off = window.mailvault.onIntelligenceComplete((p) => {
      if (p.accountId === activeId) void loadSuggestions(activeId);
    });
    return off;
  }, [activeId, loadSuggestions]);

  // Reset to page 0 whenever the tab or status filter changes.
  useEffect(() => {
    setPage(0);
  }, [tab, filter.status, filter.onlyHighPriority, filter.sort]);

  // Apply user filters first (priority + sort).
  const sortedFiltered = useMemo(() => {
    if (!data) return [] as Suggestion[];
    let list = data.suggestions.slice();
    if (filter.onlyHighPriority) list = list.filter((s) => s.priority <= 2);
    if (filter.sort === 'storage') list.sort((a, b) => b.sizeBytes - a.sizeBytes);
    else if (filter.sort === 'count') list.sort((a, b) => b.affectedCount - a.affectedCount);
    else list.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
    return list;
  }, [data, filter.onlyHighPriority, filter.sort]);

  const groupCounts = useMemo(() => {
    const counts: Record<SuggestionGroupType, number> = {
      cleanup: 0,
      organize: 0,
      rules: 0,
      security: 0,
    };
    for (const s of sortedFiltered) counts[s.groupType] += 1;
    return counts;
  }, [sortedFiltered]);

  const tabFiltered = useMemo(
    () => (tab === 'all' ? sortedFiltered : sortedFiltered.filter((s) => s.groupType === tab)),
    [sortedFiltered, tab]
  );

  // Top picks: 3 highest-priority items across the *full* result set,
  // not the currently-selected tab. Skip applied/dismissed for hero.
  const topPicks = useMemo(() => {
    const eligible = sortedFiltered.filter((s) => !s.appliedAt && !s.dismissedAt);
    return eligible.slice(0, 3);
  }, [sortedFiltered]);

  const totalSize = sortedFiltered.reduce((sum, s) => sum + s.sizeBytes, 0);
  const totalAffected = sortedFiltered.reduce((sum, s) => sum + s.affectedCount, 0);
  const isAnalyzing = !!data?.progress && !data.progress.done;

  // Pagination math.
  const pageCount = Math.max(1, Math.ceil(tabFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = tabFiltered.slice(pageStart, pageStart + PAGE_SIZE);

  if (!activeId) {
    return (
      <div className="p-8 text-center text-fg-muted">
        Sign in to a mailbox to see suggestions.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Suggestions"
        subtitle="Things MailVault recommends doing right now."
        badge="INTELLIGENCE"
        actions={
          <Button
            size="sm"
            variant="secondary"
            iconLeft={<RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />}
            onClick={() => activeId && void rerun(activeId)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing…' : 'Re-analyze'}
          </Button>
        }
      />

      {/* Scrollable region */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="page-content space-y-5">
          {isAnalyzing && data?.progress && <AnalyzingBar progress={data.progress} />}

          <SummaryCard
            totalCount={sortedFiltered.length}
            totalAffected={totalAffected}
            totalSize={totalSize}
          />

          {/* Top picks */}
          {topPicks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <h3 className="label-mono">Top picks</h3>
                <span className="text-[10px] text-fg-subtle font-mono">
                  · highest impact, do these first
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {topPicks.map((s) => (
                  <SuggestionItem
                    key={s.id}
                    suggestion={s}
                    accountId={activeId}
                    variant="hero"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Tabs row */}
          <section>
            <div className="flex items-center gap-1 border-b border-border overflow-x-auto -mx-1 px-1">
              <TabButton
                id="all"
                active={tab === 'all'}
                onClick={() => setTab('all')}
                Icon={Layers}
                label="All"
                count={sortedFiltered.length}
                tone="text-fg"
              />
              {(['cleanup', 'organize', 'rules', 'security'] as SuggestionGroupType[]).map((gt) => {
                const meta = GROUP_META[gt];
                return (
                  <TabButton
                    key={gt}
                    id={gt}
                    active={tab === gt}
                    onClick={() => setTab(gt)}
                    Icon={meta.Icon}
                    label={meta.label}
                    count={groupCounts[gt]}
                    tone={meta.tone}
                  />
                );
              })}
              <div className="flex-1" />
              <ToolbarFilters />
            </div>
          </section>

          {/* Empty state */}
          {sortedFiltered.length === 0 && !isAnalyzing && (
            <div className="panel p-8 text-center border-dashed">
              <CheckCircle2 className="w-6 h-6 text-ok mx-auto mb-2" />
              <div className="font-medium">Nothing to act on right now.</div>
              <div className="text-sm text-fg-muted mt-1">
                {filter.status === 'active'
                  ? 'Run a sync — MailVault will surface suggestions automatically.'
                  : 'No suggestions in this view.'}
              </div>
            </div>
          )}

          {tabFiltered.length === 0 && sortedFiltered.length > 0 && (
            <div className="panel p-6 text-center text-sm text-fg-muted border-dashed">
              No <strong className="text-fg">{tab}</strong> suggestions at the moment. Try
              another tab.
            </div>
          )}

          {/* Paginated grid */}
          {pageItems.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {pageItems.map((s) => (
                  <SuggestionItem
                    key={s.id}
                    suggestion={s}
                    accountId={activeId}
                    variant="card"
                  />
                ))}
              </div>
              {pageCount > 1 && (
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onChange={setPage}
                  total={tabFiltered.length}
                  rangeStart={pageStart + 1}
                  rangeEnd={Math.min(pageStart + PAGE_SIZE, tabFiltered.length)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  function setFilterStatus(status: typeof filter.status) {
    setFilter({ status });
  }

  function ToolbarFilters() {
    const tabs: Array<{ id: typeof filter.status; label: string }> = [
      { id: 'active', label: 'Active' },
      { id: 'applied', label: 'Applied' },
      { id: 'dismissed', label: 'Dismissed' },
    ];
    return (
      <div className="flex items-center gap-2 pl-3 ml-auto">
        <div className="flex bg-bg-elevated border border-border-subtle p-0.5 text-[11px]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterStatus(t.id)}
              className={`px-2 py-0.5 transition-colors ${
                filter.status === t.id
                  ? 'bg-bg-hover text-fg'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="hidden md:flex items-center gap-1.5 text-fg-muted cursor-pointer text-[11px]">
          <input
            type="checkbox"
            checked={filter.onlyHighPriority}
            onChange={(e) => setFilter({ onlyHighPriority: e.target.checked })}
          />
          High priority only
        </label>
        <select
          value={filter.sort}
          onChange={(e) => setFilter({ sort: e.target.value as typeof filter.sort })}
          className="bg-bg-elevated border border-border px-2 py-0.5 text-fg-muted text-[11px]"
          title="Sort"
        >
          <option value="priority">By priority</option>
          <option value="storage">By storage impact</option>
          <option value="count">By email count</option>
        </select>
      </div>
    );
  }
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
  count,
  tone,
}: {
  id: TabId;
  active: boolean;
  onClick: () => void;
  Icon: typeof Trash2;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative px-3 py-2 inline-flex items-center gap-2 text-[12px] transition-colors whitespace-nowrap ${
        active ? 'text-fg' : 'text-fg-muted hover:text-fg'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${active ? tone : ''}`} />
      <span>{label}</span>
      <span
        className={`text-[10px] font-mono px-1.5 py-px border ${
          active
            ? 'border-border-strong bg-bg-elevated text-fg'
            : 'border-border bg-bg-elevated/40 text-fg-muted'
        }`}
      >
        {count}
      </span>
      {active && <span className="absolute bottom-0 left-0 right-0 h-px bg-accent" />}
    </button>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
  total,
  rangeStart,
  rangeEnd,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}) {
  return (
    <div className="flex items-center justify-between text-[11px] text-fg-muted font-mono pt-1">
      <div>
        Showing <span className="text-fg">{rangeStart}</span>–
        <span className="text-fg">{rangeEnd}</span> of{' '}
        <span className="text-fg">{total.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="p-1 border border-border hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2">
          <span className="text-fg">{page + 1}</span> / {pageCount}
        </span>
        <button
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          className="p-1 border border-border hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AnalyzingBar({ progress }: { progress: IntelligenceProgress }) {
  const pct = (progress.analyzersCompleted / progress.totalAnalyzers) * 100;
  return (
    <div className="panel p-3 border-accent/30">
      <div className="text-xs text-fg-muted mb-1">
        {progress.currentAnalyzer ? `Running ${progress.currentAnalyzer}…` : 'Starting analysis…'}
      </div>
      <div className="h-1 bg-bg-hover overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-fg-muted mt-1 font-mono">
        {progress.analyzersCompleted} of {progress.totalAnalyzers} ·{' '}
        {progress.suggestionsCreated} suggestions
      </div>
    </div>
  );
}
