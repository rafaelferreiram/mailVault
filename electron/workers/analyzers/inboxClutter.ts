// Analyzer 7: InboxClutterAnalyzer
//
// Surfaces emails sitting in the Inbox that probably don't belong there:
//   - OLD_UNREAD: never opened, > 6 months old
//   - RECEIPTS_IN_INBOX: financial / order senders living in inbox
//   - SOCIAL_NOTIFICATIONS_IN_INBOX: social senders with high volume
//   - VERY_OLD_EMAILS: read but kept for 3+ years

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  formatBytes,
  matchDomain,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'InboxClutterAnalyzer';

const FINANCE_DOMAINS = [
  'paypal.com',
  'stripe.com',
  'venmo.com',
  'amazon.com',
  'apple.com',
  'amex.com',
  'chase.com',
  'wellsfargo.com',
  'fedex.com',
  'ups.com',
  'usps.com',
];
const SOCIAL_DOMAINS = ['linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com'];

const SIX_MONTHS = 180 * 24 * 3600 * 1000;
const THREE_YEARS = 3 * 365 * 24 * 3600 * 1000;

export const InboxClutterAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const inbox = db.listEmailsForAnalyzer(accountId, 'inbox');
    if (inbox.length === 0) return [];

    const out: RawSuggestion[] = [];

    // ── 1) Old unread ───────────────────────────────────────────────
    const oldUnreadIds: string[] = [];
    let oldUnreadBytes = 0;
    const oldUnreadSenders = new Set<string>();
    const oldUnreadCutoff = ctx.now - SIX_MONTHS;
    for (const e of inbox) {
      if (e.isRead === 0 && e.receivedAt < oldUnreadCutoff) {
        oldUnreadIds.push(e.id);
        oldUnreadBytes += e.sizeBytes;
        oldUnreadSenders.add(e.senderEmail);
      }
    }
    if (oldUnreadIds.length >= 50) {
      out.push({
        type: 'ARCHIVE_OLD',
        groupType: 'cleanup',
        priority: 3,
        confidence: 0.65,
        title: `${oldUnreadIds.length.toLocaleString()} unread emails older than 6 months`,
        description: `Never opened. Archive to clear inbox without deleting them. ${formatBytes(
          oldUnreadBytes
        )}.`,
        actionLabel: 'Archive All',
        actionType: 'archive',
        actionPayload: {
          emailIds: oldUnreadIds,
          senderEmails: [...oldUnreadSenders],
          estimatedCount: oldUnreadIds.length,
          estimatedBytes: oldUnreadBytes,
        },
        affectedCount: oldUnreadIds.length,
        affectedSenders: [...oldUnreadSenders],
        sizeBytes: oldUnreadBytes,
        source: NAME,
        dedupeKey: `ARCHIVE_OLD:unread`,
      });
    }

    // ── 2) Receipts in inbox ────────────────────────────────────────
    const receiptIds: string[] = [];
    let receiptBytes = 0;
    const receiptSenders = new Set<string>();
    for (const e of inbox) {
      if (matchDomain(domainOf(e.senderEmail), FINANCE_DOMAINS)) {
        receiptIds.push(e.id);
        receiptBytes += e.sizeBytes;
        receiptSenders.add(e.senderEmail);
      }
    }
    if (receiptIds.length >= 10) {
      const topSendersList = [...receiptSenders]
        .slice(0, 3)
        .map((s) => domainOf(s))
        .filter(Boolean);
      out.push({
        type: 'MOVE_FROM_INBOX',
        groupType: 'organize',
        priority: 3,
        confidence: clamp01(0.5 + Math.min(0.4, receiptIds.length / 200)),
        title: `${receiptIds.length} receipts sitting in your inbox`,
        description: `Orders / payments from ${topSendersList.join(', ')}${
          receiptSenders.size > 3 ? ` and ${receiptSenders.size - 3} others` : ''
        }. Move to a Receipts folder.`,
        actionLabel: 'Move to Receipts',
        actionType: 'create_folder_and_move',
        actionPayload: {
          folderName: 'Receipts',
          folderColor: 'amber',
          emailIds: receiptIds,
          senderEmails: [...receiptSenders],
          estimatedCount: receiptIds.length,
          estimatedBytes: receiptBytes,
        },
        affectedCount: receiptIds.length,
        affectedSenders: [...receiptSenders],
        sizeBytes: receiptBytes,
        source: NAME,
        dedupeKey: `MOVE_FROM_INBOX:receipts`,
      });
    }

    // ── 3) Social notifications in inbox ────────────────────────────
    const socialIds: string[] = [];
    let socialBytes = 0;
    const socialSenders = new Set<string>();
    for (const e of inbox) {
      if (matchDomain(domainOf(e.senderEmail), SOCIAL_DOMAINS)) {
        socialIds.push(e.id);
        socialBytes += e.sizeBytes;
        socialSenders.add(e.senderEmail);
      }
    }
    if (socialIds.length >= 10) {
      out.push({
        type: 'MOVE_FROM_INBOX',
        groupType: 'organize',
        priority: 3,
        confidence: 0.6,
        title: `Social notifications in inbox (${socialIds.length})`,
        description: `Move ${socialIds.length} from ${socialSenders.size} senders out of the inbox.`,
        actionLabel: 'Move to Social',
        actionType: 'create_folder_and_move',
        actionPayload: {
          folderName: 'Social',
          folderColor: 'pink',
          emailIds: socialIds,
          senderEmails: [...socialSenders],
          estimatedCount: socialIds.length,
          estimatedBytes: socialBytes,
        },
        affectedCount: socialIds.length,
        affectedSenders: [...socialSenders],
        sizeBytes: socialBytes,
        source: NAME,
        dedupeKey: `MOVE_FROM_INBOX:social`,
      });
    }

    // ── 4) Very old read emails ─────────────────────────────────────
    const veryOldIds: string[] = [];
    let veryOldBytes = 0;
    const veryOldSenders = new Set<string>();
    const veryOldCutoff = ctx.now - THREE_YEARS;
    for (const e of inbox) {
      if (e.isRead === 1 && e.receivedAt < veryOldCutoff) {
        veryOldIds.push(e.id);
        veryOldBytes += e.sizeBytes;
        veryOldSenders.add(e.senderEmail);
      }
    }
    if (veryOldIds.length >= 100) {
      out.push({
        type: 'ARCHIVE_OLD',
        groupType: 'cleanup',
        priority: 4,
        confidence: 0.55,
        title: `${veryOldIds.length.toLocaleString()} emails older than 3 years`,
        description: `Read and kept, but probably no longer relevant. ${formatBytes(
          veryOldBytes
        )} freed by archiving.`,
        actionLabel: 'Archive',
        actionType: 'archive',
        actionPayload: {
          emailIds: veryOldIds,
          senderEmails: [...veryOldSenders],
          estimatedCount: veryOldIds.length,
          estimatedBytes: veryOldBytes,
        },
        affectedCount: veryOldIds.length,
        affectedSenders: [...veryOldSenders],
        sizeBytes: veryOldBytes,
        source: NAME,
        dedupeKey: `ARCHIVE_OLD:3-years`,
      });
    }

    return out;
  },
};
