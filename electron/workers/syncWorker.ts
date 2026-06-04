// MailVault sync worker — runs the entire 5-stage pipeline in a Node
// worker_threads thread. The main process spawns this with `workerData`
// containing everything needed to do its job (account id, tokens, range,
// db path, range preset). All I/O goes through:
//
//   - HTTPS to Gmail / Microsoft Graph (via worker-safe fetcher classes)
//   - SQLite (via better-sqlite3 — opens its own handle in this thread)
//   - parentPort.postMessage for progress / completion / errors / token refresh
//
// The worker must NEVER import Electron, keytar, or electron-store: those are
// not available in worker threads. Token refreshes go through `requestTokenRefresh`
// which round-trips to the main process.

import { parentPort, workerData } from 'node:worker_threads';
import { SyncDb, type SyncEmailRow, type SyncSenderGroupRow, type FolderSuggestionRow } from '../services/syncDb.js';
import { GmailFetcher } from './clients/gmailFetch.js';
import { GraphFetcher } from './clients/microsoftFetch.js';
import { ConcurrencyPool, sleep } from './backoff.js';
import {
  onCancel as registerCancelHandler,
  postMain,
  requestTokenRefresh,
  TokenRefreshError,
} from './proxy.js';
import type { TimeRange } from '../../shared/types.js';

if (!parentPort) {
  throw new Error('syncWorker must be run as a Node worker thread');
}

interface WorkerInput {
  syncId: string;
  accountId: string;
  provider: 'google' | 'microsoft';
  initialAccessToken: string;
  range: TimeRange;
  rangePreset: string;
  maxMessages?: number;
  resumeFromCursor: string | null;
  /** When true, skip stage 1 probe and only fetch ids newer than maxReceivedAt. */
  incremental: boolean;
  dbPath: string;
  /** UNIX path to the per-account SQLite (already created by main if needed). */
}

const data = workerData as WorkerInput;

// ─── Cancellation ─────────────────────────────────────────────────────
const abort = new AbortController();
let cancelled = false;
registerCancelHandler(() => {
  cancelled = true;
  abort.abort();
  log('warn', 'Cancellation requested');
});

// ─── Live token cache (refreshed on demand via parentPort) ────────────
let currentAccessToken = data.initialAccessToken;
let lastRefreshAt = 0;

async function getToken(): Promise<string> {
  return currentAccessToken;
}

async function refreshToken(): Promise<string> {
  // Coalesce refreshes — if multiple callers race, all wait for the same one.
  const now = Date.now();
  if (now - lastRefreshAt < 1500) {
    return currentAccessToken;
  }
  lastRefreshAt = now;
  try {
    currentAccessToken = await requestTokenRefresh(data.accountId);
    return currentAccessToken;
  } catch (e) {
    if (e instanceof TokenRefreshError) {
      // Re-auth required; abort the sync so the UI can prompt.
      throw e;
    }
    throw e;
  }
}

// ─── Stage definitions (5) ────────────────────────────────────────────
const STAGES: Array<{ name: string; weight: number }> = [
  { name: 'Probing mailbox', weight: 0.05 },
  { name: 'Fetching email metadata', weight: 0.7 },
  { name: 'Grouping by sender', weight: 0.1 },
  { name: 'Analyzing patterns', weight: 0.1 },
  { name: 'Finalizing index', weight: 0.05 },
];

const stats = {
  emailsFetched: 0,
  sendersFound: 0,
  storageMapped: 0,
  newslettersDetected: 0,
  suggestionsBuilt: 0,
};

let totalEstimate = 0;
const startedAt = Date.now();

// ─── Open per-account DB (this thread's own handle) ───────────────────
const db = new SyncDb(data.dbPath);

// ─── Top-level run ────────────────────────────────────────────────────
run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  const code = err instanceof TokenRefreshError ? 'auth_failed' : 'unknown';
  const recoverable = !(err instanceof TokenRefreshError);
  log('err', `Sync failed: ${msg}`);
  postMain({
    type: 'SYNC_ERROR',
    syncId: data.syncId,
    accountId: data.accountId,
    error: { code, message: msg, recoverable },
  });
  closeDb();
});

async function run() {
  if (data.provider === 'google') {
    const gmail = new GmailFetcher(data.accountId, getToken, refreshToken, (line) =>
      log('warn', line)
    );
    await runPipeline(gmail);
  } else {
    const graph = new GraphFetcher(data.accountId, getToken, refreshToken, (line) =>
      log('warn', line)
    );
    await runPipeline(graph);
  }
}

interface ProviderFetcher {
  getProfile(): Promise<{ emailAddress?: string; mail?: string; userPrincipalName?: string; messagesTotal?: number }>;
  probeRange(range: TimeRange): Promise<number>;
  streamMessageIds(
    opts: { range?: TimeRange; afterMs?: number; signal?: AbortSignal },
    initialCursor?: string | null
  ): AsyncGenerator<{ ids: string[]; nextCursor: string | null }>;
  batchGetMetadata(
    ids: string[],
    signal?: AbortSignal
  ): Promise<Array<MetadataRow | null>>;
}

interface MetadataRow {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  receivedAt: number;
  sizeBytes: number;
  isUnread: boolean;
  hasListUnsubscribe: boolean;
  /** Raw List-Unsubscribe header (RFC 2369). Stored alongside the email
   *  and rolled up to sender_groups so analyzers can populate apply payloads. */
  listUnsubscribeValue?: string;
  folderId?: string;
  xMailer?: string;
}

async function runPipeline(fetcher: ProviderFetcher) {
  // Persist a sync_state row so an interrupted sync can resume.
  const existing = db.getSyncState(data.accountId);
  const incremental = data.incremental && !!existing?.completedAt;
  const incrementalAfter = incremental ? db.maxReceivedAt(data.accountId) : 0;

  if (!incremental) {
    // Fresh / resumed sync — clear emails ONLY if not resuming from cursor,
    // and clear aggregates always (we'll rebuild them in stage 3).
    if (!data.resumeFromCursor) {
      db.clearEmails(data.accountId);
    }
    db.clearAggregates(data.accountId);
  }

  // Seed live counters from what's already in the DB. On a resume this lets
  // the progress drawer pick up at the correct percentage instead of jumping
  // back to 0%; on a fresh sync the count is 0 so it's a no-op.
  stats.emailsFetched = db.countEmails(data.accountId);

  db.upsertSyncState({
    accountId: data.accountId,
    rangePreset: data.rangePreset,
    cursor: data.resumeFromCursor,
    stage: 0,
    emailsFetched: stats.emailsFetched,
    startedAt,
    completedAt: null,
    syncVersion: 2,
  });

  // ─── Stage 1: probe ──────────────────────────────────────────────
  reportStage(1, 0, 'Probing mailbox…');
  if (!incremental) {
    try {
      const count = await fetcher.probeRange(data.range);
      totalEstimate = Math.min(count, data.maxMessages ?? Number.MAX_SAFE_INTEGER);
      log(
        'discover',
        `Probed mailbox · ~${totalEstimate.toLocaleString()} emails in range`
      );
    } catch (e) {
      log('warn', `Probe failed (continuing): ${(e as Error).message}`);
      totalEstimate = data.maxMessages ?? 5000;
    }
  } else {
    log('info', 'Incremental sync — skipping probe');
    totalEstimate = data.maxMessages ?? 5000;
  }
  reportStage(1, 1, `Estimated ${totalEstimate.toLocaleString()} emails`);
  if (cancelled) return finalizeCancel();

  // ─── Stage 2: metadata fetch with batched concurrency ────────────
  reportStage(2, 0, `Fetching metadata for ${totalEstimate.toLocaleString()} emails…`);
  await stage2Fetch(fetcher, incrementalAfter);
  if (cancelled) return finalizeCancel();

  // ─── Stage 3: sender grouping (streamed from DB) ─────────────────
  reportStage(3, 0, 'Grouping senders…');
  await stage3Group();
  if (cancelled) return finalizeCancel();

  // ─── Stage 4: intelligence pass ──────────────────────────────────
  reportStage(4, 0, 'Analyzing deletion candidates & storage hogs…');
  await stage4Intelligence();
  if (cancelled) return finalizeCancel();

  // ─── Stage 5: index + finalize ───────────────────────────────────
  reportStage(5, 0, 'Building indexes…');
  db.finalizeIndexes();
  db.finalizeSync(data.accountId, Date.now());
  reportStage(5, 1, 'Sync complete');

  postMain({
    type: 'SYNC_COMPLETE',
    syncId: data.syncId,
    accountId: data.accountId,
    summary: {
      totalEmails: stats.emailsFetched,
      totalSenders: stats.sendersFound,
      totalStorage: stats.storageMapped,
      newsletters: stats.newslettersDetected,
      suggestions: stats.suggestionsBuilt,
      durationMs: Date.now() - startedAt,
    },
  });
  closeDb();
}

// ─── Stage 2 ──────────────────────────────────────────────────────────
async function stage2Fetch(fetcher: ProviderFetcher, incrementalAfter: number) {
  // For Microsoft: stream IDs in pages of 200; persist nextLink as cursor.
  // For Gmail:    stream IDs in pages of 500; persist pageToken as cursor.
  // After each ID page, fan out batch metadata fetches with a 3-way pool.
  const pool = new ConcurrencyPool(3);
  const idStream = fetcher.streamMessageIds(
    {
      range: data.range,
      afterMs: incrementalAfter || undefined,
      signal: abort.signal,
    },
    data.resumeFromCursor ?? null
  );

  const max = data.maxMessages ?? 50_000;
  let totalIdsSeen = 0;
  let lastEmittedAt = 0;

  for await (const page of idStream) {
    if (cancelled) return;
    if (page.ids.length === 0) {
      db.setCursor(data.accountId, page.nextCursor, stats.emailsFetched, 2);
      continue;
    }

    // Slice into provider-specific batch sizes. Gmail = 100, Graph = 20.
    const batchSize = data.provider === 'google' ? 100 : 20;
    const subBatches: string[][] = [];
    for (let i = 0; i < page.ids.length; i += batchSize) {
      subBatches.push(page.ids.slice(i, i + batchSize));
    }

    // Run each sub-batch through the pool (max 3 concurrent batch HTTP calls).
    const tasks = subBatches.map((chunk) =>
      pool.run(async () => {
        if (cancelled) return;
        let rows: Array<MetadataRow | null> = [];
        try {
          rows = await fetcher.batchGetMetadata(chunk, abort.signal);
        } catch (e) {
          // If the entire batch fails non-recoverably, fall through with all-nulls.
          log('warn', `Batch fetch failed: ${(e as Error).message}`);
        }

        // Per-item fallback for sub-request failures (Graph 429s on individual
        // sub-requests don't fail the outer call). For Gmail we just accept
        // the loss — it's rare and the next sync will pick them up.
        if (data.provider === 'microsoft') {
          for (let i = 0; i < rows.length; i += 1) {
            if (rows[i] === null && chunk[i]) {
              const r = await (fetcher as GraphFetcher).getMetadataOne(
                chunk[i],
                abort.signal
              );
              rows[i] = r;
            }
          }
        }

        const emailRows: SyncEmailRow[] = [];
        let chunkBytes = 0;
        for (const r of rows) {
          if (!r) continue;
          if (!r.fromEmail) continue;
          emailRows.push({
            id: r.id,
            accountId: data.accountId,
            senderEmail: r.fromEmail.toLowerCase(),
            senderName: r.fromName || r.fromEmail,
            subject: r.subject || '',
            receivedAt: r.receivedAt,
            sizeBytes: r.sizeBytes || 0,
            folderId: r.folderId ?? null,
            isRead: r.isUnread ? 0 : 1,
            isNewsletter: 0,
            hasListUnsubscribe: r.hasListUnsubscribe ? 1 : 0,
            listUnsubscribeValue: r.listUnsubscribeValue ?? null,
            fetchedAt: Date.now(),
          });
          chunkBytes += r.sizeBytes || 0;
        }
        const written = db.insertEmails(emailRows);
        stats.emailsFetched += written;
        // Only accumulate bytes for rows we actually inserted, otherwise
        // resumed syncs double-count IDs already present in the DB.
        if (emailRows.length > 0) {
          const ratio = written / emailRows.length;
          stats.storageMapped += Math.round(chunkBytes * ratio);
        }

        // Throttled progress (UI rendering cap ~ 2 Hz).
        const now = Date.now();
        if (now - lastEmittedAt > 500 || stats.emailsFetched % 2000 === 0) {
          lastEmittedAt = now;
          const pct =
            totalEstimate > 0
              ? Math.min(0.99, stats.emailsFetched / totalEstimate)
              : Math.min(0.99, stats.emailsFetched / Math.max(1, max));
          reportStage(
            2,
            pct,
            `Fetched ${stats.emailsFetched.toLocaleString()} of ~${totalEstimate.toLocaleString()} emails`
          );
        }
      })
    );

    await Promise.all(tasks);
    // Pace between ID pages — gives the server breathing room and helps us
    // stay under provider quotas (Google: 250 units/s, Graph: 10k/10min).
    await sleep(100, abort.signal);

    db.setCursor(data.accountId, page.nextCursor, stats.emailsFetched, 2);
    totalIdsSeen += page.ids.length;
    if (totalIdsSeen >= max) break;
    if (cancelled) return;
  }

  reportStage(2, 1, `Fetched ${stats.emailsFetched.toLocaleString()} emails`);
}

// ─── Stage 3 ──────────────────────────────────────────────────────────
function stage3Group() {
  const totalEmails = db.countEmails(data.accountId);
  if (totalEmails === 0) {
    log('warn', 'No emails to group');
    return;
  }

  const groups = new Map<
    string,
    {
      id: string;
      senderName: string;
      count: number;
      bytes: number;
      first: number;
      last: number;
      unread: number;
      hasUnsub: boolean;
      /** Most recent (by receivedAt) https/http URL we extracted from a
       *  List-Unsubscribe header. Null when none of this sender's mail had one
       *  or all values were mailto-only. Closes audit P0-2. */
      unsubscribeUrl: string | null;
      unsubscribeUrlAt: number;
      isNotification: boolean;
      subjects: string[];
    }
  >();

  let processed = 0;
  for (const chunk of db.streamEmails(data.accountId, 1000)) {
    if (cancelled) return;
    for (const row of chunk) {
      const key = normalizeSender(row.senderEmail);
      let g = groups.get(key);
      if (!g) {
        g = {
          id: key,
          senderName: row.senderName || key,
          count: 0,
          bytes: 0,
          first: row.receivedAt,
          last: row.receivedAt,
          unread: 0,
          hasUnsub: false,
          unsubscribeUrl: null,
          unsubscribeUrlAt: 0,
          isNotification: detectNotification(key),
          subjects: [],
        };
        groups.set(key, g);
      }
      g.count += 1;
      g.bytes += row.sizeBytes;
      if (row.receivedAt < g.first) g.first = row.receivedAt;
      if (row.receivedAt > g.last) g.last = row.receivedAt;
      if (row.isRead === 0) g.unread += 1;
      if (row.hasListUnsubscribe === 1) g.hasUnsub = true;
      if (row.listUnsubscribeValue && row.receivedAt >= g.unsubscribeUrlAt) {
        const url = extractUnsubscribeHttpUrl(row.listUnsubscribeValue);
        if (url) {
          g.unsubscribeUrl = url;
          g.unsubscribeUrlAt = row.receivedAt;
        }
      }
      if (row.subject && g.subjects.length < 5) g.subjects.push(row.subject);
      // Prefer real display names over the raw email when available.
      if (row.senderName && !row.senderName.includes('@')) g.senderName = row.senderName;
    }
    processed += chunk.length;
    if (processed % 5000 === 0 || processed === totalEmails) {
      const pct = processed / totalEmails;
      reportStage(
        3,
        pct,
        `Grouped ${processed.toLocaleString()} of ${totalEmails.toLocaleString()} emails`
      );
    }
  }

  // Detect newsletters across the full grouped set; flag emails table too so
  // future queries don't have to re-derive it.
  const senderRows: SyncSenderGroupRow[] = [];
  let newsletters = 0;
  for (const g of groups.values()) {
    const isNewsletter = isNewsletterGroup(g);
    if (isNewsletter) newsletters += 1;
    senderRows.push({
      id: g.id,
      accountId: data.accountId,
      senderName: g.senderName,
      emailCount: g.count,
      totalSizeBytes: g.bytes,
      firstSeen: g.first,
      lastSeen: g.last,
      unreadCount: g.unread,
      isNewsletter: isNewsletter ? 1 : 0,
      isNotification: g.isNotification ? 1 : 0,
      hasListUnsubscribeHeader: g.hasUnsub ? 1 : 0,
      unsubscribeUrl: g.unsubscribeUrl,
      confidenceDelete: 0,
      suggestedFolder: null,
      category: null,
      sampleSubjects: JSON.stringify(g.subjects.slice(0, 5)),
      updatedAt: Date.now(),
    });
  }
  db.upsertSenderGroups(senderRows);
  stats.sendersFound = groups.size;
  stats.newslettersDetected = newsletters;
  reportStage(3, 1, `Grouped into ${groups.size.toLocaleString()} senders · ${newsletters} newsletters`);
}

// ─── Stage 4 ──────────────────────────────────────────────────────────
function stage4Intelligence() {
  const groups = db.listSenderGroups(data.accountId);
  if (groups.length === 0) {
    log('warn', 'No sender groups to analyze');
    return;
  }

  const now = Date.now();
  const _90d = now - 90 * 24 * 3600 * 1000;
  const _180d = now - 180 * 24 * 3600 * 1000;

  // Re-classify with confidence + suggested folder, then re-upsert.
  const updated: SyncSenderGroupRow[] = [];
  for (const g of groups) {
    const category = categorize(g.id, JSON.parse(g.sampleSubjects || '[]'));
    let confidence: 0 | 1 | 2 = 0;
    if (g.isNewsletter === 1 && g.lastSeen < _90d && g.emailCount > 10) {
      confidence = 2;
    } else if (g.emailCount > 50 && g.lastSeen < _180d) {
      confidence = 1;
    }
    const suggested = SUGGESTED_FOLDER_MAP[category] ?? null;
    updated.push({ ...g, category, confidenceDelete: confidence, suggestedFolder: suggested });
  }
  db.upsertSenderGroups(updated);

  // Build folder suggestions: cluster senders by suggested folder.
  const buckets = new Map<string, SyncSenderGroupRow[]>();
  for (const g of updated) {
    if (!g.suggestedFolder) continue;
    const arr = buckets.get(g.suggestedFolder) ?? [];
    arr.push(g);
    buckets.set(g.suggestedFolder, arr);
  }

  const fsRows: FolderSuggestionRow[] = [];
  for (const [folderName, gs] of buckets) {
    const total = gs.reduce((s, g) => s + g.emailCount, 0);
    if (total < 20) continue; // skip noise
    const top = gs.slice().sort((a, b) => b.emailCount - a.emailCount)[0];
    const senders = gs
      .slice()
      .sort((a, b) => b.emailCount - a.emailCount)
      .slice(0, 12)
      .map((g) => ({
        email: g.id,
        name: g.senderName,
        count: g.emailCount,
        bytes: g.totalSizeBytes,
      }));
    fsRows.push({
      id: `fs-${folderName.replace(/\s+/g, '-').toLowerCase()}-${data.accountId}`,
      accountId: data.accountId,
      folderName,
      category: gs[0].category ?? 'other',
      reason: `${total} emails from ${gs.length} senders · top: ${top.id} (${top.emailCount})`,
      senderEmails: JSON.stringify(senders),
      emailCount: total,
      confidence: Math.min(1, total / 200),
      createdAt: Date.now(),
    });
  }

  // Newsletter consolidation suggestion (always a useful default).
  const allNewsletters = updated.filter((g) => g.isNewsletter === 1);
  if (allNewsletters.length >= 3) {
    const total = allNewsletters.reduce((s, g) => s + g.emailCount, 0);
    fsRows.push({
      id: `fs-newsletters-${data.accountId}`,
      accountId: data.accountId,
      folderName: 'Newsletters',
      category: 'newsletter',
      reason: `${allNewsletters.length} senders with List-Unsubscribe header — promotional / digest pattern`,
      senderEmails: JSON.stringify(
        allNewsletters
          .slice()
          .sort((a, b) => b.emailCount - a.emailCount)
          .slice(0, 20)
          .map((g) => ({
            email: g.id,
            name: g.senderName,
            count: g.emailCount,
            bytes: g.totalSizeBytes,
          }))
      ),
      emailCount: total,
      confidence: Math.min(1, allNewsletters.length / 10),
      createdAt: Date.now(),
    });
  }

  db.insertFolderSuggestions(fsRows);
  stats.suggestionsBuilt = fsRows.length;

  // Top 5 storage hogs — surface in the live log so the user sees it.
  const topHogs = updated
    .slice()
    .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
    .slice(0, 5);
  for (const h of topHogs) {
    log(
      'discover',
      `${h.id} · ${formatBytes(h.totalSizeBytes)} across ${h.emailCount} emails`
    );
  }

  reportStage(4, 1, `${fsRows.length} suggestions · ${countDeletable(updated)} deletable emails`);
}

// ─── Helpers ──────────────────────────────────────────────────────────
function reportStage(stage1Indexed: number, progressInStage: number, currentAction: string) {
  // Compute overall progress from stage weights + per-stage progress.
  let overall = 0;
  for (let i = 0; i < stage1Indexed - 1; i += 1) overall += STAGES[i].weight;
  overall += STAGES[stage1Indexed - 1].weight * Math.max(0, Math.min(1, progressInStage));

  postMain({
    type: 'SYNC_PROGRESS',
    syncId: data.syncId,
    accountId: data.accountId,
    stage: stage1Indexed,
    stageName: STAGES[stage1Indexed - 1].name,
    stageProgress: Math.round(progressInStage * 100),
    totalProgress: Math.round(overall * 100),
    emailsFetched: stats.emailsFetched,
    sendersFound: stats.sendersFound,
    storageMapped: stats.storageMapped,
    newslettersDetected: stats.newslettersDetected,
    suggestionsBuilt: stats.suggestionsBuilt,
    currentAction,
    cursor: db.getSyncState(data.accountId)?.cursor ?? null,
    durationMs: Date.now() - startedAt,
    log: { ts: Date.now(), level: 'info', message: currentAction },
  });
}

function log(level: 'info' | 'discover' | 'warn' | 'ok' | 'err', message: string) {
  postMain({
    type: 'SYNC_LOG',
    syncId: data.syncId,
    accountId: data.accountId,
    level,
    message,
    ts: Date.now(),
  });
}

function finalizeCancel() {
  log('warn', 'Sync cancelled');
  postMain({
    type: 'SYNC_ERROR',
    syncId: data.syncId,
    accountId: data.accountId,
    error: { code: 'cancelled', message: 'Cancelled', recoverable: true },
  });
  closeDb();
}

function closeDb() {
  try {
    db.close();
  } catch {
    // ignore
  }
}

function normalizeSender(email: string): string {
  const e = email.trim().toLowerCase();
  // Gmail-style "+tag" aliases collapse to canonical address.
  const at = e.indexOf('@');
  if (at <= 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const plus = local.indexOf('+');
  const canonicalLocal = plus >= 0 ? local.slice(0, plus) : local;
  return `${canonicalLocal}@${domain}`;
}

const NEWSLETTER_DOMAINS = new Set([
  'mailchimp.com',
  'mailchi.mp',
  'sendgrid.net',
  'klaviyo.com',
  'hubspot.com',
  'campaign-monitor.com',
  'createsend.com',
  'substack.com',
  'beehiiv.com',
  'convertkit.com',
]);

const NOTIFICATION_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'linear.app',
  'notion.so',
  'slack.com',
  'discord.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'medium.com',
  'jira.com',
  'atlassian.net',
]);

function detectNotification(email: string): boolean {
  const at = email.indexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  return NOTIFICATION_DOMAINS.has(domain) || domain.endsWith('.notifications.linkedin.com');
}

/**
 * Pull the first http(s) URL out of a List-Unsubscribe header value.
 * Per RFC 2369 the header is a comma-separated list of `<uri>` segments,
 * typically containing a mailto:, an https:, or both. We prefer https so the
 * suggestion apply can open it in the browser. Returns null if no usable
 * web URL is present (e.g. mailto-only senders).
 */
function extractUnsubscribeHttpUrl(headerValue: string): string | null {
  if (!headerValue) return null;
  const re = /<(https?:\/\/[^>]+)>/i;
  const match = re.exec(headerValue);
  return match ? match[1].trim() : null;
}

function isNewsletterGroup(g: {
  count: number;
  hasUnsub: boolean;
  id: string;
  subjects: string[];
}): boolean {
  if (g.hasUnsub && g.count >= 3) return true;
  const at = g.id.indexOf('@');
  const domain = at >= 0 ? g.id.slice(at + 1) : '';
  if (NEWSLETTER_DOMAINS.has(domain)) return true;
  const subjectBlob = g.subjects.join(' ').toLowerCase();
  if (/(weekly digest|newsletter|unsubscribe|% off|deal of the)/i.test(subjectBlob)) {
    return g.count >= 5;
  }
  return false;
}

const SUGGESTED_FOLDER_MAP: Record<string, string> = {
  newsletter: 'Newsletters',
  transactional: 'Receipts',
  social: 'Social',
  dev: 'Dev Notifications',
  finance: 'Finance',
  shopping: 'Orders & Shipping',
  travel: 'Travel',
};

function categorize(email: string, subjects: string[]): string {
  const at = email.indexOf('@');
  const domain = at >= 0 ? email.slice(at + 1) : '';
  const subjectBlob = subjects.join(' ').toLowerCase();

  if (
    /(github|gitlab|bitbucket|sentry|circleci|pagerduty|datadog|cloudflare|amazonaws)\.[a-z]+$/.test(
      domain
    ) ||
    domain.endsWith('aws.amazon.com')
  ) {
    return 'dev';
  }
  if (
    /(linkedin|twitter|x|facebook|instagram|reddit|youtube|medium)\.[a-z]+$/.test(domain)
  ) {
    return 'social';
  }
  if (
    /(chase|bankofamerica|wellsfargo|paypal|venmo|wise|revolut|stripe|plaid)\.[a-z]+$/.test(
      domain
    ) ||
    /\b(bank|invoice|receipt|statement|payment|payroll|tax|irs)\b/.test(subjectBlob)
  ) {
    return 'finance';
  }
  if (/(amazon|ebay|etsy|shopify|walmart|target|bestbuy|fedex|ups|usps|dhl)\.[a-z]+$/.test(domain)) {
    return 'shopping';
  }
  if (
    /(expedia|booking|airbnb|tripadvisor|united|delta|aa|lyft|uber|hotels)\.[a-z]+$/.test(
      domain
    )
  ) {
    return 'travel';
  }
  if (/(newsletter|digest|weekly|news)/.test(subjectBlob)) return 'newsletter';
  if (/(receipt|order|shipped|delivered|invoice|verification|confirm)/.test(subjectBlob)) {
    return 'transactional';
  }
  return 'other';
}

function countDeletable(rows: SyncSenderGroupRow[]): number {
  return rows.reduce(
    (sum, r) => (r.confidenceDelete > 0 ? sum + r.emailCount : sum),
    0
  );
}

function formatBytes(b: number): string {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(b >= 100 || i === 0 ? 0 : b >= 10 ? 1 : 2)} ${u[i]}`;
}
