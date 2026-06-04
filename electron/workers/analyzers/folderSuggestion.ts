// Analyzer 4: FolderSuggestionAnalyzer
//
// Two passes:
//   1. Preset categories (Finance, Orders, Travel, Dev, Subscriptions, …) —
//      cluster matching senders into a folder.
//   2. Custom domain clustering — when ≥3 different sender addresses share a
//      domain AND the cluster has ≥20 emails, suggest a folder named after the
//      company (e.g. all *@pinterest.com → "Pinterest" folder).
//
// Suggestions emit BOTH the create-folder action AND the move action in a
// single payload (UI presents it as "Create & Move").

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  matchDomain,
} from './types.js';
import type { SyncDb, SyncSenderGroupRow } from '../../services/syncDb.js';

const NAME = 'FolderSuggestionAnalyzer';

const PRESET_CATEGORIES: Record<string, { color: string; domains: string[] }> = {
  'Finance & Banking': {
    color: 'green',
    domains: [
      'chase.com',
      'wellsfargo.com',
      'bankofamerica.com',
      'citi.com',
      'paypal.com',
      'stripe.com',
      'venmo.com',
      'coinbase.com',
      'turbotax.com',
      'mint.com',
      'robinhood.com',
      'schwab.com',
      'amex.com',
      'discover.com',
      'capitalone.com',
      'ally.com',
      'wise.com',
      'revolut.com',
      'plaid.com',
    ],
  },
  'Orders & Shipping': {
    color: 'amber',
    domains: [
      'amazon.com',
      'amazon.co.uk',
      'fedex.com',
      'ups.com',
      'usps.com',
      'dhl.com',
      'shopify.com',
      'etsy.com',
      'ebay.com',
      'walmart.com',
      'target.com',
      'bestbuy.com',
      'newegg.com',
      'bhphotovideo.com',
    ],
  },
  Travel: {
    color: 'sky',
    domains: [
      'airbnb.com',
      'booking.com',
      'expedia.com',
      'hotels.com',
      'kayak.com',
      'delta.com',
      'united.com',
      'aa.com',
      'southwest.com',
      'lufthansa.com',
      'ryanair.com',
      'uber.com',
      'lyft.com',
      'hyatt.com',
      'marriott.com',
    ],
  },
  'Dev & Work Tools': {
    color: 'violet',
    domains: [
      'github.com',
      'gitlab.com',
      'jira.atlassian.com',
      'atlassian.net',
      'linear.app',
      'notion.so',
      'slack.com',
      'figma.com',
      'vercel.com',
      'render.com',
      'heroku.com',
      'aws.amazon.com',
      'cloud.google.com',
      'sentry.io',
      'datadoghq.com',
      'pagerduty.com',
    ],
  },
  Subscriptions: {
    color: 'rose',
    domains: [
      'netflix.com',
      'spotify.com',
      'apple.com',
      'hulu.com',
      'disney.com',
      'hbo.com',
      'adobe.com',
      'dropbox.com',
      'zoom.us',
      'lastpass.com',
      '1password.com',
      'nytimes.com',
      'wsj.com',
    ],
  },
  'Health & Medical': {
    color: 'emerald',
    domains: [
      'zocdoc.com',
      'cvs.com',
      'walgreens.com',
      'mychart.*',
      'labcorp.com',
      'questdiagnostics.com',
      'kp.org',
    ],
  },
  Social: {
    color: 'pink',
    domains: [
      'linkedin.com',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'meetup.com',
      'eventbrite.com',
      'reddit.com',
      'medium.com',
    ],
  },
  Education: {
    color: 'indigo',
    domains: [
      'coursera.org',
      'udemy.com',
      'edx.org',
      'pluralsight.com',
      'udacity.com',
      'khanacademy.org',
      '*.edu',
    ],
  },
};

export const FolderSuggestionAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const senders = db.listSenderGroups(accountId);
    if (senders.length === 0) return [];

    // Lower-case folder names for the existing-folder check.
    const existing = new Set(
      ctx.knownFolders.map((f) => f.name.toLowerCase().trim())
    );

    const out: RawSuggestion[] = [];

    // ── Pass 1: preset categories ───────────────────────────────────
    for (const [folderName, def] of Object.entries(PRESET_CATEGORIES)) {
      if (existing.has(folderName.toLowerCase())) continue;
      const matched = senders.filter((s) => matchDomain(domainOf(s.id), def.domains));
      if (matched.length < 2) continue;
      const totalEmails = matched.reduce((sum, s) => sum + s.emailCount, 0);
      if (totalEmails < 10) continue;

      const score = totalEmails * 0.5 + matched.length * 10 * 0.5;
      const confidence = clamp01(score / 200);
      out.push(
        buildFolderSuggestion(
          folderName,
          def.color,
          matched,
          confidence,
          'preset',
          ctx
        )
      );
    }

    // ── Pass 2: custom domain clustering ────────────────────────────
    // Find domains with ≥3 different sender addresses and ≥20 emails.
    const byDomain = new Map<string, SyncSenderGroupRow[]>();
    for (const s of senders) {
      const d = domainOf(s.id);
      if (!d) continue;
      // Skip domains already covered by a preset.
      let covered = false;
      for (const def of Object.values(PRESET_CATEGORIES)) {
        if (matchDomain(d, def.domains)) {
          covered = true;
          break;
        }
      }
      if (covered) continue;
      const arr = byDomain.get(d) ?? [];
      arr.push(s);
      byDomain.set(d, arr);
    }

    for (const [domain, group] of byDomain) {
      if (group.length < 3) continue;
      const totalEmails = group.reduce((sum, s) => sum + s.emailCount, 0);
      if (totalEmails < 20) continue;
      const folderName = niceFolderNameFromDomain(domain);
      if (existing.has(folderName.toLowerCase())) continue;
      const confidence = clamp01(0.4 + Math.min(0.5, totalEmails / 400));
      out.push(buildFolderSuggestion(folderName, 'slate', group, confidence, 'custom', ctx));
    }

    return out;
  },
};

function buildFolderSuggestion(
  folderName: string,
  color: string,
  matched: SyncSenderGroupRow[],
  confidence: number,
  kind: 'preset' | 'custom',
  ctx: AnalyzerContext
): RawSuggestion {
  const sorted = matched.slice().sort((a, b) => b.emailCount - a.emailCount);
  const totalEmails = sorted.reduce((sum, s) => sum + s.emailCount, 0);
  const totalBytes = sorted.reduce((sum, s) => sum + s.totalSizeBytes, 0);
  const topNames = sorted
    .slice(0, 3)
    .map((s) => (s.senderName && !s.senderName.includes('@') ? s.senderName : domainOf(s.id)))
    .filter(Boolean);
  const others = sorted.length > 3 ? ` and ${sorted.length - 3} other${sorted.length - 3 === 1 ? '' : 's'}` : '';
  const reason =
    kind === 'preset'
      ? `${topNames.join(', ')}${others} — all ${folderName.toLowerCase()} emails grouped in one place.`
      : `${topNames.join(', ')}${others} — ${matched.length} different senders from one company.`;

  return {
    type: 'CREATE_FOLDER',
    groupType: 'organize',
    priority: confidence > 0.7 ? 2 : 3,
    confidence,
    title: `Create '${folderName}' — ${matched.length} senders, ${totalEmails.toLocaleString()} emails`,
    description: reason,
    actionLabel: 'Create & Move',
    actionType: 'create_folder_and_move',
    actionPayload: {
      folderName,
      folderColor: color,
      senderEmails: sorted.map((s) => s.id),
      estimatedCount: totalEmails,
      estimatedBytes: totalBytes,
    },
    affectedCount: totalEmails,
    affectedSenders: sorted.map((s) => s.id),
    sizeBytes: totalBytes,
    source: NAME,
    dedupeKey: `CREATE_FOLDER:${folderName}`,
  };
}

function niceFolderNameFromDomain(domain: string): string {
  // pinterest.com → Pinterest. mail.pinterest.com → Pinterest.
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const root = parts[parts.length - 2];
    return root.charAt(0).toUpperCase() + root.slice(1);
  }
  return domain;
}
