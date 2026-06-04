// Analyzer 6: LargeAttachmentAnalyzer
//
// Two outputs:
//   1. Per-sender clusters of large emails — old, big attachments to clean up.
//   2. Duplicate detection — same sender + subject + size collapsed.
//
// Note: we only have whole-message size, not detached attachment size. The
// heuristic is "size_bytes > 5 MB" which on Graph is dominated by attachment
// fudge anyway; on Gmail size_estimate is a true byte count.

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  formatBytes,
  priorityFromConfidence,
  relTime,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'LargeAttachmentAnalyzer';
const MIN_BYTES = 5 * 1024 * 1024; // 5 MB
const SENDER_GROUP_BYTES = 50 * 1024 * 1024; // 50 MB per sender
const OLDER_THAN_DAYS = 180;

export const LargeAttachmentAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const big = db.listEmailsForAnalyzer(accountId, 'all', MIN_BYTES);
    if (big.length === 0) return [];

    const out: RawSuggestion[] = [];

    // ── 1) Per-sender storage hogs ─────────────────────────────────
    const bySender = new Map<
      string,
      { ids: string[]; totalSize: number; senderName: string | null; latestAt: number; oldestAt: number }
    >();
    for (const e of big) {
      let bucket = bySender.get(e.senderEmail);
      if (!bucket) {
        bucket = {
          ids: [],
          totalSize: 0,
          senderName: e.senderName,
          latestAt: e.receivedAt,
          oldestAt: e.receivedAt,
        };
        bySender.set(e.senderEmail, bucket);
      }
      bucket.ids.push(e.id);
      bucket.totalSize += e.sizeBytes;
      if (e.receivedAt > bucket.latestAt) bucket.latestAt = e.receivedAt;
      if (e.receivedAt < bucket.oldestAt) bucket.oldestAt = e.receivedAt;
    }

    const oldThreshold = ctx.now - OLDER_THAN_DAYS * 24 * 3600 * 1000;
    for (const [sender, info] of bySender) {
      if (info.totalSize < SENDER_GROUP_BYTES) continue;
      if (info.latestAt > oldThreshold) continue; // still active — leave alone

      const senderLabel =
        info.senderName && !info.senderName.includes('@') ? info.senderName : domainOf(sender) || sender;
      const ageRange = `${new Date(info.oldestAt).getFullYear()}–${new Date(info.latestAt).getFullYear()}`;
      const confidence = clamp01(0.55 + Math.min(0.4, info.totalSize / (500 * 1024 * 1024)));

      out.push({
        type: 'DELETE_LARGE_ATTACHMENTS',
        groupType: 'cleanup',
        priority: priorityFromConfidence(confidence),
        confidence,
        title: `${info.ids.length} large attachments — ${formatBytes(info.totalSize)}`,
        description: `From ${senderLabel} · ${ageRange} · last received ${relTime(
          ctx.now,
          info.latestAt
        )} ago.`,
        actionLabel: 'Delete',
        actionType: 'delete',
        actionPayload: {
          emailIds: info.ids,
          senderEmails: [sender],
          estimatedCount: info.ids.length,
          estimatedBytes: info.totalSize,
          notes: 'attachment-cleanup',
        },
        affectedCount: info.ids.length,
        affectedSenders: [sender],
        sizeBytes: info.totalSize,
        source: NAME,
        dedupeKey: `DELETE_LARGE_ATTACHMENTS:${sender}`,
      });
    }

    // ── 2) Duplicate detection ─────────────────────────────────────
    // Group by (sender + subject + size) — exact match implies a re-send or
    // a sync artifact. Only flag when a key has 3+ matches.
    const byKey = new Map<string, { ids: string[]; senderName: string | null; size: number; subject: string }>();
    for (const e of big) {
      const subject = e.subject ?? '';
      const key = `${e.senderEmail}|${subject}|${e.sizeBytes}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = { ids: [], senderName: e.senderName, size: e.sizeBytes, subject };
        byKey.set(key, bucket);
      }
      bucket.ids.push(e.id);
    }

    let dupeBucketCount = 0;
    const allDupeIds: string[] = [];
    let totalDupeSize = 0;
    const dupeSenders = new Set<string>();
    for (const [, bucket] of byKey) {
      if (bucket.ids.length < 3) continue;
      // Keep the most recent, count the rest as dupes.
      const drop = bucket.ids.slice(1);
      allDupeIds.push(...drop);
      totalDupeSize += drop.length * bucket.size;
      dupeBucketCount += 1;
      for (const id of drop) {
        const e = big.find((x) => x.id === id);
        if (e) dupeSenders.add(e.senderEmail);
      }
    }

    if (allDupeIds.length >= 3) {
      out.push({
        type: 'DELETE_DUPLICATES',
        groupType: 'cleanup',
        priority: 3,
        confidence: 0.7,
        title: `${allDupeIds.length} duplicate emails detected`,
        description: `${dupeBucketCount} repeated subjects from ${dupeSenders.size} sender${
          dupeSenders.size === 1 ? '' : 's'
        } — likely sync artifacts or re-sends.`,
        actionLabel: 'Delete Dupes',
        actionType: 'delete',
        actionPayload: {
          emailIds: allDupeIds,
          senderEmails: [...dupeSenders],
          estimatedCount: allDupeIds.length,
          estimatedBytes: totalDupeSize,
          notes: 'duplicate-cleanup',
        },
        affectedCount: allDupeIds.length,
        affectedSenders: [...dupeSenders],
        sizeBytes: totalDupeSize,
        source: NAME,
        dedupeKey: `DELETE_DUPLICATES:${accountId}`,
      });
    }

    return out;
  },
};
