// Shared types and helpers used by every analyzer.
//
// Each analyzer is a `(db, accountId, ctx) => RawSuggestion[]` function. The
// worker collects all results, dedupes (same sender+type), filters by
// confidence threshold, and persists to the suggestions table.

import { v4 as uuid } from 'uuid';
import type {
  Suggestion,
  SuggestionActionPayload,
  SuggestionActionType,
  SuggestionGroupType,
  SuggestionType,
} from '../../../shared/types.js';
import type {
  SuggestionRow,
  SuggestionGroupRow,
  SyncDb,
  SyncSenderGroupRow,
} from '../../services/syncDb.js';

export interface AnalyzerContext {
  /** Provider for this account — used by RuleSuggestionAnalyzer to emit gmail vs ms specs. */
  provider: 'google' | 'microsoft';
  /** Wall-clock at start of run; used for "X days ago" arithmetic. */
  now: number;
  /** Existing folder ids for this account (used by Junk + Folder analyzers). */
  knownFolders: Array<{ id: string; name: string; isJunk: boolean; isInbox: boolean }>;
}

export interface RawSuggestion {
  type: SuggestionType;
  groupType: SuggestionGroupType;
  priority: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  title: string;
  description: string;
  actionLabel: string;
  actionType: SuggestionActionType;
  actionPayload: SuggestionActionPayload;
  affectedCount: number;
  affectedSenders: string[];
  sizeBytes: number;
  source: string;
  /**
   * Stable dedupe key: same key → second sighting collapsed. Format
   * convention: `${type}:${primarySender}` (or `:${folderName}` for folder
   * suggestions, `:${analyzerName}-${sender}` otherwise).
   */
  dedupeKey: string;
}

export interface Analyzer {
  name: string;
  run(db: SyncDb, accountId: string, ctx: AnalyzerContext): Promise<RawSuggestion[]>;
}

/** Map a raw suggestion into a persisted Suggestion row. */
export function materialize(raw: RawSuggestion, accountId: string, now: number): Suggestion {
  return {
    id: uuid(),
    accountId,
    type: raw.type,
    groupType: raw.groupType,
    priority: raw.priority,
    confidence: clamp01(raw.confidence),
    title: truncate(raw.title, 60),
    description: truncate(raw.description, 200),
    actionLabel: truncate(raw.actionLabel, 24),
    actionType: raw.actionType,
    actionPayload: raw.actionPayload,
    affectedCount: raw.affectedCount,
    affectedSenders: raw.affectedSenders,
    sizeBytes: raw.sizeBytes,
    createdAt: now,
    dismissedAt: null,
    appliedAt: null,
    source: raw.source,
  };
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function priorityFromConfidence(c: number): 1 | 2 | 3 | 4 | 5 {
  if (c > 0.8) return 1;
  if (c > 0.6) return 2;
  if (c > 0.4) return 3;
  if (c > 0.2) return 4;
  return 5;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function formatBytes(b: number): string {
  if (!b || b < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(b >= 100 || i === 0 ? 0 : b >= 10 ? 1 : 2)} ${u[i]}`;
}

export function daysBetween(a: number, b: number): number {
  return Math.max(0, Math.round((a - b) / (24 * 3600 * 1000)));
}

export function monthsBetween(a: number, b: number): number {
  return Math.max(1, Math.round((a - b) / (30 * 24 * 3600 * 1000)));
}

export function domainOf(email: string): string {
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export function localOf(email: string): string {
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(0, at).toLowerCase() : email.toLowerCase();
}

/** Match a domain against a list, supporting "*.foo.com" wildcards and bare TLD-suffix entries. */
export function matchDomain(domain: string, list: string[]): boolean {
  for (const entry of list) {
    if (entry.includes('*')) {
      const re = new RegExp(
        '^' + entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
      );
      if (re.test(domain)) return true;
    } else if (domain === entry || domain.endsWith('.' + entry)) {
      return true;
    }
  }
  return false;
}

/** Common service / no-reply domain detection for confidence boosting. */
export const SERVICE_DOMAIN_RE =
  /^(noreply|no-reply|do-not-reply|donotreply|notification|notifications|alerts?|updates?|news|info|hello|admin|support|team)\b/;

export function isServiceLocal(local: string): boolean {
  return SERVICE_DOMAIN_RE.test(local);
}

/** Sample a sender row's parsed sample subjects (analyzer-side helper). */
export function parseSubjects(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Format an "X days ago" / "Y years" relative phrase that reads naturally in
 * suggestion descriptions.
 */
export function relTime(now: number, then: number): string {
  const d = Math.max(0, Math.round((now - then) / (24 * 3600 * 1000)));
  if (d < 30) return `${d} day${d === 1 ? '' : 's'}`;
  if (d < 365) {
    const m = Math.round(d / 30);
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  const y = (d / 365).toFixed(1);
  return `${y} year${parseFloat(y) === 1 ? '' : 's'}`;
}

export function rowFromSuggestion(s: Suggestion): SuggestionRow {
  return {
    id: s.id,
    accountId: s.accountId,
    type: s.type,
    groupType: s.groupType,
    priority: s.priority,
    confidence: s.confidence,
    title: s.title,
    description: s.description,
    actionLabel: s.actionLabel,
    actionType: s.actionType,
    actionPayload: JSON.stringify(s.actionPayload ?? {}),
    affectedCount: s.affectedCount,
    affectedSenders: JSON.stringify(s.affectedSenders ?? []),
    sizeBytes: s.sizeBytes,
    source: s.source,
    createdAt: s.createdAt,
    dismissedAt: s.dismissedAt,
    appliedAt: s.appliedAt,
  };
}

export function suggestionFromRow(r: SuggestionRow): Suggestion {
  return {
    id: r.id,
    accountId: r.accountId,
    type: r.type as SuggestionType,
    groupType: r.groupType as SuggestionGroupType,
    priority: clampPriority(r.priority),
    confidence: r.confidence,
    title: r.title,
    description: r.description,
    actionLabel: r.actionLabel,
    actionType: r.actionType as SuggestionActionType,
    actionPayload: safeJsonObject<SuggestionActionPayload>(r.actionPayload, {}),
    affectedCount: r.affectedCount,
    affectedSenders: safeJsonArray<string>(r.affectedSenders),
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt,
    dismissedAt: r.dismissedAt,
    appliedAt: r.appliedAt,
    source: r.source,
  };
}

function clampPriority(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return Math.round(n) as 1 | 2 | 3 | 4 | 5;
}

function safeJsonObject<T>(s: string, fallback: T): T {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonArray<T>(s: string): T[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export type { SyncSenderGroupRow, SuggestionRow, SuggestionGroupRow };
