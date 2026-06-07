// MailVault Intelligence worker — runs the analyzers in parallel against
// the SQLite snapshot left by the sync engine, dedupes / scores / groups the
// raw suggestions, and persists them to the `suggestions` and
// `suggestion_groups` tables. Pure local computation — no API calls.

import { parentPort, workerData } from 'node:worker_threads';
import { v4 as uuid } from 'uuid';
import { SyncDb, type SuggestionRow, type SuggestionGroupRow } from '../services/syncDb.js';
import {
  rowFromSuggestion,
  type AnalyzerContext,
  type RawSuggestion,
} from './analyzers/types.js';
import { BulkSenderAnalyzer } from './analyzers/bulkSender.js';
import { NewsletterAnalyzer } from './analyzers/newsletter.js';
import { JunkRescueAnalyzer } from './analyzers/junkRescue.js';
import { FolderSuggestionAnalyzer } from './analyzers/folderSuggestion.js';
import { RuleSuggestionAnalyzer } from './analyzers/ruleSuggestion.js';
import { LargeAttachmentAnalyzer } from './analyzers/largeAttachment.js';
import { InboxClutterAnalyzer } from './analyzers/inboxClutter.js';
import { SenderTrustAnalyzer } from './analyzers/senderTrust.js';
import { JobOfferAnalyzer } from './analyzers/jobOffer.js';
import type {
  IntelligenceSummary,
  Suggestion,
  SuggestionGroup,
  SuggestionGroupType,
} from '../../shared/types.js';

if (!parentPort) {
  throw new Error('intelligenceWorker must run as a Node worker thread');
}

interface WorkerInput {
  runId: string;
  accountId: string;
  provider: 'google' | 'microsoft';
  dbPath: string;
  /** Folders known to the provider — used by analyzers to skip already-existing folder names. */
  knownFolders: Array<{ id: string; name: string; isJunk: boolean; isInbox: boolean }>;
  /** Confidence cutoff. Suggestions below this are discarded. Default 0.5. */
  minConfidence: number;
}

const data = workerData as WorkerInput;
const startedAt = Date.now();
const db = new SyncDb(data.dbPath);

const ANALYZERS = [
  BulkSenderAnalyzer,
  NewsletterAnalyzer,
  JunkRescueAnalyzer,
  FolderSuggestionAnalyzer,
  RuleSuggestionAnalyzer,
  LargeAttachmentAnalyzer,
  InboxClutterAnalyzer,
  SenderTrustAnalyzer,
  JobOfferAnalyzer,
];

run().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  parentPort?.postMessage({
    type: 'INTELLIGENCE_ERROR',
    runId: data.runId,
    accountId: data.accountId,
    error: { message },
  });
  closeDb();
});

async function run() {
  const ctx: AnalyzerContext = {
    provider: data.provider,
    now: startedAt,
    knownFolders: data.knownFolders ?? [],
  };

  let completed = 0;
  let totalRaw = 0;
  emitProgress(null, completed, totalRaw);

  // Promise.all over all 8 analyzers. They each read SQLite synchronously
  // inside; running them in parallel here lets V8 interleave their JS work
  // and guarantees the worker doesn't block on any single slow one.
  const results = await Promise.all(
    ANALYZERS.map(async (a) => {
      emitProgress(a.name, completed, totalRaw);
      let suggestions: RawSuggestion[] = [];
      try {
        suggestions = await a.run(db, data.accountId, ctx);
      } catch (err) {
        // One bad analyzer shouldn't kill the run — log and continue.
        // eslint-disable-next-line no-console
        console.error(`[intelligence] analyzer "${a.name}" failed:`, err);
      }
      completed += 1;
      totalRaw += suggestions.length;
      emitProgress(a.name, completed, totalRaw);
      return suggestions;
    })
  );

  // Flatten + dedupe by dedupeKey (first-write-wins, but we prefer the higher-
  // confidence one when keys collide — lets a stronger analyzer override a
  // weaker one for the same (sender, type) combination).
  const merged = new Map<string, RawSuggestion>();
  for (const list of results) {
    for (const s of list) {
      if (s.confidence < data.minConfidence) continue;
      const existing = merged.get(s.dedupeKey);
      if (!existing || s.confidence > existing.confidence) {
        merged.set(s.dedupeKey, s);
      }
    }
  }

  // Materialize: assign IDs + timestamps. Sort by priority then confidence
  // so the SuggestionFeed renders the right order without needing a re-sort
  // in the UI.
  const suggestions: Suggestion[] = [...merged.values()]
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    })
    .map((raw) => ({
      id: uuid(),
      accountId: data.accountId,
      type: raw.type,
      groupType: raw.groupType,
      priority: raw.priority,
      confidence: raw.confidence,
      title: raw.title,
      description: raw.description,
      actionLabel: raw.actionLabel,
      actionType: raw.actionType,
      actionPayload: raw.actionPayload,
      affectedCount: raw.affectedCount,
      affectedSenders: raw.affectedSenders,
      sizeBytes: raw.sizeBytes,
      createdAt: startedAt,
      dismissedAt: null,
      appliedAt: null,
      source: raw.source,
    }));

  const rows: SuggestionRow[] = suggestions.map(rowFromSuggestion);
  db.replaceActiveSuggestions(data.accountId, rows);

  // Build group rollups (cleanup / organize / rules / security).
  const groupRows = buildGroupRows(suggestions, data.accountId);
  db.replaceSuggestionGroups(data.accountId, groupRows);

  const summary = buildSummary(suggestions);
  parentPort?.postMessage({
    type: 'INTELLIGENCE_COMPLETE',
    runId: data.runId,
    accountId: data.accountId,
    summary,
  });
  closeDb();
}

function emitProgress(currentAnalyzer: string | null, completed: number, totalRaw: number) {
  parentPort?.postMessage({
    type: 'INTELLIGENCE_PROGRESS',
    runId: data.runId,
    accountId: data.accountId,
    currentAnalyzer,
    analyzersCompleted: completed,
    totalAnalyzers: ANALYZERS.length,
    suggestionsCreated: totalRaw,
    done: false,
  });
}

function buildGroupRows(
  suggestions: Suggestion[],
  accountId: string
): SuggestionGroupRow[] {
  const buckets = new Map<SuggestionGroupType, Suggestion[]>();
  for (const s of suggestions) {
    const arr = buckets.get(s.groupType) ?? [];
    arr.push(s);
    buckets.set(s.groupType, arr);
  }
  const TITLES: Record<SuggestionGroupType, string> = {
    cleanup: 'Cleanup',
    organize: 'Organize',
    rules: 'Rules',
    security: 'Security',
  };
  const out: SuggestionGroupRow[] = [];
  for (const [groupType, items] of buckets) {
    if (items.length === 0) continue;
    const totalAffected = items.reduce((s, i) => s + i.affectedCount, 0);
    const totalSizeBytes = items.reduce((s, i) => s + i.sizeBytes, 0);
    const minPriority = items.reduce<1 | 2 | 3 | 4 | 5>(
      (acc, i) => (i.priority < acc ? i.priority : acc),
      5
    );
    out.push({
      id: `sg-${groupType}-${accountId}`,
      accountId,
      groupType,
      title: TITLES[groupType],
      totalAffected,
      totalSizeBytes,
      suggestionIds: JSON.stringify(items.map((i) => i.id)),
      priority: minPriority,
      createdAt: startedAt,
    });
  }
  return out;
}

function buildSummary(suggestions: Suggestion[]): IntelligenceSummary {
  const byGroup: Record<SuggestionGroupType, number> = {
    cleanup: 0,
    organize: 0,
    rules: 0,
    security: 0,
  };
  const byPriority: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let affected = 0;
  let bytes = 0;
  for (const s of suggestions) {
    byGroup[s.groupType] += 1;
    byPriority[s.priority] += 1;
    affected += s.affectedCount;
    bytes += s.sizeBytes;
  }
  return {
    total: suggestions.length,
    totalAffected: affected,
    totalSizeBytes: bytes,
    byGroup,
    byPriority,
    durationMs: Date.now() - startedAt,
  };
}

function closeDb() {
  try {
    db.close();
  } catch {
    // ignore
  }
}

// Avoid `SuggestionGroup` being unreferenced if we ever stop building groups
// inline — keeps the import accurate for downstream type-checkers.
export type _SuggestionGroupExportTypeOnly = SuggestionGroup;
