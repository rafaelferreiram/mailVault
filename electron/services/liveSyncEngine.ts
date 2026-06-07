// Live Sync Engine — background polling + analysis + notifications.
//
// Runs in the main process (uses GmailClient/GraphClient + electron-store).
// Toggle via preferences.liveSync.enabled — when off, all timers stop.

import {
  IPC,
  type AccountProfile,
  type EmailMessage,
  type LiveSyncStateRow,
  type LiveSyncStatusPayload,
  type NotificationRecord,
  type PendingActionRecord,
} from '../../shared/types.js';
import { storage } from '../store.js';
import { broadcast } from './broadcast.js';
import { forceRefresh, getAccessToken } from './tokenManager.js';
import { GmailClient } from './gmail.js';
import { GraphClient } from './microsoft.js';
import {
  bumpRecentActivity,
  countPendingApprovals,
  getRecentActivity,
  getSeenIds,
  insertNotification,
  insertPendingAction,
  listLiveSyncStates,
  listNotifications,
  openLiveDb,
  purgeStalePending,
  setSeenIds,
  upsertLiveSyncState,
} from './liveSyncDb.js';
import { analyzeIncomingEmail } from './liveSync/incomingAnalyzer.js';
import { executeAutoAction, undoActionLog } from './liveSync/autoActionEngine.js';
import { openSyncDb } from './syncDb.js';

interface AccountLoop {
  accountId: string;
  timer: ReturnType<typeof setTimeout> | null;
  polling: boolean;
  paused: boolean;
  backoffUntil: number;
}

const loops = new Map<string, AccountLoop>();
let globalEnabled = true;
let windowFocused = true;
let started = false;

function clientFor(accountId: string) {
  if (accountId.startsWith('google:')) {
    return { kind: 'google' as const, gmail: new GmailClient(accountId) };
  }
  return { kind: 'microsoft' as const, graph: new GraphClient(accountId) };
}

function livePrefs() {
  return storage.getPreferences().liveSync;
}

function emitNotification(n: NotificationRecord) {
  broadcast(IPC.LiveNotification, n);
  emitBadge();
}

function emitPending(p: PendingActionRecord) {
  broadcast(IPC.LivePending, p);
  emitBadge();
}

function emitBadge() {
  broadcast(IPC.LiveBadge, { count: countPendingApprovals() });
}

function emitStatus(accountId?: string, status?: LiveSyncStateRow['status']) {
  if (accountId && status) {
    broadcast(IPC.LivePollStatus, { accountId, status, at: Date.now() });
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

function buildStatusPayload(): LiveSyncStatusPayload {
  const pendingBadgeCount = countPendingApprovals();
  const unread = openLiveDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM notifications
       WHERE read_at IS NULL AND dismissed_at IS NULL AND type IN ('NEW_EMAIL','AUTO_ACTION_APPLIED')`
    )
    .get() as { c: number };
  return {
    enabled: globalEnabled && livePrefs().enabled,
    windowFocused,
    accounts: listLiveSyncStates(),
    pendingBadgeCount,
    unreadDot: (unread.c ?? 0) > 0,
  };
}

function computeInterval(accountId: string): number {
  const p = livePrefs();
  if (!p.enabled || !globalEnabled) return 0;
  const base = windowFocused ? p.pollingIntervalActive : p.pollingIntervalBackground;
  if (!p.adaptivePolling) return base;
  const recent = getRecentActivity(accountId);
  if (recent > 5) return Math.min(base, 30);
  if (recent >= 1) return base;
  return Math.max(base, 120);
}

async function ensureToken(accountId: string): Promise<string | null> {
  try {
    return await getAccessToken(accountId);
  } catch {
    try {
      return await forceRefresh(accountId);
    } catch {
      const profile = storage.listAccounts().find((a) => a.id === accountId);
      upsertLiveSyncState({ accountId, status: 'error', errorMessage: 'auth_required' });
      const n = insertNotification({
        accountId,
        type: 'AUTH_REQUIRED',
        priority: 1,
        title: 'Re-authentication needed',
        body: `${profile?.email ?? accountId} session expired — click to reconnect`,
        iconType: 'auth',
        actionUrl: 'reauth',
        pendingId: null,
        emailId: null,
        emailFrom: null,
        emailSubject: null,
        readAt: null,
        dismissedAt: null,
        createdAt: Date.now(),
        accountEmail: profile?.email ?? accountId,
        accountAvatar: profile?.avatarUrl ?? null,
      });
      emitNotification(n);
      return null;
    }
  }
}

async function pollAccount(accountId: string, force = false) {
  const loop = loops.get(accountId);
  if (!loop || loop.paused || !globalEnabled || !livePrefs().enabled) return;
  if (loop.polling && !force) return;
  if (Date.now() < loop.backoffUntil && !force) return;

  loop.polling = true;
  upsertLiveSyncState({ accountId, status: 'polling' });
  emitStatus(accountId, 'polling');

  const profile = storage.listAccounts().find((a) => a.id === accountId);
  if (!profile || profile.needsReauth) {
    loop.polling = false;
    scheduleNext(accountId);
    return;
  }

  const token = await ensureToken(accountId);
  if (!token) {
    loop.polling = false;
    scheduleNext(accountId);
    return;
  }

  try {
    const newMessages = await fetchRecentMessages(accountId);
    const seen = getSeenIds(accountId);
    const fresh = newMessages.filter((m) => !seen.has(m.id));

    for (const id of newMessages.map((m) => m.id)) seen.add(id);
    setSeenIds(accountId, seen);

    if (fresh.length > 0) {
      bumpRecentActivity(accountId, fresh.length);
      await processNewMessages(accountId, profile, fresh);
    }

    const now = Date.now();
    const interval = computeInterval(accountId);
    upsertLiveSyncState({
      accountId,
      status: 'active',
      lastPollAt: now,
      nextPollAt: now + interval * 1000,
      pollInterval: interval,
      errorMessage: null,
    });
    loop.backoffUntil = 0;
  } catch (e) {
    const err = e as Error & { response?: { status?: number } };
    if (err.response?.status === 429) {
      loop.backoffUntil = Date.now() + 30_000;
      upsertLiveSyncState({
        accountId,
        status: 'paused',
        errorMessage: 'Rate limited — resuming in 30s',
      });
      insertNotification({
        accountId,
        type: 'SYNC_ERROR',
        priority: 2,
        title: 'Sync paused',
        body: `${profile!.email} — rate limited, retrying soon`,
        iconType: 'warning',
        actionUrl: null,
        pendingId: null,
        emailId: null,
        emailFrom: null,
        emailSubject: null,
        readAt: null,
        dismissedAt: null,
        createdAt: Date.now(),
        accountEmail: profile!.email,
        accountAvatar: profile!.avatarUrl ?? null,
      });
    } else {
      upsertLiveSyncState({ accountId, status: 'error', errorMessage: err.message });
    }
  } finally {
    loop.polling = false;
    emitStatus(accountId, 'active');
    scheduleNext(accountId);
  }
}

async function fetchRecentMessages(accountId: string): Promise<EmailMessage[]> {
  const client = clientFor(accountId);
  if (client.kind === 'google') {
    const ids = await client.gmail.listMessageIds({ maxMessages: 20, labelOrFolder: 'INBOX' });
    const spamIds = await client.gmail.listMessageIds({ maxMessages: 10, labelOrFolder: 'SPAM' });
    const allIds = [...new Set([...ids, ...spamIds])].slice(0, 25);
    return client.gmail.getMessagesBatch(allIds);
  }
  const inbox = await client.graph.listMessages({ maxMessages: 20, labelOrFolder: 'INBOX' });
  const junk = await client.graph.listMessages({ maxMessages: 10, labelOrFolder: 'junkemail' });
  const byId = new Map<string, EmailMessage>();
  for (const m of [...inbox, ...junk]) byId.set(m.id, m);
  return [...byId.values()];
}

async function processNewMessages(
  accountId: string,
  profile: AccountProfile,
  messages: EmailMessage[]
) {
  const rules = storage.getRules(accountId);
  const blocked = storage.getBlocked(accountId);
  const autoPrefs = livePrefs().autoActions;
  const knownInboxSenders = loadKnownInboxSenders(accountId);
  const folderCategories = loadFolderCategories(accountId);

  let infoCount = 0;
  const infoSenders: string[] = [];

  for (const msg of messages) {
    const decision = analyzeIncomingEmail(msg, {
      rules,
      blocked,
      autoPrefs,
      knownInboxSenders,
      folderCategories,
    });

    if (decision.kind === 'auto') {
      const client = clientFor(accountId);
      const log = await executeAutoAction(
        accountId,
        client,
        msg,
        decision.actionType,
        decision.payload,
        decision.label
      );
      emitNotification(
        insertNotification({
          accountId,
          type: 'AUTO_ACTION_APPLIED',
          priority: 3,
          title: decision.label,
          body: `${msg.fromEmail} — ${msg.subject}`.slice(0, 120),
          iconType: 'check',
          actionUrl: null,
          pendingId: null,
          emailId: msg.id,
          emailFrom: msg.fromEmail,
          emailSubject: msg.subject,
          readAt: null,
          dismissedAt: null,
          createdAt: Date.now(),
          accountEmail: profile.email,
          accountAvatar: profile.avatarUrl ?? null,
          actionLogId: log.id,
        })
      );
      broadcast(IPC.LiveAutoAction, { log });
    } else if (decision.kind === 'pending') {
      const pending = insertPendingAction({
        accountId,
        emailId: msg.id,
        emailSubject: msg.subject,
        emailFrom: msg.fromEmail,
        emailFromName: msg.fromName,
        emailReceived: msg.receivedAt,
        emailFolder: msg.folder ?? 'INBOX',
        triggerType: decision.trigger,
        actionType: decision.actionType,
        actionLabel: decision.label,
        actionPayload: decision.payload,
        priority: decision.priority,
        explanation: decision.explanation,
        confidence: decision.confidence,
        createdAt: Date.now(),
        accountEmail: profile.email,
      });
      emitNotification(
        insertNotification({
          accountId,
          type: decision.trigger === 'junk_rescue' ? 'JUNK_RESCUE' : 'APPROVAL_NEEDED',
          priority: decision.priority,
          title: decision.label,
          body: `${msg.fromEmail} — ${msg.subject}`.slice(0, 120),
          iconType: 'warning',
          actionUrl: 'approval',
          pendingId: pending.id,
          emailId: msg.id,
          emailFrom: msg.fromEmail,
          emailSubject: msg.subject,
          readAt: null,
          dismissedAt: null,
          createdAt: Date.now(),
          accountEmail: profile.email,
          accountAvatar: profile.avatarUrl ?? null,
        })
      );
      emitPending(pending);
    } else {
      infoCount += 1;
      if (infoSenders.length < 3) infoSenders.push(msg.fromName || msg.fromEmail.split('@')[0]);
    }
  }

  if (infoCount > 0 && livePrefs().notifications.showNewEmailBadge) {
    emitNotification(
      insertNotification({
        accountId,
        type: 'NEW_EMAIL',
        priority: 4,
        title: `${infoCount} new email${infoCount === 1 ? '' : 's'}`,
        body: infoSenders.length ? `From: ${infoSenders.join(', ')}` : 'New messages arrived',
        iconType: 'email',
        actionUrl: 'senders',
        pendingId: null,
        emailId: null,
        emailFrom: null,
        emailSubject: null,
        readAt: null,
        dismissedAt: null,
        createdAt: Date.now(),
        accountEmail: profile.email,
        accountAvatar: profile.avatarUrl ?? null,
      })
    );
  }
}

function loadKnownInboxSenders(accountId: string): Set<string> {
  const out = new Set<string>();
  try {
    const db = openSyncDb(accountId);
    for (const e of db.listEmailsForAnalyzer(accountId, 'inbox').slice(0, 500)) {
      out.add(e.senderEmail.toLowerCase());
    }
    db.close();
  } catch {
    // ignore
  }
  return out;
}

function loadFolderCategories(accountId: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const db = openSyncDb(accountId);
    for (const g of db.listSenderGroups(accountId)) {
      if (g.suggestedFolder) {
        const domain = g.id.includes('@') ? g.id.split('@')[1] : g.id;
        out.set(domain.toLowerCase(), g.suggestedFolder);
      }
    }
    db.close();
  } catch {
    // ignore
  }
  return out;
}

function scheduleNext(accountId: string) {
  const loop = loops.get(accountId);
  if (!loop || loop.paused || !globalEnabled || !livePrefs().enabled) return;
  if (loop.timer) clearTimeout(loop.timer);
  const intervalSec = computeInterval(accountId);
  if (intervalSec <= 0) return;
  loop.timer = setTimeout(() => void pollAccount(accountId), intervalSec * 1000);
}

function startAccountLoop(account: AccountProfile) {
  if (loops.has(account.id)) return;
  upsertLiveSyncState({
    accountId: account.id,
    status: 'active',
    pollInterval: computeInterval(account.id),
  });
  loops.set(account.id, {
    accountId: account.id,
    timer: null,
    polling: false,
    paused: false,
    backoffUntil: 0,
  });
  void (async () => {
    try {
      const { ensureAccountRoutingRules } = await import('./routingRules.js');
      await ensureAccountRoutingRules(account.id, account.email, clientFor(account.id));
    } catch {
      // Routing presets are optional.
    }
  })();
  void pollAccount(account.id, true);
}

function stopAccountLoop(accountId: string) {
  const loop = loops.get(accountId);
  if (loop?.timer) clearTimeout(loop.timer);
  loops.delete(accountId);
  upsertLiveSyncState({ accountId, status: 'paused' });
}

export function initLiveSyncEngine() {
  if (started) return;
  started = true;
  openLiveDb();
  purgeStalePending();
  globalEnabled = livePrefs().enabled;
}

export function startLiveSyncForAccounts(accounts: AccountProfile[]) {
  initLiveSyncEngine();
  if (!globalEnabled || !livePrefs().enabled) return;
  for (const a of accounts) {
    if (!a.needsReauth) startAccountLoop(a);
  }
  emitBadge();
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function stopLiveSync() {
  globalEnabled = false;
  for (const id of [...loops.keys()]) stopAccountLoop(id);
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function setLiveSyncEnabled(enabled: boolean) {
  globalEnabled = enabled;
  storage.setPreferences({ liveSync: { ...livePrefs(), enabled } });
  if (enabled) {
    startLiveSyncForAccounts(storage.listAccounts());
  } else {
    for (const id of [...loops.keys()]) stopAccountLoop(id);
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function pauseLiveSync() {
  for (const loop of loops.values()) {
    loop.paused = true;
    if (loop.timer) clearTimeout(loop.timer);
    upsertLiveSyncState({ accountId: loop.accountId, status: 'paused' });
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function resumeLiveSync() {
  if (!livePrefs().enabled) return;
  globalEnabled = true;
  for (const [accountId, loop] of loops) {
    loop.paused = false;
    scheduleNext(accountId);
  }
  if (loops.size === 0) {
    startLiveSyncForAccounts(storage.listAccounts());
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function checkNowAll() {
  for (const id of loops.keys()) void pollAccount(id, true);
}

export function isWindowFocused(): boolean {
  return windowFocused;
}

export function onWindowFocus(focused: boolean) {
  windowFocused = focused;
  if (focused && globalEnabled && livePrefs().enabled) {
    for (const id of loops.keys()) scheduleNext(id);
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}

export function onAccountLinked(account: AccountProfile) {
  if (globalEnabled && livePrefs().enabled && !account.needsReauth) {
    startAccountLoop(account);
  }
}

export function onAccountRemoved(accountId: string) {
  stopAccountLoop(accountId);
}

export function getLiveSyncStatus(): LiveSyncStatusPayload {
  return buildStatusPayload();
}

export function listAllNotifications(limit = 100) {
  return listNotifications({ limit });
}

export async function resolvePending(
  pendingId: string,
  resolution: 'approved' | 'rejected' | 'dismissed'
) {
  const { getPendingAction, resolvePendingAction } = await import('./liveSyncDb.js');
  const pending = getPendingAction(pendingId);
  if (!pending) return { ok: false };
  resolvePendingAction(pendingId, resolution);
  if (resolution === 'approved') {
    const client = clientFor(pending.accountId);
    const msg: EmailMessage = {
      id: pending.emailId,
      fromEmail: pending.emailFrom,
      fromName: pending.emailFromName,
      subject: pending.emailSubject,
      snippet: '',
      receivedAt: pending.emailReceived,
      sizeBytes: 0,
      isUnread: true,
      hasListUnsubscribe: false,
      folder: pending.emailFolder,
    };
    await executeAutoAction(
      pending.accountId,
      client,
      msg,
      pending.actionType,
      pending.actionPayload,
      pending.actionLabel
    );
  }
  emitBadge();
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
  return { ok: true };
}

export async function undoLiveAction(actionLogId: string) {
  const { getActionLog, markActionUndone } = await import('./liveSyncDb.js');
  const log = getActionLog(actionLogId);
  if (!log) return { ok: false, error: 'not_found' };
  const client = clientFor(log.accountId);
  const ok = await undoActionLog(log.accountId, client, log);
  if (ok) markActionUndone(actionLogId);
  return { ok };
}

export function onPreferencesChanged() {
  globalEnabled = livePrefs().enabled;
  if (!globalEnabled) {
    for (const id of [...loops.keys()]) stopAccountLoop(id);
  } else {
    startLiveSyncForAccounts(storage.listAccounts());
  }
  broadcast(IPC.LiveSyncStatus, buildStatusPayload());
}
