// Per-account SQLite cache for sync results.
//
// Storage: ~/Library/Application Support/MailVault/data/{accountId-safe}.db
// Each linked email account gets its own database — isolates write hotspots,
// keeps single-account rebuilds cheap, and avoids cross-account joins.
//
// This module is safe to require from BOTH the main process and a Node
// worker thread: each thread opens its own `better-sqlite3` handle (handles
// are not shareable across threads). Pass a stable `dbPath` from the main
// process to the worker via `workerData` so both agree on the file.

import Database from 'better-sqlite3';
import nodePath from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export interface SyncEmailRow {
  id: string;
  accountId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  receivedAt: number;
  sizeBytes: number;
  folderId: string | null;
  isRead: 0 | 1;
  isNewsletter: 0 | 1;
  hasListUnsubscribe: 0 | 1;
  /** Raw List-Unsubscribe header value when present. May contain `<https://…>`,
   *  `<mailto:…>` segments, or both, comma-separated per RFC 2369. */
  listUnsubscribeValue: string | null;
  fetchedAt: number;
}

export interface SyncSenderGroupRow {
  id: string;
  accountId: string;
  senderName: string;
  emailCount: number;
  totalSizeBytes: number;
  firstSeen: number;
  lastSeen: number;
  unreadCount: number;
  isNewsletter: 0 | 1;
  isNotification: 0 | 1;
  /** Roll-up of whether ANY email from this sender carried List-Unsubscribe. */
  hasListUnsubscribeHeader: 0 | 1;
  /** Most recent unsubscribe URL extracted from a List-Unsubscribe header.
   *  Null when no email from this sender exposed one. Closes audit P0-2. */
  unsubscribeUrl: string | null;
  confidenceDelete: 0 | 1 | 2;
  suggestedFolder: string | null;
  category: string | null;
  sampleSubjects: string;
  updatedAt: number;
}

export interface SyncStateRow {
  accountId: string;
  rangePreset: string;
  cursor: string | null;
  stage: number;
  emailsFetched: number;
  startedAt: number;
  completedAt: number | null;
  syncVersion: number;
}

export interface FolderSuggestionRow {
  id: string;
  accountId: string;
  folderName: string;
  category: string;
  reason: string;
  senderEmails: string;
  emailCount: number;
  confidence: number;
  createdAt: number;
}

export interface SuggestionRow {
  id: string;
  accountId: string;
  type: string;
  groupType: string;
  priority: number;
  confidence: number;
  title: string;
  description: string;
  actionLabel: string;
  actionType: string;
  actionPayload: string;
  affectedCount: number;
  affectedSenders: string;
  sizeBytes: number;
  source: string;
  createdAt: number;
  dismissedAt: number | null;
  appliedAt: number | null;
}

export interface SuggestionGroupRow {
  id: string;
  accountId: string;
  groupType: string;
  title: string;
  totalAffected: number;
  totalSizeBytes: number;
  suggestionIds: string;
  priority: number;
  createdAt: number;
}

const SYNC_VERSION = 2;

export function dataDir(): string {
  const home = os.homedir();
  const appName = 'MailVault';
  let dir: string;
  if (process.platform === 'darwin') {
    dir = nodePath.join(home, 'Library', 'Application Support', appName, 'data');
  } else if (process.platform === 'win32') {
    dir = nodePath.join(
      process.env.APPDATA || nodePath.join(home, 'AppData', 'Roaming'),
      appName,
      'data'
    );
  } else {
    dir = nodePath.join(
      process.env.XDG_CONFIG_HOME || nodePath.join(home, '.config'),
      appName,
      'data'
    );
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * `accountId` typically has the form `provider:email@example.com` — totally
 * fine on macOS/Linux, but we still sanitize for safety on Windows where ":"
 * is reserved.
 */
export function dbPathForAccount(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9._@+-]/g, '_');
  return nodePath.join(dataDir(), `${safe}.db`);
}

export class SyncDb {
  private db: Database.Database;

  constructor(public readonly path: string) {
    fs.mkdirSync(nodePath.dirname(this.path), { recursive: true });
    this.db = new Database(this.path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    // Negative cache_size = KB, so -8000 ≈ 8 MB page cache. Keeps memory bounded.
    this.db.pragma('cache_size = -8000');
    this.migrate();
  }

  close() {
    try {
      this.db.close();
    } catch {
      // ignore — likely already closed
    }
  }

  // ─── schema ────────────────────────────────────────────────────────
  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id                      TEXT PRIMARY KEY,
        account_id              TEXT NOT NULL,
        sender_email            TEXT NOT NULL,
        sender_name             TEXT,
        subject                 TEXT,
        received_at             INTEGER NOT NULL,
        size_bytes              INTEGER NOT NULL DEFAULT 0,
        folder_id               TEXT,
        is_read                 INTEGER NOT NULL DEFAULT 0,
        is_newsletter           INTEGER NOT NULL DEFAULT 0,
        has_list_unsubscribe    INTEGER NOT NULL DEFAULT 0,
        list_unsubscribe_value  TEXT,
        fetched_at              INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sender_groups (
        id                       TEXT PRIMARY KEY,
        account_id               TEXT NOT NULL,
        sender_name              TEXT,
        email_count              INTEGER NOT NULL DEFAULT 0,
        total_size_bytes         INTEGER NOT NULL DEFAULT 0,
        first_seen               INTEGER,
        last_seen                INTEGER,
        unread_count             INTEGER NOT NULL DEFAULT 0,
        is_newsletter            INTEGER NOT NULL DEFAULT 0,
        is_notification          INTEGER NOT NULL DEFAULT 0,
        has_list_unsubscribe     INTEGER NOT NULL DEFAULT 0,
        unsubscribe_url          TEXT,
        confidence_delete        INTEGER NOT NULL DEFAULT 0,
        suggested_folder         TEXT,
        category                 TEXT,
        sample_subjects          TEXT NOT NULL DEFAULT '[]',
        updated_at               INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        account_id      TEXT PRIMARY KEY,
        range_preset    TEXT NOT NULL,
        cursor          TEXT,
        stage           INTEGER NOT NULL DEFAULT 0,
        emails_fetched  INTEGER NOT NULL DEFAULT 0,
        started_at      INTEGER NOT NULL,
        completed_at    INTEGER,
        sync_version    INTEGER NOT NULL DEFAULT ${SYNC_VERSION}
      );

      CREATE TABLE IF NOT EXISTS folder_suggestions (
        id               TEXT PRIMARY KEY,
        account_id       TEXT NOT NULL,
        folder_name      TEXT NOT NULL,
        category         TEXT NOT NULL,
        reason           TEXT NOT NULL,
        sender_emails    TEXT NOT NULL,
        email_count      INTEGER NOT NULL DEFAULT 0,
        confidence       REAL NOT NULL DEFAULT 0,
        created_at       INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS suggestions (
        id                 TEXT PRIMARY KEY,
        account_id         TEXT NOT NULL,
        type               TEXT NOT NULL,
        group_type         TEXT NOT NULL,
        priority           INTEGER NOT NULL,
        confidence         REAL NOT NULL,
        title              TEXT NOT NULL,
        description        TEXT NOT NULL,
        action_label       TEXT NOT NULL,
        action_type        TEXT NOT NULL,
        action_payload     TEXT NOT NULL DEFAULT '{}',
        affected_count     INTEGER NOT NULL DEFAULT 0,
        affected_senders   TEXT NOT NULL DEFAULT '[]',
        size_bytes         INTEGER NOT NULL DEFAULT 0,
        source             TEXT NOT NULL DEFAULT '',
        created_at         INTEGER NOT NULL,
        dismissed_at       INTEGER,
        applied_at         INTEGER
      );

      CREATE TABLE IF NOT EXISTS suggestion_groups (
        id                 TEXT PRIMARY KEY,
        account_id         TEXT NOT NULL,
        group_type         TEXT NOT NULL,
        title              TEXT NOT NULL,
        total_affected     INTEGER NOT NULL DEFAULT 0,
        total_size_bytes   INTEGER NOT NULL DEFAULT 0,
        suggestion_ids     TEXT NOT NULL DEFAULT '[]',
        priority           INTEGER NOT NULL DEFAULT 5,
        created_at         INTEGER NOT NULL
      );
    `);

    // ── Soft migrations for forward-compatibility ──────────────────
    // SQLite ignores duplicate-column errors only via PRAGMA, so we
    // probe `pragma table_info` instead.
    if (!this.columnExists('sender_groups', 'has_list_unsubscribe')) {
      this.db.exec(
        'ALTER TABLE sender_groups ADD COLUMN has_list_unsubscribe INTEGER NOT NULL DEFAULT 0'
      );
    }
    if (!this.columnExists('sender_groups', 'unsubscribe_url')) {
      this.db.exec('ALTER TABLE sender_groups ADD COLUMN unsubscribe_url TEXT');
    }
    if (!this.columnExists('emails', 'list_unsubscribe_value')) {
      this.db.exec('ALTER TABLE emails ADD COLUMN list_unsubscribe_value TEXT');
    }
  }

  private columnExists(table: string, column: string): boolean {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.some((r) => r.name === column);
  }

  /**
   * Final-pass indexes — created at end of stage 5 so bulk inserts in stages
   * 2–3 don't pay maintenance cost on every row.
   */
  finalizeIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_account     ON emails(account_id);
      CREATE INDEX IF NOT EXISTS idx_emails_sender      ON emails(sender_email);
      CREATE INDEX IF NOT EXISTS idx_emails_received    ON emails(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_emails_folder      ON emails(folder_id);

      CREATE INDEX IF NOT EXISTS idx_sg_count           ON sender_groups(email_count DESC);
      CREATE INDEX IF NOT EXISTS idx_sg_size            ON sender_groups(total_size_bytes DESC);
      CREATE INDEX IF NOT EXISTS idx_sg_flags           ON sender_groups(is_newsletter, is_notification);
      CREATE INDEX IF NOT EXISTS idx_sg_confidence      ON sender_groups(confidence_delete DESC);

      CREATE INDEX IF NOT EXISTS idx_fs_account         ON folder_suggestions(account_id);

      CREATE INDEX IF NOT EXISTS idx_sug_account         ON suggestions(account_id, dismissed_at, applied_at);
      CREATE INDEX IF NOT EXISTS idx_sug_priority        ON suggestions(priority ASC, confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_sug_group_type      ON suggestions(group_type);
      CREATE INDEX IF NOT EXISTS idx_sug_groups_account  ON suggestion_groups(account_id);
    `);
    // ANALYZE is cheap on freshly-built indexes and helps SQLite pick plans
    // for the kinds of aggregate reads the renderer will do.
    this.db.exec('ANALYZE');
  }

  // ─── emails ────────────────────────────────────────────────────────
  /**
   * Bulk insert emails in one transaction. Returns # rows actually written
   * (duplicates ignored via INSERT OR IGNORE).
   */
  insertEmails(rows: SyncEmailRow[]): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO emails (
        id, account_id, sender_email, sender_name, subject,
        received_at, size_bytes, folder_id, is_read, is_newsletter,
        has_list_unsubscribe, list_unsubscribe_value, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((batch: SyncEmailRow[]) => {
      let n = 0;
      for (const r of batch) {
        const info = stmt.run(
          r.id,
          r.accountId,
          r.senderEmail,
          r.senderName,
          r.subject,
          r.receivedAt,
          r.sizeBytes,
          r.folderId,
          r.isRead,
          r.isNewsletter,
          r.hasListUnsubscribe,
          r.listUnsubscribeValue,
          r.fetchedAt
        );
        n += info.changes;
      }
      return n;
    });
    return tx(rows);
  }

  countEmails(accountId: string): number {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM emails WHERE account_id = ?')
      .get(accountId) as { n: number };
    return r.n;
  }

  /** Stream emails in chunks for stage 3 grouping — never load all at once. */
  *streamEmails(accountId: string, chunkSize = 1000): Generator<SyncEmailRow[]> {
    const stmt = this.db.prepare(`
      SELECT id, account_id AS accountId, sender_email AS senderEmail,
             sender_name AS senderName, subject, received_at AS receivedAt,
             size_bytes AS sizeBytes, folder_id AS folderId, is_read AS isRead,
             is_newsletter AS isNewsletter,
             has_list_unsubscribe AS hasListUnsubscribe,
             list_unsubscribe_value AS listUnsubscribeValue, fetched_at AS fetchedAt
        FROM emails WHERE account_id = ?
        ORDER BY rowid
        LIMIT ? OFFSET ?
    `);
    let offset = 0;
    while (true) {
      const rows = stmt.all(accountId, chunkSize, offset) as SyncEmailRow[];
      if (rows.length === 0) return;
      yield rows;
      offset += rows.length;
    }
  }

  /**
   * Returns a capped slab of emails for the renderer's legacy in-memory UI.
   * Phase 2 will replace this with per-sender cursors; for now we cap and
   * order so the most recent N rows are surfaced.
   */
  getEmailsForUi(
    accountId: string,
    limit = 50_000
  ): Array<{
    id: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    receivedAt: number;
    sizeBytes: number;
    isUnread: boolean;
    hasListUnsubscribe: boolean;
    folder?: string;
  }> {
    return this.db
      .prepare(
        `SELECT id, sender_email AS fromEmail, sender_name AS fromName,
                subject, received_at AS receivedAt, size_bytes AS sizeBytes,
                is_read, has_list_unsubscribe, folder_id AS folder
         FROM emails WHERE account_id = ?
         ORDER BY received_at DESC LIMIT ?`
      )
      .all(accountId, limit)
      .map((row) => {
        const r = row as {
          id: string;
          fromEmail: string;
          fromName: string;
          subject: string;
          receivedAt: number;
          sizeBytes: number;
          is_read: number;
          has_list_unsubscribe: number;
          folder: string | null;
        };
        return {
          id: r.id,
          fromEmail: r.fromEmail,
          fromName: r.fromName,
          subject: r.subject,
          receivedAt: r.receivedAt,
          sizeBytes: r.sizeBytes,
          isUnread: r.is_read === 0,
          hasListUnsubscribe: r.has_list_unsubscribe === 1,
          folder: r.folder ?? undefined,
        };
      });
  }

  /** List emails in a folder from the local sync cache. */
  listEmailsByFolder(
    accountId: string,
    folderId: string,
    limit = 200,
    offset = 0
  ): Array<{
    id: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    receivedAt: number;
    sizeBytes: number;
    isUnread: boolean;
    hasListUnsubscribe: boolean;
    folder?: string;
  }> {
    const id = folderId.trim();
    const upper = id.toUpperCase();
    const isInbox = upper === 'INBOX' || id.toLowerCase() === 'inbox';
    const isJunk =
      upper === 'SPAM' ||
      upper === 'JUNK' ||
      id.toLowerCase() === 'junkemail' ||
      /junk|spam/i.test(id);

    let folderClause = 'AND folder_id = ?';
    const params: Array<string | number> = [accountId, id];

    if (isInbox) {
      folderClause =
        "AND (folder_id = ? OR folder_id = 'INBOX' OR folder_id IS NULL OR LOWER(COALESCE(folder_id,'')) LIKE '%inbox%')";
    } else if (isJunk) {
      folderClause =
        "AND (folder_id = ? OR LOWER(COALESCE(folder_id,'')) LIKE '%junk%' OR LOWER(COALESCE(folder_id,'')) LIKE '%spam%')";
    }

    return this.db
      .prepare(
        `SELECT id, sender_email AS fromEmail, sender_name AS fromName,
                subject, received_at AS receivedAt, size_bytes AS sizeBytes,
                is_read, has_list_unsubscribe, folder_id AS folder
         FROM emails WHERE account_id = ? ${folderClause}
         ORDER BY received_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
      .map((row) => {
        const r = row as {
          id: string;
          fromEmail: string;
          fromName: string;
          subject: string;
          receivedAt: number;
          sizeBytes: number;
          is_read: number;
          has_list_unsubscribe: number;
          folder: string | null;
        };
        return {
          id: r.id,
          fromEmail: r.fromEmail,
          fromName: r.fromName,
          subject: r.subject,
          receivedAt: r.receivedAt,
          sizeBytes: r.sizeBytes,
          isUnread: r.is_read === 0,
          hasListUnsubscribe: r.has_list_unsubscribe === 1,
          folder: r.folder ?? undefined,
        };
      });
  }

  /** Newest received_at across emails table for incremental syncs. */
  maxReceivedAt(accountId: string): number {
    const r = this.db
      .prepare('SELECT MAX(received_at) AS m FROM emails WHERE account_id = ?')
      .get(accountId) as { m: number | null };
    return r.m ?? 0;
  }

  // ─── sender_groups ─────────────────────────────────────────────────
  upsertSenderGroups(rows: SyncSenderGroupRow[]): void {
    if (rows.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT INTO sender_groups (
        id, account_id, sender_name, email_count, total_size_bytes,
        first_seen, last_seen, unread_count, is_newsletter, is_notification,
        has_list_unsubscribe, unsubscribe_url, confidence_delete,
        suggested_folder, category, sample_subjects, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sender_name          = excluded.sender_name,
        email_count          = excluded.email_count,
        total_size_bytes     = excluded.total_size_bytes,
        first_seen           = MIN(sender_groups.first_seen, excluded.first_seen),
        last_seen            = MAX(sender_groups.last_seen, excluded.last_seen),
        unread_count         = excluded.unread_count,
        is_newsletter        = excluded.is_newsletter,
        is_notification      = excluded.is_notification,
        has_list_unsubscribe = excluded.has_list_unsubscribe,
        unsubscribe_url      = COALESCE(excluded.unsubscribe_url, sender_groups.unsubscribe_url),
        confidence_delete    = excluded.confidence_delete,
        suggested_folder     = excluded.suggested_folder,
        category             = excluded.category,
        sample_subjects      = excluded.sample_subjects,
        updated_at           = excluded.updated_at
    `);
    const tx = this.db.transaction((batch: SyncSenderGroupRow[]) => {
      for (const r of batch) {
        stmt.run(
          r.id,
          r.accountId,
          r.senderName,
          r.emailCount,
          r.totalSizeBytes,
          r.firstSeen,
          r.lastSeen,
          r.unreadCount,
          r.isNewsletter,
          r.isNotification,
          r.hasListUnsubscribeHeader,
          r.unsubscribeUrl,
          r.confidenceDelete,
          r.suggestedFolder,
          r.category,
          r.sampleSubjects,
          r.updatedAt
        );
      }
    });
    tx(rows);
  }

  listSenderGroups(accountId: string): SyncSenderGroupRow[] {
    return this.db
      .prepare(
        `SELECT id, account_id AS accountId, sender_name AS senderName,
                email_count AS emailCount, total_size_bytes AS totalSizeBytes,
                first_seen AS firstSeen, last_seen AS lastSeen,
                unread_count AS unreadCount,
                is_newsletter AS isNewsletter, is_notification AS isNotification,
                has_list_unsubscribe AS hasListUnsubscribeHeader,
                unsubscribe_url AS unsubscribeUrl,
                confidence_delete AS confidenceDelete,
                suggested_folder AS suggestedFolder, category,
                sample_subjects AS sampleSubjects, updated_at AS updatedAt
         FROM sender_groups WHERE account_id = ?`
      )
      .all(accountId) as SyncSenderGroupRow[];
  }

  /** Wipes sender_groups + folder_suggestions for an account before a re-aggregation pass. */
  clearAggregates(accountId: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sender_groups WHERE account_id = ?').run(accountId);
      this.db
        .prepare('DELETE FROM folder_suggestions WHERE account_id = ?')
        .run(accountId);
    });
    tx();
  }

  /** Wipes the emails table for a fresh sync. */
  clearEmails(accountId: string): void {
    this.db.prepare('DELETE FROM emails WHERE account_id = ?').run(accountId);
  }

  // ─── folder_suggestions ────────────────────────────────────────────
  insertFolderSuggestions(rows: FolderSuggestionRow[]): void {
    if (rows.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO folder_suggestions (
        id, account_id, folder_name, category, reason,
        sender_emails, email_count, confidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((batch: FolderSuggestionRow[]) => {
      for (const r of batch) {
        stmt.run(
          r.id,
          r.accountId,
          r.folderName,
          r.category,
          r.reason,
          r.senderEmails,
          r.emailCount,
          r.confidence,
          r.createdAt
        );
      }
    });
    tx(rows);
  }

  listFolderSuggestions(accountId: string): FolderSuggestionRow[] {
    return this.db
      .prepare(
        `SELECT id, account_id AS accountId, folder_name AS folderName,
                category, reason, sender_emails AS senderEmails,
                email_count AS emailCount, confidence, created_at AS createdAt
         FROM folder_suggestions WHERE account_id = ?
         ORDER BY confidence DESC, email_count DESC`
      )
      .all(accountId) as FolderSuggestionRow[];
  }

  // ─── sync_state ────────────────────────────────────────────────────
  getSyncState(accountId: string): SyncStateRow | null {
    const row = this.db
      .prepare(
        `SELECT account_id AS accountId, range_preset AS rangePreset, cursor,
                stage, emails_fetched AS emailsFetched, started_at AS startedAt,
                completed_at AS completedAt, sync_version AS syncVersion
         FROM sync_state WHERE account_id = ?`
      )
      .get(accountId) as SyncStateRow | undefined;
    return row ?? null;
  }

  upsertSyncState(row: SyncStateRow): void {
    this.db
      .prepare(
        `INSERT INTO sync_state
          (account_id, range_preset, cursor, stage, emails_fetched,
           started_at, completed_at, sync_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           range_preset    = excluded.range_preset,
           cursor          = excluded.cursor,
           stage           = excluded.stage,
           emails_fetched  = excluded.emails_fetched,
           completed_at    = excluded.completed_at,
           sync_version    = excluded.sync_version`
      )
      .run(
        row.accountId,
        row.rangePreset,
        row.cursor,
        row.stage,
        row.emailsFetched,
        row.startedAt,
        row.completedAt,
        row.syncVersion
      );
  }

  /** Cheap cursor save used between API pages — avoids touching `started_at`. */
  setCursor(accountId: string, cursor: string | null, emailsFetched: number, stage: number): void {
    this.db
      .prepare(
        `UPDATE sync_state SET cursor = ?, emails_fetched = ?, stage = ?
         WHERE account_id = ?`
      )
      .run(cursor, emailsFetched, stage, accountId);
  }

  finalizeSync(accountId: string, completedAt: number): void {
    this.db
      .prepare(
        `UPDATE sync_state SET cursor = NULL, completed_at = ? WHERE account_id = ?`
      )
      .run(completedAt, accountId);
  }

  // ─── suggestions / suggestion_groups (intelligence engine) ────────
  /**
   * Replaces ACTIVE suggestions for an account in one transaction. We
   * preserve any user-applied or user-dismissed rows so the "Applied"/
   * "Dismissed" history tabs continue to reflect history. Active rows
   * are recomputed from scratch every analysis pass.
   */
  replaceActiveSuggestions(accountId: string, rows: SuggestionRow[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO suggestions (
        id, account_id, type, group_type, priority, confidence,
        title, description, action_label, action_type, action_payload,
        affected_count, affected_senders, size_bytes, source,
        created_at, dismissed_at, applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `);
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `DELETE FROM suggestions
           WHERE account_id = ? AND dismissed_at IS NULL AND applied_at IS NULL`
        )
        .run(accountId);
      for (const r of rows) {
        stmt.run(
          r.id,
          r.accountId,
          r.type,
          r.groupType,
          r.priority,
          r.confidence,
          r.title,
          r.description,
          r.actionLabel,
          r.actionType,
          r.actionPayload,
          r.affectedCount,
          r.affectedSenders,
          r.sizeBytes,
          r.source,
          r.createdAt
        );
      }
    });
    tx();
  }

  replaceSuggestionGroups(accountId: string, rows: SuggestionGroupRow[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO suggestion_groups (
        id, account_id, group_type, title, total_affected,
        total_size_bytes, suggestion_ids, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM suggestion_groups WHERE account_id = ?').run(accountId);
      for (const r of rows) {
        stmt.run(
          r.id,
          r.accountId,
          r.groupType,
          r.title,
          r.totalAffected,
          r.totalSizeBytes,
          r.suggestionIds,
          r.priority,
          r.createdAt
        );
      }
    });
    tx();
  }

  listSuggestions(
    accountId: string,
    filter: { status?: 'active' | 'applied' | 'dismissed' | 'all'; minConfidence?: number } = {}
  ): SuggestionRow[] {
    const status = filter.status ?? 'active';
    const minConfidence = filter.minConfidence ?? 0;
    let where = 'account_id = ? AND confidence >= ?';
    const params: (string | number)[] = [accountId, minConfidence];
    if (status === 'active') where += ' AND dismissed_at IS NULL AND applied_at IS NULL';
    else if (status === 'dismissed') where += ' AND dismissed_at IS NOT NULL';
    else if (status === 'applied') where += ' AND applied_at IS NOT NULL';
    return this.db
      .prepare(
        `SELECT id, account_id AS accountId, type, group_type AS groupType,
                priority, confidence, title, description,
                action_label AS actionLabel, action_type AS actionType,
                action_payload AS actionPayload, affected_count AS affectedCount,
                affected_senders AS affectedSenders, size_bytes AS sizeBytes,
                source, created_at AS createdAt,
                dismissed_at AS dismissedAt, applied_at AS appliedAt
         FROM suggestions WHERE ${where}
         ORDER BY priority ASC, confidence DESC, created_at DESC`
      )
      .all(...params) as SuggestionRow[];
  }

  getSuggestion(id: string): SuggestionRow | null {
    const r = this.db
      .prepare(
        `SELECT id, account_id AS accountId, type, group_type AS groupType,
                priority, confidence, title, description,
                action_label AS actionLabel, action_type AS actionType,
                action_payload AS actionPayload, affected_count AS affectedCount,
                affected_senders AS affectedSenders, size_bytes AS sizeBytes,
                source, created_at AS createdAt,
                dismissed_at AS dismissedAt, applied_at AS appliedAt
         FROM suggestions WHERE id = ?`
      )
      .get(id) as SuggestionRow | undefined;
    return r ?? null;
  }

  listSuggestionGroups(accountId: string): SuggestionGroupRow[] {
    return this.db
      .prepare(
        `SELECT id, account_id AS accountId, group_type AS groupType,
                title, total_affected AS totalAffected,
                total_size_bytes AS totalSizeBytes,
                suggestion_ids AS suggestionIds, priority,
                created_at AS createdAt
         FROM suggestion_groups WHERE account_id = ?
         ORDER BY priority ASC, total_size_bytes DESC`
      )
      .all(accountId) as SuggestionGroupRow[];
  }

  dismissSuggestion(id: string, at: number = Date.now()): void {
    this.db.prepare('UPDATE suggestions SET dismissed_at = ? WHERE id = ?').run(at, id);
  }

  undismissSuggestion(id: string): void {
    this.db.prepare('UPDATE suggestions SET dismissed_at = NULL WHERE id = ?').run(id);
  }

  markSuggestionApplied(id: string, at: number = Date.now()): void {
    this.db.prepare('UPDATE suggestions SET applied_at = ? WHERE id = ?').run(at, id);
  }

  // ─── Read APIs used by analyzers (in-worker) and main process ─────
  /** Used by Analyzer 6 + the Inbox-clutter analyzer to find big / old emails. */
  listEmailsForAnalyzer(
    accountId: string,
    where: 'all' | 'inbox' | 'junk' = 'all',
    minBytes = 0
  ): Array<{
    id: string;
    senderEmail: string;
    senderName: string | null;
    subject: string | null;
    receivedAt: number;
    sizeBytes: number;
    folderId: string | null;
    isRead: number;
    isNewsletter: number;
    hasListUnsubscribe: number;
  }> {
    const folderClause =
      where === 'inbox'
        ? "AND (folder_id = 'INBOX' OR folder_id IS NULL OR LOWER(folder_id) LIKE '%inbox%')"
        : where === 'junk'
        ? "AND (LOWER(folder_id) LIKE '%junk%' OR LOWER(folder_id) LIKE '%spam%')"
        : '';
    return this.db
      .prepare(
        `SELECT id, sender_email AS senderEmail, sender_name AS senderName, subject,
                received_at AS receivedAt, size_bytes AS sizeBytes,
                folder_id AS folderId, is_read AS isRead,
                is_newsletter AS isNewsletter,
                has_list_unsubscribe AS hasListUnsubscribe
         FROM emails WHERE account_id = ? AND size_bytes >= ? ${folderClause}`
      )
      .all(accountId, minBytes) as Array<{
        id: string;
        senderEmail: string;
        senderName: string | null;
        subject: string | null;
        receivedAt: number;
        sizeBytes: number;
        folderId: string | null;
        isRead: number;
        isNewsletter: number;
        hasListUnsubscribe: number;
      }>;
  }

  /** Dashboard aggregates — emails table. */
  getEmailTotals(accountId: string): { count: number; bytes: number } {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
         FROM emails WHERE account_id = ?`
      )
      .get(accountId) as { count: number; bytes: number };
    return { count: r?.count ?? 0, bytes: r?.bytes ?? 0 };
  }

  countEmailsReceivedSince(accountId: string, since: number): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM emails WHERE account_id = ? AND received_at >= ?`
      )
      .get(accountId, since) as { c: number };
    return r?.c ?? 0;
  }

  countEmailsReceivedBetween(
    accountId: string,
    from: number,
    to: number
  ): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM emails
         WHERE account_id = ? AND received_at >= ? AND received_at < ?`
      )
      .get(accountId, from, to) as { c: number };
    return r?.c ?? 0;
  }

  emailsByCategory(accountId: string): Array<{ category: string; count: number; bytes: number }> {
    return this.db
      .prepare(
        `SELECT COALESCE(sg.category, 'other') AS category,
                COUNT(*) AS count,
                COALESCE(SUM(e.size_bytes), 0) AS bytes
         FROM emails e
         LEFT JOIN sender_groups sg
           ON e.sender_email = sg.id AND e.account_id = sg.account_id
         WHERE e.account_id = ?
         GROUP BY category`
      )
      .all(accountId) as Array<{ category: string; count: number; bytes: number }>;
  }

  emailsByCategorySince(
    accountId: string,
    since: number
  ): Array<{ category: string; count: number; bytes: number }> {
    return this.db
      .prepare(
        `SELECT COALESCE(sg.category, 'other') AS category,
                COUNT(*) AS count,
                COALESCE(SUM(e.size_bytes), 0) AS bytes
         FROM emails e
         LEFT JOIN sender_groups sg
           ON e.sender_email = sg.id AND e.account_id = sg.account_id
         WHERE e.account_id = ? AND e.received_at >= ?
         GROUP BY category`
      )
      .all(accountId, since) as Array<{ category: string; count: number; bytes: number }>;
  }

  emailsByFolder(
    accountId: string,
    newSince: number
  ): Array<{ folderId: string; count: number; newCount: number }> {
    return this.db
      .prepare(
        `SELECT COALESCE(folder_id, 'INBOX') AS folderId,
                COUNT(*) AS count,
                SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) AS newCount
         FROM emails WHERE account_id = ?
         GROUP BY folder_id`
      )
      .all(newSince, accountId) as Array<{ folderId: string; count: number; newCount: number }>;
  }

  countDeletableSenders(accountId: string): { count: number; bytes: number } {
    const r = this.db
      .prepare(
        `SELECT COALESCE(SUM(email_count), 0) AS count,
                COALESCE(SUM(total_size_bytes), 0) AS bytes
         FROM sender_groups
         WHERE account_id = ? AND confidence_delete >= 1`
      )
      .get(accountId) as { count: number; bytes: number };
    return { count: r?.count ?? 0, bytes: r?.bytes ?? 0 };
  }

  countNewsletterSenders(accountId: string): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM sender_groups
         WHERE account_id = ? AND is_newsletter = 1`
      )
      .get(accountId) as { c: number };
    return r?.c ?? 0;
  }

  countActiveSuggestions(accountId: string, typePrefix?: string): number {
    let sql = `SELECT COUNT(*) AS c FROM suggestions
               WHERE account_id = ? AND dismissed_at IS NULL AND applied_at IS NULL`;
    const params: (string | number)[] = [accountId];
    if (typePrefix) {
      sql += ` AND type LIKE ?`;
      params.push(`${typePrefix}%`);
    }
    const r = this.db.prepare(sql).get(...params) as { c: number };
    return r?.c ?? 0;
  }

  countUnsortedSenders(accountId: string): number {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM sender_groups
         WHERE account_id = ? AND suggested_folder IS NULL AND email_count >= 3`
      )
      .get(accountId) as { c: number };
    return r?.c ?? 0;
  }
}

/** Convenience opener so call sites stay short. */
export function openSyncDb(accountId: string): SyncDb {
  return new SyncDb(dbPathForAccount(accountId));
}

export const SYNC_SCHEMA_VERSION = SYNC_VERSION;
