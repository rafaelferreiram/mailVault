// Analyzer 2: NewsletterAnalyzer
//
// For senders that look like newsletters (List-Unsubscribe present, ESP X-Mailer,
// known bulk domains, or subject patterns), emit two paired suggestions:
//   1. UNSUBSCRIBE — easy, reversible
//   2. DELETE_NEWSLETTERS — clean up the historical pile
//
// Confidence is derived from the newsletter score (0..1).

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  formatBytes,
  parseSubjects,
  priorityFromConfidence,
  relTime,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'NewsletterAnalyzer';

const KNOWN_NEWSLETTER_DOMAINS = new Set([
  'substack.com',
  'beehiiv.com',
  'mailchimp.com',
  'mailchi.mp',
  'sendgrid.net',
  'klaviyo.com',
  'hubspot.com',
  'campaign-monitor.com',
  'createsend.com',
  'convertkit.com',
  'morningbrew.com',
  'thehustle.co',
  'producthunt.com',
  'medium.com',
]);

const BULK_NAME_RE = /(newsletter|noreply|no-reply|updates|digest|news@)/i;
const BULK_SUBJECT_RE =
  /(unsubscribe|newsletter|digest|weekly|monthly|deals|%\s*off|sale ends|limited offer)/i;

export const NewsletterAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const all = db.listSenderGroups(accountId);
    const out: RawSuggestion[] = [];

    for (const g of all) {
      if (g.emailCount < 3) continue;

      // Build the newsletter score per spec.
      let score = 0;
      const domain = domainOf(g.id);
      const senderName = (g.senderName || '').toLowerCase();
      const subjects = parseSubjects(g.sampleSubjects);
      const subjectBlob = subjects.join(' ').toLowerCase();

      // Note: we don't have X-Mailer in the per-row schema, but the bulk-ESP
      // detection runs at sync time via NEWSLETTER_DOMAINS — so isNewsletter
      // already encodes most of those signals. We treat is_newsletter as a
      // strong base signal and refine with the other heuristics below.
      if (g.hasListUnsubscribeHeader) score += 0.4;
      if (g.isNewsletter === 1) score += 0.3;
      if (BULK_SUBJECT_RE.test(subjectBlob)) score += 0.2;
      if (BULK_NAME_RE.test(senderName)) score += 0.15;
      if (g.emailCount >= 30) score += 0.1;
      if (KNOWN_NEWSLETTER_DOMAINS.has(domain)) score += 0.05;

      if (score < 0.5) continue;
      const confidence = clamp01(score);
      const senderLabel =
        g.senderName && !g.senderName.includes('@') ? g.senderName : domain || g.id;
      const ageBlurb =
        g.lastSeen && ctx.now - g.lastSeen > 90 * 24 * 3600 * 1000
          ? `haven't opened one in ${relTime(ctx.now, g.lastSeen)}`
          : `${g.unreadCount} unread of ${g.emailCount}`;

      // Suggestion 1 — UNSUBSCRIBE (requires a real http(s) URL we can open;
      // mailto-only senders fall through to DELETE_NEWSLETTERS below so we
      // never surface an Unsubscribe button that does nothing).
      if (g.hasListUnsubscribeHeader && g.unsubscribeUrl) {
        out.push({
          type: 'UNSUBSCRIBE',
          groupType: 'cleanup',
          priority: 2,
          confidence,
          title: `Unsubscribe from ${senderLabel} (${g.emailCount})`,
          description: `You subscribed but ${ageBlurb}. One click removes you from the list.`,
          actionLabel: 'Unsubscribe',
          actionType: 'unsubscribe',
          actionPayload: {
            senderEmails: [g.id],
            // Threaded through sync → sender_groups → analyzer → ipc apply,
            // which calls shell.openExternal(unsubscribeUrl). Without this
            // line the apply was a no-op (audit P0-2).
            unsubscribeUrl: g.unsubscribeUrl ?? undefined,
            createRule: true,
            ruleDescription: `Auto-trash future emails from ${g.id}`,
          },
          affectedCount: g.emailCount,
          affectedSenders: [g.id],
          sizeBytes: g.totalSizeBytes,
          source: NAME,
          dedupeKey: `UNSUBSCRIBE:${g.id}`,
        });
      }

      // Suggestion 2 — DELETE_NEWSLETTERS (always; the cleanup is independent of unsubscribing).
      out.push({
        type: 'DELETE_NEWSLETTERS',
        groupType: 'cleanup',
        priority: priorityFromConfidence(confidence),
        confidence,
        title: `Delete ${g.emailCount} ${senderLabel} emails`,
        description: `Frees ${formatBytes(g.totalSizeBytes)}. Past newsletters from a sender you ${
          g.hasListUnsubscribeHeader ? 'can unsubscribe' : 'rarely engage'
        } with.`,
        actionLabel: 'Delete All',
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
        dedupeKey: `DELETE_NEWSLETTERS:${g.id}`,
      });
    }

    return out;
  },
};
