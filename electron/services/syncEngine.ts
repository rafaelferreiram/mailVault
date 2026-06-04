// Sync engine — main-process side.
//
// This file used to contain the entire 5-stage pipeline running in the main
// process. It is now a thin BRIDGE that:
//
//   1. Spawns a Node `worker_threads` worker per sync (`syncWorker.js`).
//   2. Forwards the worker's progress / completion / error messages to the
//      renderer over the legacy `IPC.SyncProgress` channel (no UI changes
//      needed — backwards compat for Phase 1).
//   3. Services token-refresh requests from the worker (keytar/safeStorage
//      live in main; the worker proxies through us via parentPort).
//   4. Routes user-initiated cancellations to the worker.
//
// The actual pipeline lives in `electron/workers/syncWorker.ts`.

import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';
import {
  IPC,
  type EmailMessage,
  type FetchOptions,
  type FolderSuggestion,
  type LogEntry,
  type LogLevel,
  type SenderCategory,
  type SyncLiveStats,
  type SyncProgressEvent,
  type SyncStage,
  type SyncStageId,
} from '../../shared/types.js';
import { forceRefresh } from './tokenManager.js';
import {
  dbPathForAccount,
  openSyncDb,
  type SyncSenderGroupRow,
} from './syncDb.js';
import { runIntelligence } from './intelligenceEngine.js';
import { broadcast } from './broadcast.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Worker registry ─────────────────────────────────────────────────────
interface ActiveSync {
  worker: Worker;
  syncId: string;
  accountId: string;
  startedAt: number;
  lastStage: number;
  stats: SyncLiveStats;
}

/** All active syncs keyed by syncId. Lets us route CANCEL_SYNC by id. */
const activeSyncs = new Map<string, ActiveSync>();

/** Per-account guard: prevents concurrent syncs for the same account. */
const accountToSyncId = new Map<string, string>();

// Stage labels mirror the renderer's existing SyncStage shape (5 stages).
const STAGE_LABELS: Array<{ id: SyncStageId; label: string }> = [
  { id: 'fetch', label: 'Probing mailbox' },
  { id: 'fetch', label: 'Fetching email metadata' },
  { id: 'group', label: 'Grouping by sender' },
  { id: 'detect', label: 'Analyzing patterns' },
  { id: 'suggest', label: 'Finalizing & indexing' },
];

export function cancelSync(syncId: string) {
  const entry = activeSyncs.get(syncId);
  if (!entry) return;
  try {
    entry.worker.postMessage({ type: 'CANCEL_SYNC' });
  } catch {
    // worker already exiting
  }
}

/**
 * Starts a sync. Returns a syncId that the renderer uses to cancel.
 * The actual fetch + analysis happens in a worker thread.
 */
export async function startSync(
  accountId: string,
  opts: FetchOptions
): Promise<string> {
  // Guard: refuse to start a second concurrent sync for the same account.
  const existing = accountToSyncId.get(accountId);
  if (existing) {
    const stillActive = activeSyncs.get(existing);
    if (stillActive) {
      throw new Error(`A sync is already in progress for ${accountId}`);
    }
    accountToSyncId.delete(accountId);
  }

  const syncId = randomUUID();
  const provider: 'google' | 'microsoft' = accountId.startsWith('google:')
    ? 'google'
    : 'microsoft';
  const range = opts.range ?? { key: '30d' };
  const rangePreset = range.key;
  const dbPath = dbPathForAccount(accountId);

  // Fetch the initial access token from the keychain (main-process only).
  let initialAccessToken: string;
  try {
    initialAccessToken = await forceRefresh(accountId);
  } catch {
    // Refresh failed at start — fall back to the cached one (the worker will
    // still try to refresh on 401, and if even that fails it surfaces a
    // recoverable: false SYNC_ERROR).
    const { getAccessToken } = await import('./tokenManager.js');
    initialAccessToken = await getAccessToken(accountId);
  }

  // Look up resumable cursor in case a previous sync was interrupted.
  let resumeFromCursor: string | null = null;
  let incremental = false;
  try {
    const db = openSyncDb(accountId);
    const state = db.getSyncState(accountId);
    if (state) {
      // Auto-resume if there's an in-progress sync (cursor set, completed_at null).
      if (state.cursor && !state.completedAt) {
        resumeFromCursor = state.cursor;
      } else if (
        state.completedAt &&
        state.rangePreset === rangePreset &&
        opts.range?.key !== 'all'
      ) {
        // Same range → incremental update.
        incremental = true;
      }
    }
    db.close();
  } catch (e) {
    console.warn('[sync] could not read sync_state:', (e as Error).message);
  }

  const workerScript = resolveWorkerScript();
  const worker = new Worker(workerScript, {
    workerData: {
      syncId,
      accountId,
      provider,
      initialAccessToken,
      range,
      rangePreset,
      maxMessages: opts.maxMessages,
      resumeFromCursor,
      incremental,
      dbPath,
    },
    // Helpful for debugging — set `WORKER_INSPECT=1` and Node will pause.
    execArgv: process.env.WORKER_INSPECT ? ['--inspect-brk'] : undefined,
  });

  const stats: SyncLiveStats = {
    emailsFetched: 0,
    sendersDiscovered: 0,
    bytesAccounted: 0,
    newslettersDetected: 0,
    suggestionsBuilt: 0,
  };

  const entry: ActiveSync = {
    worker,
    syncId,
    accountId,
    startedAt: Date.now(),
    lastStage: 1,
    stats,
  };
  activeSyncs.set(syncId, entry);
  accountToSyncId.set(accountId, syncId);

  // Initial event so the renderer's drawer transitions out of "Starting…" state.
  emitProgress({
    syncId,
    accountId,
    stage: stage(1, 0, 'Probing mailbox'),
    stats,
    log: log('info', `Starting sync · range=${rangePreset}${incremental ? ' · incremental' : ''}`),
    done: false,
  });

  worker.on('message', (msg: WorkerMessage) => {
    handleWorkerMessage(entry, msg);
  });
  worker.on('error', (err) => {
    console.error('[sync] worker error:', err);
    emitProgress({
      syncId,
      accountId,
      stage: stage(entry.lastStage, 1, STAGE_LABELS[entry.lastStage - 1]?.label ?? ''),
      stats: entry.stats,
      done: true,
      error: err.message,
      log: log('err', `Sync failed: ${err.message}`),
    });
    cleanup(entry);
  });
  worker.on('exit', (code) => {
    if (code !== 0 && activeSyncs.has(syncId)) {
      // Abnormal exit (worker.terminate() returns 1) — make sure we don't
      // leak a "stuck active" entry. If the renderer never received a final
      // event, surface one now.
      emitProgress({
        syncId,
        accountId,
        stage: stage(entry.lastStage, 1, STAGE_LABELS[entry.lastStage - 1]?.label ?? ''),
        stats: entry.stats,
        done: true,
        error: `Worker exited with code ${code}`,
        log: log('err', `Worker exited unexpectedly (code ${code})`),
      });
    }
    cleanup(entry);
  });

  return syncId;
}

// ─── Worker message handling ─────────────────────────────────────────────
type WorkerMessage =
  | {
      type: 'SYNC_PROGRESS';
      syncId: string;
      accountId: string;
      stage: number;
      stageName: string;
      stageProgress: number;
      totalProgress: number;
      emailsFetched: number;
      sendersFound: number;
      storageMapped: number;
      newslettersDetected: number;
      suggestionsBuilt: number;
      currentAction: string;
      cursor: string | null;
      durationMs: number;
      log: LogEntry;
    }
  | {
      type: 'SYNC_LOG';
      syncId: string;
      accountId: string;
      level: LogLevel;
      message: string;
      ts: number;
    }
  | {
      type: 'SYNC_COMPLETE';
      syncId: string;
      accountId: string;
      summary: {
        totalEmails: number;
        totalSenders: number;
        totalStorage: number;
        newsletters: number;
        suggestions: number;
        durationMs: number;
      };
    }
  | {
      type: 'SYNC_ERROR';
      syncId: string;
      accountId: string;
      error: { code: string; message: string; recoverable: boolean };
    }
  | {
      type: 'TOKEN_REFRESH_REQUEST';
      reqId: string;
      accountId: string;
    };

function handleWorkerMessage(entry: ActiveSync, msg: WorkerMessage) {
  switch (msg.type) {
    case 'SYNC_PROGRESS': {
      entry.lastStage = msg.stage;
      entry.stats = {
        emailsFetched: msg.emailsFetched,
        sendersDiscovered: msg.sendersFound,
        bytesAccounted: msg.storageMapped,
        newslettersDetected: msg.newslettersDetected,
        suggestionsBuilt: msg.suggestionsBuilt,
      };
      emitProgress({
        syncId: entry.syncId,
        accountId: entry.accountId,
        stage: stage(msg.stage, msg.stageProgress / 100, msg.stageName),
        stats: entry.stats,
        log: msg.log,
        done: false,
      });
      break;
    }
    case 'SYNC_LOG': {
      // Log-only ticks don't bump the stage bar — emit with the last known stage.
      emitProgress({
        syncId: entry.syncId,
        accountId: entry.accountId,
        stage: stage(
          entry.lastStage,
          0,
          STAGE_LABELS[entry.lastStage - 1]?.label ?? ''
        ),
        stats: entry.stats,
        log: { ts: msg.ts, level: msg.level, message: msg.message },
        done: false,
      });
      break;
    }
    case 'SYNC_COMPLETE': {
      entry.stats.emailsFetched = msg.summary.totalEmails;
      entry.stats.sendersDiscovered = msg.summary.totalSenders;
      entry.stats.bytesAccounted = msg.summary.totalStorage;
      entry.stats.newslettersDetected = msg.summary.newsletters;
      entry.stats.suggestionsBuilt = msg.summary.suggestions;

      // Backwards-compat: read the freshly-written rows out of SQLite and
      // emit them on the legacy `result` payload so existing UI consumers
      // (InboxCleaner, Dashboard, MovePicker, Rules) keep working without
      // modification. Phase 2 will move these consumers to query the DB
      // directly via dedicated IPC endpoints.
      const { messages, suggestions } = readResultsForLegacyUi(entry.accountId);

      emitProgress({
        syncId: entry.syncId,
        accountId: entry.accountId,
        stage: stage(5, 1, 'Sync complete'),
        stats: entry.stats,
        log: log(
          'ok',
          `Sync complete · ${msg.summary.totalEmails.toLocaleString()} emails, ${msg.summary.totalSenders.toLocaleString()} senders in ${formatDuration(msg.summary.durationMs)}`
        ),
        done: true,
        result: { messages, suggestions },
      });
      cleanup(entry);
      // Kick off the post-sync intelligence pass. It runs in its own worker
      // and emits its own progress events; the renderer subscribes to
      // `intelligence:progress` independently of `sync:progress`.
      try {
        runIntelligence(entry.accountId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[sync] failed to launch intelligence engine:', (e as Error).message);
      }
      // Start live sync after first successful sync completes.
      void Promise.all([import('./liveSyncEngine.js'), import('../store.js')])
        .then(([{ startLiveSyncForAccounts, initLiveSyncEngine }, { storage }]) => {
          initLiveSyncEngine();
          if (storage.getPreferences().liveSync.enabled) {
            const account = storage.listAccounts().find((a: { id: string }) => a.id === entry.accountId);
            if (account) startLiveSyncForAccounts([account]);
          }
        })
        .catch((e) => {
          console.warn('[sync] failed to start live sync:', (e as Error).message);
        });
      break;
    }
    case 'SYNC_ERROR': {
      const isCancel = msg.error.code === 'cancelled';
      emitProgress({
        syncId: entry.syncId,
        accountId: entry.accountId,
        stage: stage(
          entry.lastStage,
          1,
          STAGE_LABELS[entry.lastStage - 1]?.label ?? ''
        ),
        stats: entry.stats,
        done: true,
        error: isCancel ? 'Cancelled' : msg.error.message,
        log: log(
          isCancel ? 'warn' : 'err',
          isCancel
            ? 'Sync cancelled by user'
            : `Sync failed (${msg.error.code}): ${msg.error.message}`
        ),
      });
      cleanup(entry);
      break;
    }
    case 'TOKEN_REFRESH_REQUEST': {
      void handleTokenRefreshRequest(entry, msg.reqId, msg.accountId);
      break;
    }
  }
}

async function handleTokenRefreshRequest(entry: ActiveSync, reqId: string, accountId: string) {
  try {
    const accessToken = await forceRefresh(accountId);
    entry.worker.postMessage({
      type: 'TOKEN_REFRESH_RESPONSE',
      reqId,
      ok: true,
      accessToken,
    });
  } catch (e) {
    entry.worker.postMessage({
      type: 'TOKEN_REFRESH_RESPONSE',
      reqId,
      ok: false,
      error: { code: 'auth_failed', message: (e as Error).message },
    });
  }
}

function cleanup(entry: ActiveSync) {
  activeSyncs.delete(entry.syncId);
  if (accountToSyncId.get(entry.accountId) === entry.syncId) {
    accountToSyncId.delete(entry.accountId);
  }
  // worker.terminate() is fire-and-forget; the worker normally exits on its
  // own after posting SYNC_COMPLETE/ERROR, but terminate ensures we don't
  // leak threads if the worker hangs in an axios timeout, etc.
  void entry.worker.terminate().catch(() => {});
}

// ─── Legacy IPC emitter (matches the existing renderer expectations) ────
function emitProgress(evt: SyncProgressEvent) {
  broadcast(IPC.SyncProgress, evt);
}

function stage(idx: number, progress: number, label?: string): SyncStage {
  const meta = STAGE_LABELS[idx - 1] ?? { id: 'fetch' as SyncStageId, label: '' };
  return {
    id: meta.id,
    index: idx,
    total: STAGE_LABELS.length,
    label: label ?? meta.label,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

function log(level: LogLevel, message: string): LogEntry {
  return { ts: Date.now(), level, message };
}

function formatDuration(ms: number): string {
  if (ms < 1500) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  return `${m.toFixed(1)}m`;
}

function readResultsForLegacyUi(accountId: string): {
  messages: EmailMessage[];
  suggestions: FolderSuggestion[];
} {
  const db = openSyncDb(accountId);
  try {
    const rawEmails = db.getEmailsForUi(accountId, 50_000);
    const messages: EmailMessage[] = rawEmails.map((r) => ({
      id: r.id,
      fromEmail: r.fromEmail,
      fromName: r.fromName,
      subject: r.subject,
      snippet: '',
      receivedAt: r.receivedAt,
      sizeBytes: r.sizeBytes,
      isUnread: r.isUnread,
      hasListUnsubscribe: r.hasListUnsubscribe,
      folder: r.folder,
    }));

    const sgRows = db.listSenderGroups(accountId);
    const sgById = new Map<string, SyncSenderGroupRow>();
    for (const r of sgRows) sgById.set(r.id, r);

    // Build suggestions. The DB stores the senderEmails JSON shape we need.
    const suggestions: FolderSuggestion[] = db
      .listFolderSuggestions(accountId)
      .map((row) => ({
        id: row.id,
        category: (row.category as SenderCategory) || 'other',
        folderName: row.folderName,
        reason: row.reason,
        senders: safeJsonArray(row.senderEmails) as Array<{
          email: string;
          name: string;
          count: number;
          bytes: number;
        }>,
        totalCount: row.emailCount,
        action: 'create_and_move',
      }));
    return { messages, suggestions };
  } finally {
    db.close();
  }
}

function safeJsonArray(s: string): unknown[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Worker-script resolution ────────────────────────────────────────────
function resolveWorkerScript(): string {
  // In dev, vite-plugin-electron writes the bundled main.js next to the
  // worker bundle inside `dist-electron/`. In packaged builds, the same
  // layout is preserved relative to the running main.js.
  const candidate = path.join(__dirname, 'syncWorker.js');
  return candidate;
}

// ─── Graceful shutdown ───────────────────────────────────────────────────
app.on('before-quit', () => {
  for (const entry of activeSyncs.values()) {
    try {
      entry.worker.postMessage({ type: 'CANCEL_SYNC' });
    } catch {
      // ignore
    }
  }
});
