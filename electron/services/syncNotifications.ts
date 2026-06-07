// Notifications for manual (full) mailbox sync completion and failure.

import { Notification } from 'electron';
import { IPC, type NotificationRecord } from '../../shared/types.js';
import { insertNotification } from './liveSyncDb.js';
import { broadcast } from './broadcast.js';
import { storage } from '../store.js';
import { isWindowFocused } from './liveSyncEngine.js';

export interface SyncCompleteSummary {
  totalEmails: number;
  totalSenders: number;
  totalStorage: number;
  durationMs: number;
}

function syncNotificationsEnabled(): boolean {
  return storage.getPreferences().liveSync.notifications.notifyOnSyncComplete !== false;
}

function accountFor(accountId: string) {
  return storage.listAccounts().find((a) => a.id === accountId);
}

function formatDuration(ms: number): string {
  if (ms < 1500) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function emit(n: NotificationRecord) {
  broadcast(IPC.LiveNotification, n);
}

function maybeShowNative(title: string, body: string) {
  if (!syncNotificationsEnabled() || isWindowFocused()) return;
  if (!Notification.isSupported()) return;
  const native = new Notification({ title, body });
  native.show();
}

export function notifySyncComplete(accountId: string, summary: SyncCompleteSummary) {
  const profile = accountFor(accountId);
  const email = profile?.email ?? accountId;
  const detail = `${summary.totalEmails.toLocaleString()} emails · ${summary.totalSenders.toLocaleString()} senders · ${formatDuration(summary.durationMs)}`;

  const n = insertNotification({
    accountId,
    type: 'SYNC_COMPLETE',
    priority: 3,
    title: 'Sync complete',
    body: `${email} — ${detail}`,
    iconType: 'check',
    actionUrl: 'dashboard',
    pendingId: null,
    emailId: null,
    emailFrom: null,
    emailSubject: null,
    readAt: null,
    dismissedAt: null,
    createdAt: Date.now(),
    accountEmail: email,
    accountAvatar: profile?.avatarUrl ?? null,
  });
  emit(n);
  maybeShowNative('Sync complete', `${email}: ${detail}`);
}

export function notifySyncFailed(accountId: string, message: string) {
  const profile = accountFor(accountId);
  const email = profile?.email ?? accountId;
  const body = `${email} — ${message}`;

  const n = insertNotification({
    accountId,
    type: 'SYNC_ERROR',
    priority: 2,
    title: 'Sync failed',
    body,
    iconType: 'warning',
    actionUrl: null,
    pendingId: null,
    emailId: null,
    emailFrom: null,
    emailSubject: null,
    readAt: null,
    dismissedAt: null,
    createdAt: Date.now(),
    accountEmail: email,
    accountAvatar: profile?.avatarUrl ?? null,
  });
  emit(n);
  maybeShowNative('Sync failed', body);
}
