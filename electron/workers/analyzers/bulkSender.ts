// Analyzer 1: BulkSenderAnalyzer
//
// Surfaces high-volume senders the user likely doesn't need — non-newsletter,
// non-notification senders with lots of old emails. The output is always a
// DELETE_BULK_SENDER suggestion grouped under "cleanup".

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  formatBytes,
  isServiceLocal,
  localOf,
  priorityFromConfidence,
  relTime,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'BulkSenderAnalyzer';

export const BulkSenderAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const all = db.listSenderGroups(accountId);
    const out: RawSuggestion[] = [];

    for (const g of all) {
      if (g.emailCount <= 20) continue;
      if (g.isNewsletter === 1) continue;
      if (g.isNotification === 1) continue;

      const daysSinceLast = Math.max(0, (ctx.now - g.lastSeen) / (24 * 3600 * 1000));
      const sizeMb = g.totalSizeBytes / (1024 * 1024);

      // Base score per spec: count weighted, age weighted, size weighted.
      let score = g.emailCount * 0.4 + (daysSinceLast / 30) * 0.3 + sizeMb * 0.3;

      if (daysSinceLast > 180) score += 0.3;
      if (g.firstSeen && ctx.now - g.firstSeen > 730 * 24 * 3600 * 1000) score += 0.2;
      if (g.emailCount > 100) score += 0.2;
      if (isServiceLocal(localOf(g.id))) score += 0.1;

      // Normalize to 0..1 confidence. The spec uses score/10; in practice
      // most of the score comes from `email_count * 0.4` (1 → 100 emails),
      // so /10 keeps confidence well-distributed across mailboxes.
      const confidence = clamp01(score / 10);
      if (confidence < 0.4) continue; // not interesting enough

      const domain = domainOf(g.id);
      const senderLabel = g.senderName && g.senderName !== g.id ? g.senderName : domain || g.id;
      const ageBlurb = g.lastSeen
        ? `last received ${relTime(ctx.now, g.lastSeen)} ago`
        : 'no recent activity';

      out.push({
        type: 'DELETE_BULK_SENDER',
        groupType: 'cleanup',
        priority: priorityFromConfidence(confidence),
        confidence,
        title: `${g.emailCount.toLocaleString()} emails from ${senderLabel}`,
        description: `${g.emailCount.toLocaleString()} emails since ${
          g.firstSeen ? new Date(g.firstSeen).getFullYear() : '—'
        } · ${formatBytes(g.totalSizeBytes)} · ${ageBlurb}.`,
        actionLabel: 'Review & Delete',
        actionType: 'delete',
        actionPayload: {
          senderEmails: [g.id],
          estimatedCount: g.emailCount,
          estimatedBytes: g.totalSizeBytes,
        },
        affectedCount: g.emailCount,
        affectedSenders: [g.id],
        sizeBytes: g.totalSizeBytes,
        source: NAME,
        dedupeKey: `DELETE_BULK_SENDER:${g.id}`,
      });
    }

    return out;
  },
};
