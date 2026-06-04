// Incoming email analysis for live sync — runs checks in order, stops at first match.

import type {
  BlockedSender,
  EmailMessage,
  LiveSyncAutoActionPrefs,
  MailRule,
  SuggestionActionPayload,
} from '../../../shared/types.js';

export type IncomingDecision =
  | { kind: 'auto'; actionType: string; label: string; payload: SuggestionActionPayload; trigger: string }
  | { kind: 'pending'; actionType: string; label: string; payload: SuggestionActionPayload; trigger: string; priority: 1 | 2 | 3; explanation: string; confidence: number }
  | { kind: 'info'; trigger: string };

const KNOWN_LEGIT_DOMAINS = new Set([
  'stripe.com', 'github.com', 'apple.com', 'amazon.com', 'google.com', 'microsoft.com', 'paypal.com',
]);

const ESP_MAILERS = /mailchimp|sendgrid|constant contact|campaign monitor|mailgun|sparkpost/i;

function domainOf(email: string): string {
  const i = email.lastIndexOf('@');
  return i >= 0 ? email.slice(i + 1).toLowerCase() : email.toLowerCase();
}

function newsletterScore(msg: EmailMessage): number {
  let score = 0;
  if (msg.hasListUnsubscribe) score += 0.4;
  if (ESP_MAILERS.test(msg.snippet || '')) score += 0.2;
  if (/newsletter|digest|weekly|unsubscribe/i.test(msg.subject)) score += 0.2;
  return score;
}

function junkLegitimacyScore(msg: EmailMessage, knownInboxSenders: Set<string>): number {
  const domain = domainOf(msg.fromEmail);
  let score = 0;
  if (KNOWN_LEGIT_DOMAINS.has(domain)) score += 0.5;
  if (knownInboxSenders.has(msg.fromEmail.toLowerCase())) score += 0.3;
  if (msg.receivedAt > Date.now() - 7 * 86400_000) score += 0.2;
  return Math.min(1, score);
}

function suspicionScore(msg: EmailMessage): number {
  let score = 0;
  const domain = domainOf(msg.fromEmail);
  if (/urgent|verify|suspended|act now|winner|bitcoin/i.test(msg.subject)) score += 0.35;
  const brand = ['apple', 'google', 'microsoft', 'amazon', 'paypal'].find((b) =>
    msg.fromName.toLowerCase().includes(b)
  );
  if (brand && !domain.includes(brand.replace(/\s+/g, ''))) score += 0.25;
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(msg.fromEmail.split('@')[0] ?? '')) score += 0.15;
  return Math.min(1, score);
}

function ruleMatches(msg: EmailMessage, rule: MailRule): boolean {
  if (!rule.enabled) return false;
  const from = msg.fromEmail.toLowerCase();
  const fromName = (msg.fromName ?? '').toLowerCase();
  if (rule.senderContains) {
    const needle = rule.senderContains.toLowerCase();
    if (!from.includes(needle) && !fromName.includes(needle)) return false;
  }
  if (rule.fromContains) {
    const needle = rule.fromContains.toLowerCase();
    if (needle.startsWith('@')) {
      if (!from.endsWith(needle) && !from.includes(needle)) return false;
    } else if (!from.includes(needle) && !fromName.includes(needle)) return false;
  }
  if (rule.subjectContains && !msg.subject.toLowerCase().includes(rule.subjectContains.toLowerCase())) {
    return false;
  }
  return !!(
    rule.fromContains ||
    rule.senderContains ||
    rule.subjectContains ||
    rule.bodyContains
  );
}

function isJunkFolder(folder?: string): boolean {
  if (!folder) return false;
  const f = folder.toLowerCase();
  return f.includes('spam') || f.includes('junk') || f === 'SPAM';
}

export function analyzeIncomingEmail(
  msg: EmailMessage,
  ctx: {
    rules: MailRule[];
    blocked: BlockedSender[];
    autoPrefs: LiveSyncAutoActionPrefs;
    knownInboxSenders: Set<string>;
    folderCategories: Map<string, string>;
  }
): IncomingDecision {
  // CHECK 1 — Existing rule match
  for (const rule of ctx.rules) {
    if (!ruleMatches(msg, rule)) continue;
    const label = rule.name ?? 'Apply rule';
    if (rule.moveToFolderId) {
      const payload: SuggestionActionPayload = {
        emailIds: [msg.id],
        senderEmails: [msg.fromEmail],
        destinationFolderId: rule.moveToFolderId,
      };
      if (ctx.autoPrefs.applyExistingRules) {
        return { kind: 'auto', actionType: 'move_folder', label, payload, trigger: 'rule_match' };
      }
      return {
        kind: 'pending',
        actionType: 'move_folder',
        label,
        payload,
        trigger: 'rule_match',
        priority: 2,
        explanation: `This email matches "${rule.name ?? 'your routing rule'}".`,
        confidence: 0.9,
      };
    }
    const payload: SuggestionActionPayload = {
      emailIds: [msg.id],
      senderEmails: [msg.fromEmail],
      ruleSpec: {
        name: rule.name ?? `Rule ${rule.id}`,
        conditions: [
          {
            field: 'from',
            operator: 'contains',
            value: rule.fromContains ?? rule.senderContains ?? msg.fromEmail,
          },
        ],
        actions: rule.delete
          ? [{ type: 'delete' }]
          : rule.archive
            ? [{ type: 'archive' }]
            : [{ type: 'label', target: rule.addLabel }],
      },
    };
    if (ctx.autoPrefs.applyExistingRules) {
      return { kind: 'auto', actionType: 'apply_rule', label, payload, trigger: 'rule_match' };
    }
    return {
      kind: 'pending',
      actionType: 'apply_rule',
      label,
      payload,
      trigger: 'rule_match',
      priority: 2,
      explanation: `This email matches your rule "${rule.name ?? 'unnamed'}".`,
      confidence: 0.85,
    };
  }

  // CHECK 2 — Block list
  if (ctx.blocked.some((b) => b.email.toLowerCase() === msg.fromEmail.toLowerCase())) {
    if (ctx.autoPrefs.blockListedSenders) {
      return {
        kind: 'auto',
        actionType: 'trash',
        label: 'Move blocked sender to trash',
        payload: { emailIds: [msg.id], senderEmails: [msg.fromEmail] },
        trigger: 'block_list',
      };
    }
  }

  // CHECK 3 — Newsletter
  const nScore = newsletterScore(msg);
  if (nScore >= 0.7) {
    const payload: SuggestionActionPayload = {
      emailIds: [msg.id],
      senderEmails: [msg.fromEmail],
      folderName: 'Newsletters',
    };
    if (ctx.autoPrefs.autoArchiveNewsletters) {
      return { kind: 'auto', actionType: 'archive_newsletter', label: 'Archive newsletter', payload, trigger: 'newsletter' };
    }
    return {
      kind: 'pending',
      actionType: 'archive_newsletter',
      label: 'Archive this newsletter?',
      payload,
      trigger: 'newsletter',
      priority: 2,
      explanation: 'This looks like a newsletter based on headers and subject patterns.',
      confidence: nScore,
    };
  }

  // CHECK 4 — Folder suggestion / auto-sort
  const domain = domainOf(msg.fromEmail);
  const folderName = ctx.folderCategories.get(domain);
  if (folderName && ctx.autoPrefs.autoSortKnownSenders) {
    return {
      kind: 'auto',
      actionType: 'move_folder',
      label: `Move to ${folderName}`,
      payload: { emailIds: [msg.id], senderEmails: [msg.fromEmail], folderName },
      trigger: 'folder_sort',
    };
  }

  // CHECK 5 — Junk rescue
  if (isJunkFolder(msg.folder)) {
    const legit = junkLegitimacyScore(msg, ctx.knownInboxSenders);
    if (legit >= 0.8) {
      return {
        kind: 'pending',
        actionType: 'junk_rescue',
        label: 'Move to Inbox',
        payload: {
          emailIds: [msg.id],
          senderEmails: [msg.fromEmail],
          destinationFolder: 'INBOX',
          createRule: true,
          ruleDescription: `Always deliver ${domain} to Inbox`,
        },
        trigger: 'junk_rescue',
        priority: 1,
        explanation: `This email from ${domain} landed in Junk but looks legitimate — you may be missing it.`,
        confidence: legit,
      };
    }
  }

  // CHECK 6 — Suspicious sender (in junk or inbox)
  const sus = suspicionScore(msg);
  if (sus >= 0.7) {
    if (isJunkFolder(msg.folder)) {
      return {
        kind: 'pending',
        actionType: 'block_sender',
        label: 'Block suspicious sender?',
        payload: {
          emailIds: [msg.id],
          blockSenderEmail: msg.fromEmail,
          deleteHistory: false,
        },
        trigger: 'suspicious',
        priority: 1,
        explanation: 'This sender shows phishing-like signals (urgency, brand spoofing, or random address).',
        confidence: sus,
      };
    }
  }

  // CHECK 7 — Informational
  return { kind: 'info', trigger: 'none' };
}
