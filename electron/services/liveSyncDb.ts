// Global SQLite store for live sync state, notifications, pending actions, action log.
//
// Storage: ~/Library/Application Support/MailVault/live.db

import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ActionLogRecord,
  LiveSyncAccountStatus,
  LiveSyncStateRow,
  NotificationRecord,
  PendingActionRecord,
  SuggestionActionPayload,
} from '../../shared/types.js';

let db: Database.Database | null = null;

export function liveDbPath(): string {
  const home = os.homedir();
  const appName = 'MailVault';
  let dir: string;
  if (process.platform === 'darwin') {
    dir = path.join(home, 'Library', 'Application Support', appName);
  } else if (process.platform === 'win32') {
    dir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName);
  } else {
    dir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), appName);
  }
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'live.db');
}

export function openLiveDb(): Database.Database {
  if (db) return db;
  db = new Database(liveDbPath());
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

export function closeLiveDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL,
      type            TEXT NOT NULL,
      priority        INTEGER NOT NULL,
      title           TEXT NOT NULL,
      body            TEXT NOT NULL,
      icon_type       TEXT NOT NULL,
      action_url      TEXT,
      pending_id      TEXT,
      email_id        TEXT,
      email_from      TEXT,
      email_subject   TEXT,
      read_at         INTEGER,
      dismissed_at    INTEGER,
      created_at      INTEGER NOT NULL,
      account_email   TEXT NOT NULL,
      account_avatar  TEXT,
      action_log_id   TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL,
      email_id        TEXT NOT NULL,
      email_subject   TEXT NOT NULL,
      email_from      TEXT NOT NULL,
      email_from_name TEXT NOT NULL,
      email_received  INTEGER NOT NULL,
      email_folder    TEXT NOT NULL,
      trigger_type    TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      action_label    TEXT NOT NULL,
      action_payload  TEXT NOT NULL,
      priority        INTEGER NOT NULL,
      explanation     TEXT NOT NULL DEFAULT '',
      confidence      REAL NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      resolved_at     INTEGER,
      resolution      TEXT,
      account_email   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL,
      email_id        TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      before_state    TEXT NOT NULL,
      after_state     TEXT NOT NULL,
      applied_at      INTEGER NOT NULL,
      undone_at       INTEGER,
      undoable_until  INTEGER NOT NULL,
      rule_id         TEXT,
      summary         TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS live_sync_state (
      account_id      TEXT PRIMARY KEY,
      status          TEXT NOT NULL DEFAULT 'paused',
      last_poll_at    INTEGER,
      next_poll_at    INTEGER,
      last_history_id TEXT,
      delta_link      TEXT,
      poll_interval   INTEGER NOT NULL DEFAULT 60,
      error_message   TEXT,
      seen_ids        TEXT,
      recent_count    INTEGER NOT NULL DEFAULT 0,
      updated_at      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_pending_unresolved ON pending_actions(resolved_at) WHERE resolved_at IS NULL;
  `);
}

function rowToNotification(r: Record<string, unknown>): NotificationRecord {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    type: r.type as NotificationRecord['type'],
    priority: r.priority as NotificationRecord['priority'],
    title: r.title as string,
    body: r.body as string,
    iconType: r.icon_type as NotificationRecord['iconType'],
    actionUrl: (r.action_url as string) ?? null,
    pendingId: (r.pending_id as string) ?? null,
    emailId: (r.email_id as string) ?? null,
    emailFrom: (r.email_from as string) ?? null,
    emailSubject: (r.email_subject as string) ?? null,
    readAt: (r.read_at as number) ?? null,
    dismissedAt: (r.dismissed_at as number) ?? null,
    createdAt: r.created_at as number,
    accountEmail: r.account_email as string,
    accountAvatar: (r.account_avatar as string) ?? null,
    actionLogId: (r.action_log_id as string) ?? null,
  };
}

function rowToPending(r: Record<string, unknown>): PendingActionRecord {
  let payload: SuggestionActionPayload = {};
  try {
    payload = JSON.parse((r.action_payload as string) || '{}');
  } catch {
    payload = {};
  }
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    emailId: r.email_id as string,
    emailSubject: r.email_subject as string,
    emailFrom: r.email_from as string,
    emailFromName: r.email_from_name as string,
    emailReceived: r.email_received as number,
    emailFolder: r.email_folder as string,
    triggerType: r.trigger_type as string,
    actionType: r.action_type as string,
    actionLabel: r.action_label as string,
    actionPayload: payload,
    priority: r.priority as PendingActionRecord['priority'],
    explanation: (r.explanation as string) ?? '',
    confidence: (r.confidence as number) ?? 0,
    createdAt: r.created_at as number,
    resolvedAt: (r.resolved_at as number) ?? null,
    resolution: (r.resolution as PendingActionRecord['resolution']) ?? null,
    accountEmail: r.account_email as string,
  };
}

function rowToActionLog(r: Record<string, unknown>): ActionLogRecord {
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    emailId: r.email_id as string,
    actionType: r.action_type as string,
    beforeState: r.before_state as string,
    afterState: r.after_state as string,
    appliedAt: r.applied_at as number,
    undoneAt: (r.undone_at as number) ?? null,
    undoableUntil: r.undoable_until as number,
    ruleId: (r.rule_id as string) ?? null,
    summary: (r.summary as string) ?? '',
  };
}

export function insertNotification(n: Omit<NotificationRecord, 'id'> & { id?: string }): NotificationRecord {
  const d = openLiveDb();
  const id = n.id ?? randomUUID();
  d.prepare(`
    INSERT INTO notifications (
      id, account_id, type, priority, title, body, icon_type, action_url,
      pending_id, email_id, email_from, email_subject, read_at, dismissed_at,
      created_at, account_email, account_avatar, action_log_id
    ) VALUES (
      @id, @accountId, @type, @priority, @title, @body, @iconType, @actionUrl,
      @pendingId, @emailId, @emailFrom, @emailSubject, @readAt, @dismissedAt,
      @createdAt, @accountEmail, @accountAvatar, @actionLogId
    )
  `).run({
    id,
    accountId: n.accountId,
    type: n.type,
    priority: n.priority,
    title: n.title.slice(0, 60),
    body: n.body.slice(0, 120),
    iconType: n.iconType,
    actionUrl: n.actionUrl,
    pendingId: n.pendingId,
    emailId: n.emailId,
    emailFrom: n.emailFrom,
    emailSubject: n.emailSubject,
    readAt: n.readAt ?? null,
    dismissedAt: n.dismissedAt ?? null,
    createdAt: n.createdAt,
    accountEmail: n.accountEmail,
    accountAvatar: n.accountAvatar,
    actionLogId: n.actionLogId ?? null,
  });
  return { ...n, id };
}

export function listNotifications(opts: {
  limit?: number;
  type?: string;
  accountId?: string;
  unreadOnly?: boolean;
  includeDismissed?: boolean;
}): NotificationRecord[] {
  const d = openLiveDb();
  const clauses: string[] = ['1=1'];
  const params: Record<string, unknown> = { limit: opts.limit ?? 100 };
  if (opts.type) {
    clauses.push('type = @type');
    params.type = opts.type;
  }
  if (opts.accountId) {
    clauses.push('account_id = @accountId');
    params.accountId = opts.accountId;
  }
  if (opts.unreadOnly) clauses.push('read_at IS NULL');
  if (!opts.includeDismissed) clauses.push('dismissed_at IS NULL');
  const rows = d
    .prepare(`SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT @limit`)
    .all(params) as Record<string, unknown>[];
  return rows.map(rowToNotification);
}

export function markNotificationsRead(ids?: string[]) {
  const d = openLiveDb();
  const now = Date.now();
  if (ids && ids.length) {
    const stmt = d.prepare('UPDATE notifications SET read_at = @now WHERE id = @id AND read_at IS NULL');
    for (const id of ids) stmt.run({ id, now });
  } else {
    d.prepare('UPDATE notifications SET read_at = @now WHERE read_at IS NULL').run({ now });
  }
}

export function dismissNotification(id: string) {
  openLiveDb()
    .prepare('UPDATE notifications SET dismissed_at = @now, read_at = COALESCE(read_at, @now) WHERE id = @id')
    .run({ id, now: Date.now() });
}

export function insertPendingAction(
  p: Omit<PendingActionRecord, 'id' | 'resolvedAt' | 'resolution'> & { id?: string }
): PendingActionRecord {
  const d = openLiveDb();
  const id = p.id ?? randomUUID();
  d.prepare(`
    INSERT INTO pending_actions (
      id, account_id, email_id, email_subject, email_from, email_from_name,
      email_received, email_folder, trigger_type, action_type, action_label,
      action_payload, priority, explanation, confidence, created_at, account_email
    ) VALUES (
      @id, @accountId, @emailId, @emailSubject, @emailFrom, @emailFromName,
      @emailReceived, @emailFolder, @triggerType, @actionType, @actionLabel,
      @actionPayload, @priority, @explanation, @confidence, @createdAt, @accountEmail
    )
  `).run({
    id,
    accountId: p.accountId,
    emailId: p.emailId,
    emailSubject: p.emailSubject,
    emailFrom: p.emailFrom,
    emailFromName: p.emailFromName,
    emailReceived: p.emailReceived,
    emailFolder: p.emailFolder,
    triggerType: p.triggerType,
    actionType: p.actionType,
    actionLabel: p.actionLabel,
    actionPayload: JSON.stringify(p.actionPayload),
    priority: p.priority,
    explanation: p.explanation,
    confidence: p.confidence,
    createdAt: p.createdAt,
    accountEmail: p.accountEmail,
  });
  return { ...p, id, resolvedAt: null, resolution: null };
}

export function listPendingActions(accountId?: string): PendingActionRecord[] {
  const d = openLiveDb();
  const rows = accountId
    ? (d
        .prepare(
          'SELECT * FROM pending_actions WHERE resolved_at IS NULL AND account_id = @accountId ORDER BY priority ASC, created_at DESC'
        )
        .all({ accountId }) as Record<string, unknown>[])
    : (d
        .prepare(
          'SELECT * FROM pending_actions WHERE resolved_at IS NULL ORDER BY priority ASC, created_at DESC'
        )
        .all() as Record<string, unknown>[]);
  return rows.map(rowToPending);
}

export function getPendingAction(id: string): PendingActionRecord | null {
  const r = openLiveDb()
    .prepare('SELECT * FROM pending_actions WHERE id = @id')
    .get({ id }) as Record<string, unknown> | undefined;
  return r ? rowToPending(r) : null;
}

export function resolvePendingAction(
  id: string,
  resolution: 'approved' | 'rejected' | 'dismissed'
) {
  openLiveDb()
    .prepare('UPDATE pending_actions SET resolved_at = @now, resolution = @resolution WHERE id = @id')
    .run({ id, now: Date.now(), resolution });
}

export function countPendingApprovals(): number {
  const r = openLiveDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM pending_actions
       WHERE resolved_at IS NULL AND priority <= 2`
    )
    .get() as { c: number };
  return r.c ?? 0;
}

export function insertActionLog(
  a: Omit<ActionLogRecord, 'id' | 'undoneAt'> & { id?: string }
): ActionLogRecord {
  const d = openLiveDb();
  const id = a.id ?? randomUUID();
  d.prepare(`
    INSERT INTO action_log (
      id, account_id, email_id, action_type, before_state, after_state,
      applied_at, undone_at, undoable_until, rule_id, summary
    ) VALUES (
      @id, @accountId, @emailId, @actionType, @beforeState, @afterState,
      @appliedAt, NULL, @undoableUntil, @ruleId, @summary
    )
  `).run({
    id,
    accountId: a.accountId,
    emailId: a.emailId,
    actionType: a.actionType,
    beforeState: a.beforeState,
    afterState: a.afterState,
    appliedAt: a.appliedAt,
    undoableUntil: a.undoableUntil,
    ruleId: a.ruleId,
    summary: a.summary,
  });
  return { ...a, id, undoneAt: null };
}

export function getActionLog(id: string): ActionLogRecord | null {
  const r = openLiveDb()
    .prepare('SELECT * FROM action_log WHERE id = @id')
    .get({ id }) as Record<string, unknown> | undefined;
  return r ? rowToActionLog(r) : null;
}

export function markActionUndone(id: string) {
  openLiveDb()
    .prepare('UPDATE action_log SET undone_at = @now WHERE id = @id')
    .run({ id, now: Date.now() });
}

export function listActionLogs(opts?: {
  accountId?: string;
  limit?: number;
}): ActionLogRecord[] {
  const limit = opts?.limit ?? 50;
  const d = openLiveDb();
  if (opts?.accountId) {
    const rows = d
      .prepare(
        `SELECT * FROM action_log WHERE account_id = @accountId
         ORDER BY applied_at DESC LIMIT @limit`
      )
      .all({ accountId: opts.accountId, limit }) as Record<string, unknown>[];
    return rows.map(rowToActionLog);
  }
  const rows = d
    .prepare(`SELECT * FROM action_log ORDER BY applied_at DESC LIMIT @limit`)
    .all({ limit }) as Record<string, unknown>[];
  return rows.map(rowToActionLog);
}

export function upsertLiveSyncState(row: Partial<LiveSyncStateRow> & { accountId: string }) {
  const d = openLiveDb();
  const existing = d
    .prepare('SELECT * FROM live_sync_state WHERE account_id = @accountId')
    .get({ accountId: row.accountId }) as Record<string, unknown> | undefined;
  const now = Date.now();
  if (!existing) {
    d.prepare(`
      INSERT INTO live_sync_state (
        account_id, status, last_poll_at, next_poll_at, last_history_id, delta_link,
        poll_interval, error_message, seen_ids, recent_count, updated_at
      ) VALUES (
        @accountId, @status, @lastPollAt, @nextPollAt, @lastHistoryId, @deltaLink,
        @pollInterval, @errorMessage, @seenIds, @recentCount, @updatedAt
      )
    `).run({
      accountId: row.accountId,
      status: row.status ?? 'paused',
      lastPollAt: row.lastPollAt ?? null,
      nextPollAt: row.nextPollAt ?? null,
      lastHistoryId: row.lastHistoryId ?? null,
      deltaLink: row.deltaLink ?? null,
      pollInterval: row.pollInterval ?? 60,
      errorMessage: row.errorMessage ?? null,
      seenIds: null,
      recentCount: 0,
      updatedAt: now,
    });
  } else {
    d.prepare(`
      UPDATE live_sync_state SET
        status = COALESCE(@status, status),
        last_poll_at = COALESCE(@lastPollAt, last_poll_at),
        next_poll_at = COALESCE(@nextPollAt, next_poll_at),
        last_history_id = COALESCE(@lastHistoryId, last_history_id),
        delta_link = COALESCE(@deltaLink, delta_link),
        poll_interval = COALESCE(@pollInterval, poll_interval),
        error_message = @errorMessage,
        updated_at = @updatedAt
      WHERE account_id = @accountId
    `).run({
      accountId: row.accountId,
      status: row.status ?? null,
      lastPollAt: row.lastPollAt ?? null,
      nextPollAt: row.nextPollAt ?? null,
      lastHistoryId: row.lastHistoryId ?? null,
      deltaLink: row.deltaLink ?? null,
      pollInterval: row.pollInterval ?? null,
      errorMessage: row.errorMessage ?? existing.error_message,
      updatedAt: now,
    });
  }
}

export function getLiveSyncState(accountId: string): LiveSyncStateRow | null {
  const r = openLiveDb()
    .prepare('SELECT * FROM live_sync_state WHERE account_id = @accountId')
    .get({ accountId }) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    accountId: r.account_id as string,
    status: r.status as LiveSyncAccountStatus,
    lastPollAt: (r.last_poll_at as number) ?? null,
    nextPollAt: (r.next_poll_at as number) ?? null,
    lastHistoryId: (r.last_history_id as string) ?? null,
    deltaLink: (r.delta_link as string) ?? null,
    pollInterval: r.poll_interval as number,
    errorMessage: (r.error_message as string) ?? null,
    updatedAt: r.updated_at as number,
  };
}

export function listLiveSyncStates(): LiveSyncStateRow[] {
  const rows = openLiveDb()
    .prepare('SELECT * FROM live_sync_state')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    accountId: r.account_id as string,
    status: r.status as LiveSyncAccountStatus,
    lastPollAt: (r.last_poll_at as number) ?? null,
    nextPollAt: (r.next_poll_at as number) ?? null,
    lastHistoryId: (r.last_history_id as string) ?? null,
    deltaLink: (r.delta_link as string) ?? null,
    pollInterval: r.poll_interval as number,
    errorMessage: (r.error_message as string) ?? null,
    updatedAt: r.updated_at as number,
  }));
}

export function getSeenIds(accountId: string): Set<string> {
  const r = openLiveDb()
    .prepare('SELECT seen_ids FROM live_sync_state WHERE account_id = @accountId')
    .get({ accountId }) as { seen_ids: string | null } | undefined;
  if (!r?.seen_ids) return new Set();
  try {
    const arr = JSON.parse(r.seen_ids) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function setSeenIds(accountId: string, ids: Set<string>) {
  const arr = [...ids].slice(-200);
  openLiveDb()
    .prepare('UPDATE live_sync_state SET seen_ids = @seenIds, updated_at = @now WHERE account_id = @accountId')
    .run({ accountId, seenIds: JSON.stringify(arr), now: Date.now() });
}

export function bumpRecentActivity(accountId: string, count: number) {
  openLiveDb()
    .prepare(
      'UPDATE live_sync_state SET recent_count = @count, updated_at = @now WHERE account_id = @accountId'
    )
    .run({ accountId, count, now: Date.now() });
}

export function getRecentActivity(accountId: string): number {
  const r = openLiveDb()
    .prepare('SELECT recent_count FROM live_sync_state WHERE account_id = @accountId')
    .get({ accountId }) as { recent_count: number } | undefined;
  return r?.recent_count ?? 0;
}

export function purgeStalePending() {
  const cutoff = Date.now() - 7 * 24 * 3600_000;
  openLiveDb()
    .prepare(
      `UPDATE pending_actions SET resolved_at = @now, resolution = 'dismissed'
       WHERE resolved_at IS NULL AND created_at < @cutoff`
    )
    .run({ now: Date.now(), cutoff });
}
