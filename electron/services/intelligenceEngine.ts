// Intelligence engine — main-process bridge.
//
// Spawns the intelligence worker with the snapshot from `syncDb`, relays
// progress messages to the renderer, and exposes apply/dismiss/list APIs
// to the renderer via IPC.
//
// `runIntelligence(accountId)` is called automatically after each sync
// completes; the renderer can also trigger it manually via `intelligence:run`.

import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';
import {
  IPC,
  type IntelligenceProgress,
  type IntelligenceSummary,
  type Provider,
} from '../../shared/types.js';
import { dbPathForAccount } from './syncDb.js';
import { GmailClient } from './gmail.js';
import { GraphClient } from './microsoft.js';
import { broadcast } from './broadcast.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ActiveRun {
  worker: Worker;
  runId: string;
  accountId: string;
  provider: Provider;
  startedAt: number;
  analyzersCompleted: number;
  suggestionsCreated: number;
}

const activeByAccount = new Map<string, ActiveRun>();

export function runIntelligence(accountId: string): string {
  // If a run is already in flight for this account, return its id rather
  // than spawning a duplicate. The UI will see the same progress events.
  const existing = activeByAccount.get(accountId);
  if (existing) return existing.runId;

  const provider: Provider = accountId.startsWith('google:') ? 'google' : 'microsoft';
  const runId = randomUUID();
  const dbPath = dbPathForAccount(accountId);
  const workerScript = path.join(__dirname, 'intelligenceWorker.js');

  // Pull a snapshot of folders for this account so the FolderSuggestion +
  // JunkRescue analyzers can avoid suggesting folders that already exist
  // and can identify the Junk folder. We do this in main (not worker) so
  // the worker stays purely local — no API calls.
  void resolveKnownFolders(accountId, provider).then((knownFolders) => {
    const worker = new Worker(workerScript, {
      workerData: {
        runId,
        accountId,
        provider,
        dbPath,
        knownFolders,
        minConfidence: 0.5,
      },
    });

    const entry: ActiveRun = {
      worker,
      runId,
      accountId,
      provider,
      startedAt: Date.now(),
      analyzersCompleted: 0,
      suggestionsCreated: 0,
    };
    activeByAccount.set(accountId, entry);

    // Initial event — UI shows "Analyzing…" the moment intelligence starts.
    emitProgress({
      accountId,
      runId,
      currentAnalyzer: null,
      analyzersCompleted: 0,
      totalAnalyzers: 8,
      suggestionsCreated: 0,
      done: false,
    });

    worker.on('message', (msg: WorkerMessage) => handleWorkerMessage(entry, msg));
    worker.on('error', (err) => {
      emitProgress({
        accountId,
        runId,
        currentAnalyzer: null,
        analyzersCompleted: entry.analyzersCompleted,
        totalAnalyzers: 8,
        suggestionsCreated: entry.suggestionsCreated,
        done: true,
        error: err.message,
      });
      cleanup(entry);
    });
    worker.on('exit', () => {
      // If we never received an explicit complete/error, surface a generic
      // failure so the renderer doesn't dangle in "analyzing" state.
      if (activeByAccount.get(accountId) === entry) {
        emitProgress({
          accountId,
          runId,
          currentAnalyzer: null,
          analyzersCompleted: entry.analyzersCompleted,
          totalAnalyzers: 8,
          suggestionsCreated: entry.suggestionsCreated,
          done: true,
          error: 'Intelligence worker exited unexpectedly',
        });
        cleanup(entry);
      }
    });
  });

  return runId;
}

export function cancelIntelligence(accountId: string) {
  const entry = activeByAccount.get(accountId);
  if (!entry) return;
  void entry.worker.terminate();
  cleanup(entry);
}

// ─── Worker → main message handling ─────────────────────────────────
type WorkerMessage =
  | {
      type: 'INTELLIGENCE_PROGRESS';
      runId: string;
      accountId: string;
      currentAnalyzer: string | null;
      analyzersCompleted: number;
      totalAnalyzers: number;
      suggestionsCreated: number;
      done: boolean;
    }
  | {
      type: 'INTELLIGENCE_COMPLETE';
      runId: string;
      accountId: string;
      summary: IntelligenceSummary;
    }
  | {
      type: 'INTELLIGENCE_ERROR';
      runId: string;
      accountId: string;
      error: { message: string };
    };

function handleWorkerMessage(entry: ActiveRun, msg: WorkerMessage) {
  switch (msg.type) {
    case 'INTELLIGENCE_PROGRESS':
      entry.analyzersCompleted = msg.analyzersCompleted;
      entry.suggestionsCreated = msg.suggestionsCreated;
      emitProgress({
        accountId: entry.accountId,
        runId: entry.runId,
        currentAnalyzer: msg.currentAnalyzer,
        analyzersCompleted: msg.analyzersCompleted,
        totalAnalyzers: msg.totalAnalyzers,
        suggestionsCreated: msg.suggestionsCreated,
        done: false,
      });
      break;

    case 'INTELLIGENCE_COMPLETE':
      emitProgress({
        accountId: entry.accountId,
        runId: entry.runId,
        currentAnalyzer: null,
        analyzersCompleted: 8,
        totalAnalyzers: 8,
        suggestionsCreated: msg.summary.total,
        done: true,
        summary: msg.summary,
      });
      // Fire dedicated complete event too — easier signal for renderer to
      // listen for "should I refetch suggestions now?" without inferring
      // from progress events.
      broadcast(IPC.IntelligenceComplete, {
        accountId: entry.accountId,
        runId: entry.runId,
        summary: msg.summary,
      });
      cleanup(entry);
      break;

    case 'INTELLIGENCE_ERROR':
      emitProgress({
        accountId: entry.accountId,
        runId: entry.runId,
        currentAnalyzer: null,
        analyzersCompleted: entry.analyzersCompleted,
        totalAnalyzers: 8,
        suggestionsCreated: entry.suggestionsCreated,
        done: true,
        error: msg.error.message,
      });
      cleanup(entry);
      break;
  }
}

function cleanup(entry: ActiveRun) {
  if (activeByAccount.get(entry.accountId) === entry) {
    activeByAccount.delete(entry.accountId);
  }
  void entry.worker.terminate().catch(() => {});
}

function emitProgress(p: IntelligenceProgress) {
  broadcast(IPC.IntelligenceProgress, p);
}

// ─── Folder snapshot resolver (uses existing main-side clients) ─────
async function resolveKnownFolders(accountId: string, provider: Provider) {
  try {
    if (provider === 'google') {
      const c = new GmailClient(accountId);
      const labels = await c.listLabels();
      return labels.map((l) => ({
        id: l.id,
        name: l.name,
        isJunk:
          /^spam$/i.test(l.name) || /^junk$/i.test(l.name) || l.id.toUpperCase() === 'SPAM',
        isInbox: l.id.toUpperCase() === 'INBOX',
      }));
    }
    const c = new GraphClient(accountId);
    const folders = await c.listMailFolders();
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      isJunk: /junk|spam/i.test(f.name),
      isInbox: /inbox/i.test(f.name),
    }));
  } catch {
    // If the folder listing fails (e.g. token expired between sync and
    // intelligence) we still want analysis to run — analyzers gracefully
    // degrade with an empty knownFolders array.
    return [];
  }
}

// ─── Graceful shutdown ───────────────────────────────────────────────
app.on('before-quit', () => {
  for (const entry of activeByAccount.values()) {
    void entry.worker.terminate();
  }
});
