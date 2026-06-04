import type { DashboardSnapshot, DashboardCategorySlice } from '../../shared/types.js';
import { SyncDb, dbPathForAccount } from './syncDb.js';
import {
  listActionLogs,
  listLiveSyncStates,
  countPendingApprovals,
  getRecentActivity,
} from './liveSyncDb.js';
import { storage } from '../store.js';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  shopping: { label: 'Shopping', color: '#f59e0b' },
  finance: { label: 'Finance', color: '#22c55e' },
  travel: { label: 'Travel', color: '#3b82f6' },
  dev: { label: 'Dev & Work', color: '#14b8a6' },
  social: { label: 'Social', color: '#ec4899' },
  newsletter: { label: 'Newsletters', color: '#a78bfa' },
  transactional: { label: 'Receipts', color: '#94a3b8' },
  subscriptions: { label: 'Subscriptions', color: '#8b5cf6' },
  food: { label: 'Food', color: '#fb7185' },
  health: { label: 'Health', color: '#4ade80' },
  government: { label: 'Official', color: '#6b7280' },
  education: { label: 'Education', color: '#60a5fa' },
  entertainment: { label: 'Entertainment', color: '#fbbf24' },
  utilities: { label: 'Bills', color: '#2dd4bf' },
  other: { label: 'Other', color: '#64748b' },
};

function catMeta(category: string | null): { label: string; color: string } {
  const key = (category ?? 'other').toLowerCase();
  return (
    CATEGORY_LABELS[key] ?? {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      color: '#64748b',
    }
  );
}

function toSlices(
  rows: Array<{ category: string; count: number; bytes: number }>
): DashboardCategorySlice[] {
  return rows
    .map((r) => {
      const meta = catMeta(r.category);
      return {
        category: r.category,
        label: meta.label,
        color: meta.color,
        count: r.count,
        bytes: r.bytes,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function mergeSlices(a: DashboardCategorySlice[], b: DashboardCategorySlice[]) {
  const map = new Map<string, DashboardCategorySlice>();
  for (const s of [...a, ...b]) {
    const cur = map.get(s.category);
    if (cur) {
      cur.count += s.count;
      cur.bytes += s.bytes;
    } else {
      map.set(s.category, { ...s });
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function emptySnapshot(scope: 'all' | string): DashboardSnapshot {
  return {
    scope,
    hasSyncData: false,
    kpis: {
      totalEmails: 0,
      weekDelta: 0,
      storageBytes: 0,
      storageWeekDeltaBytes: 0,
      cleanedCount: 0,
      cleanedBytes: 0,
      newEmails: 0,
      newEmailsLabel: 'since last sync',
      pendingActions: countPendingApprovals(),
      liveSyncActive: listLiveSyncStates().some((s) => s.status === 'active'),
    },
    storageHistory: [],
    storageHistoryTotal: { emails: 0, bytes: 0 },
    newByCategory: [],
    categoryBreakdown: [],
    spaceHogs: [],
    spaceHogsFooter: { topBytes: 0, pctOfTotal: 0 },
    activity: [],
    folders: [],
    cleanup: {
      deletableCount: 0,
      deletableBytes: 0,
      deletablePct: 0,
      newsletterCount: 0,
      folderSuggestions: 0,
    },
    syncTimeline: [],
    quickActions: {
      newsletterCount: 0,
      organizeCount: 0,
      lastSyncAt: null,
      ruleSuggestions: 0,
    },
    liveAccounts: [],
    junkPendingCount: 0,
  };
}

export function getDashboardSnapshot(scope: string | 'all'): DashboardSnapshot {
  const accountIds = resolveAccountIds(scope);
  if (accountIds.length === 0) return emptySnapshot(scope);

  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const twoWeeksAgo = now - 14 * 86400_000;

  let totalEmails = 0;
  let storageBytes = 0;
  let weekCount = 0;
  let prevWeekCount = 0;
  let hasSyncData = false;
  let lastSyncAt: number | null = null;
  let sessionStart = now - 86400_000;

  let categoryBreakdown: DashboardCategorySlice[] = [];
  let newByCategory: DashboardCategorySlice[] = [];
  const allSenders: Array<{
    email: string;
    name: string;
    count: number;
    bytes: number;
    category: string | null;
  }> = [];

  let deletableCount = 0;
  let deletableBytes = 0;
  let newsletterSenders = 0;
  let folderSuggestions = 0;
  let organizeCount = 0;
  let ruleSuggestions = 0;
  let junkPending = 0;

  const folderMap = new Map<
    string,
    { folderId: string; count: number; newCount: number; isJunk: boolean }
  >();

  for (const accountId of accountIds) {
    let db: SyncDb | null = null;
    try {
      db = new SyncDb(dbPathForAccount(accountId));
    } catch {
      continue;
    }
    try {
      const totals = db.getEmailTotals(accountId);
      if (totals.count > 0) hasSyncData = true;
      totalEmails += totals.count;
      storageBytes += totals.bytes;

      weekCount += db.countEmailsReceivedSince(accountId, weekAgo);
      prevWeekCount += db.countEmailsReceivedBetween(accountId, twoWeeksAgo, weekAgo);

      const syncState = db.getSyncState(accountId);
      if (syncState?.completedAt) {
        lastSyncAt = Math.max(lastSyncAt ?? 0, syncState.completedAt);
      }
      if (syncState?.startedAt) {
        sessionStart = Math.min(sessionStart, syncState.startedAt);
      }

      const sinceSync = syncState?.startedAt ?? weekAgo;
      categoryBreakdown = mergeSlices(categoryBreakdown, toSlices(db.emailsByCategory(accountId)));
      newByCategory = mergeSlices(
        newByCategory,
        toSlices(db.emailsByCategorySince(accountId, sinceSync))
      );

      const del = db.countDeletableSenders(accountId);
      deletableCount += del.count;
      deletableBytes += del.bytes;
      newsletterSenders += db.countNewsletterSenders(accountId);
      folderSuggestions += db.countActiveSuggestions(accountId, 'CREATE_FOLDER');
      organizeCount += db.countUnsortedSenders(accountId);
      ruleSuggestions += db.countActiveSuggestions(accountId, 'CREATE_RULE');
      junkPending += db.countActiveSuggestions(accountId, 'MOVE_FROM_JUNK');

      for (const g of db.listSenderGroups(accountId)) {
        allSenders.push({
          email: g.id,
          name: g.senderName || g.id,
          count: g.emailCount,
          bytes: g.totalSizeBytes,
          category: g.category,
        });
      }

      for (const f of db.emailsByFolder(accountId, sinceSync)) {
        const fid = f.folderId || 'INBOX';
        const isJunk = /junk|spam/i.test(fid);
        const cur = folderMap.get(`${accountId}:${fid}`) ?? {
          folderId: fid,
          count: 0,
          newCount: 0,
          isJunk,
        };
        cur.count += f.count;
        cur.newCount += f.newCount;
        folderMap.set(`${accountId}:${fid}`, cur);
      }
    } finally {
      db.close();
    }
  }

  const weekDelta = weekCount - prevWeekCount;
  const storageWeekDeltaBytes = 0; // Would need historical snapshots; show 0 for now

  const deleteTypes = new Set(['trash', 'delete', 'batch_trash', 'permanent_delete']);
  const logs = listActionLogs({
    accountId: scope === 'all' ? undefined : scope,
    limit: 200,
  });

  let cleanedCount = 0;
  let cleanedBytes = 0;
  const historyByDay = new Map<
    string,
    { timestamp: number; emails: number; bytes: number; topSender: string | null }
  >();

  for (const log of logs) {
    if (!deleteTypes.has(log.actionType) || log.undoneAt) continue;
    let bytes = 0;
    try {
      const after = JSON.parse(log.afterState) as { sizeBytes?: number };
      bytes = after.sizeBytes ?? 0;
    } catch {
      bytes = 0;
    }
    if (log.appliedAt >= sessionStart) {
      cleanedCount += 1;
      cleanedBytes += bytes;
    }
    const day = new Date(log.appliedAt).toISOString().slice(0, 10);
    const cur = historyByDay.get(day) ?? {
      timestamp: log.appliedAt,
      emails: 0,
      bytes: 0,
      topSender: null,
    };
    cur.emails += 1;
    cur.bytes += bytes;
    historyByDay.set(day, cur);
  }

  const storageHistory = [...historyByDay.entries()]
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 10)
    .reverse()
    .map(([date, v]) => ({
      date: formatDate(v.timestamp),
      timestamp: v.timestamp,
      emailsDeleted: v.emails,
      bytesFreed: v.bytes,
      topSender: v.topSender,
    }));

  let historyTotalEmails = 0;
  let historyTotalBytes = 0;
  for (const log of logs) {
    if (!deleteTypes.has(log.actionType) || log.undoneAt) continue;
    historyTotalEmails += 1;
    try {
      const after = JSON.parse(log.afterState) as { sizeBytes?: number };
      historyTotalBytes += after.sizeBytes ?? 0;
    } catch {
      // ignore
    }
  }

  allSenders.sort((a, b) => b.bytes - a.bytes);
  const top8 = allSenders.slice(0, 8);
  const top8Bytes = top8.reduce((s, g) => s + g.bytes, 0);
  const spaceHogs = top8.map((g) => {
    const meta = catMeta(g.category);
    return {
      email: g.email,
      name: g.name,
      count: g.count,
      bytes: g.bytes,
      category: g.category,
      categoryColor: meta.color,
      pctOfTop: top8Bytes > 0 ? Math.round((g.bytes / top8Bytes) * 100) : 0,
    };
  });

  let newEmails = 0;
  let newLabel = 'since last sync';
  if (scope === 'all') {
    for (const id of accountIds) {
      newEmails += getRecentActivity(id);
    }
    newLabel = 'from live sync';
  } else {
    newEmails = getRecentActivity(scope);
    newLabel = 'from live sync';
  }
  if (newEmails === 0) {
    newEmails = newByCategory.reduce((s, c) => s + c.count, 0);
    newLabel = 'since last sync';
  }

  const liveStates = listLiveSyncStates();
  const accounts = storage.listAccounts();
  const liveAccounts = accounts.map((a) => {
    const st = liveStates.find((s) => s.accountId === a.id);
    return {
      accountId: a.id,
      email: a.email,
      provider: a.provider,
      status: st?.status ?? 'paused',
      lastPollAt: st?.lastPollAt ?? null,
      nextPollAt: st?.nextPollAt ?? null,
      errorMessage: st?.errorMessage ?? null,
    };
  });

  const activity = logs.slice(0, 15).map((log) => ({
    id: log.id,
    accountId: log.accountId,
    actionType: log.actionType,
    summary: log.summary || log.actionType,
    appliedAt: log.appliedAt,
    undoableUntil: log.undoableUntil,
    undoneAt: log.undoneAt,
  }));

  const folders = [...folderMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((f) => ({
      folderId: f.folderId,
      name: folderDisplayName(f.folderId),
      count: f.count,
      newSinceSync: f.newCount,
      isJunk: f.isJunk,
      isTrash: /trash|deleted/i.test(f.folderId),
      isInbox: /^inbox$/i.test(f.folderId) || f.folderId === 'INBOX',
      junkWarning: f.isJunk && junkPending > 0,
    }));

  const syncTimeline: DashboardSnapshot['syncTimeline'] = [];
  for (const accountId of accountIds) {
    const db = new SyncDb(dbPathForAccount(accountId));
    try {
      const st = db.getSyncState(accountId);
      if (st?.completedAt) {
        syncTimeline.push({
          id: `${accountId}-sync`,
          accountId,
          kind: 'full',
          label: 'Full sync',
          at: st.completedAt,
          detail: `${st.emailsFetched.toLocaleString()} emails indexed`,
        });
      }
    } finally {
      db.close();
    }
  }
  for (const log of logs.slice(0, 5)) {
    if (log.actionType === 'move_folder' || log.actionType === 'junk_rescue') {
      syncTimeline.push({
        id: log.id,
        accountId: log.accountId,
        kind: 'live',
        label: 'Live update',
        at: log.appliedAt,
        detail: log.summary,
      });
    }
  }
  syncTimeline.sort((a, b) => b.at - a.at);
  const timeline = syncTimeline.slice(0, 7);

  const deletablePct =
    totalEmails > 0 ? Math.round((deletableCount / totalEmails) * 100) : 0;

  return {
    scope,
    hasSyncData,
    kpis: {
      totalEmails,
      weekDelta,
      storageBytes,
      storageWeekDeltaBytes,
      cleanedCount,
      cleanedBytes,
      newEmails,
      newEmailsLabel: newLabel,
      pendingActions: countPendingApprovals(),
      liveSyncActive: liveStates.some((s) => s.status === 'active'),
    },
    storageHistory,
    storageHistoryTotal: { emails: historyTotalEmails, bytes: historyTotalBytes },
    newByCategory,
    categoryBreakdown,
    spaceHogs,
    spaceHogsFooter: {
      topBytes: top8Bytes,
      pctOfTotal: storageBytes > 0 ? Math.round((top8Bytes / storageBytes) * 100) : 0,
    },
    activity,
    folders,
    cleanup: {
      deletableCount,
      deletableBytes,
      deletablePct,
      newsletterCount: newsletterSenders,
      folderSuggestions,
    },
    syncTimeline: timeline,
    quickActions: {
      newsletterCount: newsletterSenders,
      organizeCount,
      lastSyncAt,
      ruleSuggestions,
    },
    liveAccounts,
    junkPendingCount: junkPending,
  };
}

function resolveAccountIds(scope: string | 'all'): string[] {
  const accounts = storage.listAccounts();
  if (scope === 'all') return accounts.map((a) => a.id);
  return accounts.some((a) => a.id === scope) ? [scope] : [];
}

function folderDisplayName(folderId: string): string {
  if (!folderId || folderId === 'INBOX') return 'Inbox';
  if (/junk|spam/i.test(folderId)) return 'Junk';
  if (/trash|deleted/i.test(folderId)) return 'Trash';
  const parts = folderId.split('/');
  return parts[parts.length - 1] ?? folderId;
}
