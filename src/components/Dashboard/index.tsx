import { useMemo, useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useUIStore } from '@/stores/uiStore';
import { usePrefsStore } from '@/stores/prefsStore';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { useDashboard, markDashboardAnimated, shouldAnimateDashboard } from '@/hooks/useDashboard';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { AccountSwitcher } from './AccountSwitcher';
import { KPIStrip } from './KPIStrip';
import { DashboardSkeleton } from './DashboardCard';
import {
  StorageHistoryCard,
  NewEmailsCategoryCard,
  LiveSyncCard,
  SpaceHogsCard,
  CategoryDonutCard,
  ActivityFeedCard,
  FolderSummaryCard,
  CleanupPotentialCard,
  SyncTimelineCard,
  QuickActionsCard,
} from './DashboardCards';
import './dashboard.css';

export function Dashboard() {
  const accounts = useAccountsStore((s) => s.accounts);
  const activeId = useAccountsStore((s) => s.activeId);
  const account = accounts.find((a) => a.id === activeId);
  const setRoute = useUIStore((s) => s.setRoute);
  const setSendersSearch = useUIStore((s) => s.setSendersSearch);
  const setSendersFilter = useUIStore((s) => s.setSendersFilter);
  const setApprovalOpen = useLiveSyncStore((s) => s.setApprovalOpen);
  const checkNow = useLiveSyncStore((s) => s.checkNow);
  const pauseSync = useLiveSyncStore((s) => s.pauseSync);
  const undoAction = useLiveSyncStore((s) => s.undoAction);
  const showGreeting = usePrefsStore((s) => s.prefs.panels.welcomeGreeting);

  const [scope, setScope] = useState<string | 'all'>(activeId ?? 'all');
  const { data, loading, refresh } = useDashboard(scope);
  const [animateKpi] = useState(shouldAnimateDashboard);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (data && animateKpi) {
      markDashboardAnimated();
      if (data.kpis.cleanedCount > 0) {
        const key = `mv-confetti-${data.kpis.cleanedCount}`;
        if (!sessionStorage.getItem(key)) {
          setShowConfetti(true);
          sessionStorage.setItem(key, '1');
          const t = setTimeout(() => setShowConfetti(false), 1200);
          return () => clearTimeout(t);
        }
      }
    }
  }, [data, animateKpi]);

  const liveMap = useMemo(() => {
    const m = new Map<string, 'active' | 'paused' | 'error'>();
    for (const a of data?.liveAccounts ?? []) {
      m.set(
        a.accountId,
        a.status === 'active' || a.status === 'polling'
          ? 'active'
          : a.status === 'error' || a.status === 'offline'
            ? 'error'
            : 'paused'
      );
    }
    return m;
  }, [data?.liveAccounts]);

  const nav = useMemo(
    () => ({
      goSenders: (opts?: { search?: string; filter?: 'newsletters' | 'old' }) => {
        if (opts?.search) setSendersSearch(opts.search);
        if (opts?.filter) setSendersFilter(opts.filter);
        setRoute('senders');
      },
      goAnalyze: () => setRoute('analyze'),
      goSuggestions: () => setRoute('suggestions'),
      goRules: () => setRoute('rules'),
      goNotifications: () => setRoute('notifications'),
      onPending: () => setApprovalOpen(true),
      checkNow: () => void checkNow(),
      pauseLive: () => void pauseSync(),
    }),
    [setRoute, setSendersSearch, setSendersFilter, setApprovalOpen, checkNow, pauseSync]
  );

  if (!accounts.length) return null;

  const subtitle =
    scope === 'all'
      ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} · command center`
      : account?.email ?? '';

  return (
    <div className="route-dashboard dashboard-page flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title={showGreeting ? 'Command center' : 'Dashboard'}
        subtitle={subtitle}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <AccountSwitcher
        accounts={accounts}
        scope={scope}
        liveStatus={liveMap}
        onChange={setScope}
      />

      {loading && !data ? (
        <DashboardLoadingGrid />
      ) : !data?.hasSyncData ? (
        <PreSyncState onAnalyze={nav.goAnalyze} />
      ) : (
        <>
          <KPIStrip
            kpis={data!.kpis}
            animate={animateKpi}
            showConfetti={showConfetti}
            onPendingClick={nav.onPending}
          />
          <div className="dashboard-grid">
            <StorageHistoryCard data={data!} animateBars={animateKpi} />
            <LiveSyncCard data={data!} nav={nav} />
            <NewEmailsCategoryCard
              data={data!}
              onCategory={() => nav.goSenders()}
            />
            <SpaceHogsCard
              data={data!}
              onSender={(email) => nav.goSenders({ search: email })}
              onDelete={(email) => {
                setSendersSearch(email);
                setRoute('senders');
              }}
            />
            <CategoryDonutCard data={data!} onCategory={() => nav.goSenders()} />
            <ActivityFeedCard
              data={data!}
              onUndo={(id) => void undoAction(id)}
              onShowAll={nav.goNotifications}
            />
            <FolderSummaryCard
              data={data!}
              onFolder={() => setRoute('mailbox')}
              onJunkWarning={nav.onPending}
            />
            <CleanupPotentialCard
              data={data!}
              onStart={() => nav.goSenders({ filter: 'old' })}
            />
            <SyncTimelineCard data={data!} onSync={nav.goAnalyze} />
            <QuickActionsCard data={data!} nav={nav} />
          </div>
        </>
      )}
    </div>
  );
}

function DashboardLoadingGrid() {
  return (
    <>
      <div className="dashboard-kpi-strip m-3 mb-0 p-4">
        <div className="dashboard-shimmer h-12 w-full" />
      </div>
      <div className="dashboard-grid">
        <DashboardSkeleton className="dashboard-col-8" />
        <DashboardSkeleton className="dashboard-col-4" />
        <DashboardSkeleton className="dashboard-col-8" />
        <DashboardSkeleton className="dashboard-col-4" />
        <DashboardSkeleton className="dashboard-col-4" />
        <DashboardSkeleton className="dashboard-col-8" />
        <DashboardSkeleton className="dashboard-col-4" />
        <DashboardSkeleton className="dashboard-col-4" />
        <DashboardSkeleton className="dashboard-col-4" />
      </div>
    </>
  );
}

function PreSyncState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="panel p-10 max-w-md text-center">
        <Activity className="w-6 h-6 text-accent mx-auto mb-3" />
        <h2 className="text-[16px] font-semibold tracking-tight">Ready to analyze</h2>
        <p className="text-[12px] text-fg-muted mt-2">
          Your account is connected. Run your first analysis to populate this command center with
          storage insights, cleanup potential, and live sync stats.
        </p>
        <Button variant="primary" className="mt-5" onClick={onAnalyze}>
          Analyze my inbox →
        </Button>
      </div>
    </div>
  );
}
