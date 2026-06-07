// Analyzer 3: JunkRescueAnalyzer
//
// Looks for legitimate emails sitting in Junk/Spam — high-impact because the
// user is actively missing them. The signal is asymmetric: we want to be
// aggressive about rescuing, but conservative about which signals count, so
// scammers don't piggy-back on the rescue (e.g. by spoofing display names of
// known services).

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';
import {
  isJobOfferEmail,
  matchJobDomain,
  scoreJobOfferEmail,
} from '../../../shared/jobOfferDetection.js';

const NAME = 'JunkRescueAnalyzer';

const KNOWN_LEGIT_DOMAINS = new Set([
  'stripe.com',
  'github.com',
  'gitlab.com',
  'notion.so',
  'slack.com',
  'zoom.us',
  'apple.com',
  'amazon.com',
  'google.com',
  'microsoft.com',
  'paypal.com',
  'wise.com',
  'dropbox.com',
  'figma.com',
  'linear.app',
  'vercel.com',
  'aws.amazon.com',
  'amazonaws.com',
  'cloud.google.com',
  'azure.com',
  'docusign.net',
  'docusign.com',
  'adobe.com',
  'turbotax.com',
]);

const SUSPICIOUS_SUBJECT_RE =
  /(urgent|act now|limited time|winner|prize|claim|bitcoin|crypto wallet|verify (?:your )?account|account suspended)/i;

export const JunkRescueAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const junk = db.listEmailsForAnalyzer(accountId, 'junk');
    if (junk.length === 0) return [];

    // Cross-reference: senders that ALSO appear in inbox are probably legit.
    const allSenders = new Set(
      db
        .listEmailsForAnalyzer(accountId, 'inbox')
        .map((e) => e.senderEmail.toLowerCase())
    );

    // Group junk emails by sender so we make per-sender suggestions, not
    // per-message ones.
    const bySender = new Map<
      string,
      {
        ids: string[];
        senderName: string | null;
        recentCount: number;
        totalSize: number;
        latestAt: number;
        suspiciousHits: number;
        spoofedName: boolean;
      }
    >();
    const thirtyDaysAgo = ctx.now - 30 * 24 * 3600 * 1000;

    for (const e of junk) {
      let bucket = bySender.get(e.senderEmail);
      if (!bucket) {
        bucket = {
          ids: [],
          senderName: e.senderName,
          recentCount: 0,
          totalSize: 0,
          latestAt: 0,
          suspiciousHits: 0,
          spoofedName: false,
        };
        bySender.set(e.senderEmail, bucket);
      }
      bucket.ids.push(e.id);
      bucket.totalSize += e.sizeBytes;
      if (e.receivedAt > bucket.latestAt) bucket.latestAt = e.receivedAt;
      if (e.receivedAt >= thirtyDaysAgo) bucket.recentCount += 1;
      if (e.subject && SUSPICIOUS_SUBJECT_RE.test(e.subject)) bucket.suspiciousHits += 1;
      // Display-name spoof heuristic: name claims to be a known brand but the
      // domain does not match. e.g. name="Apple Support" from domain="random-promos.biz".
      if (e.senderName && KNOWN_LEGIT_DOMAINS.size > 0) {
        const lowerName = e.senderName.toLowerCase();
        const domain = domainOf(e.senderEmail);
        for (const legit of KNOWN_LEGIT_DOMAINS) {
          const brand = legit.split('.')[0];
          if (
            lowerName.includes(brand) &&
            !domain.endsWith(legit) &&
            !domain.endsWith('.' + legit)
          ) {
            bucket.spoofedName = true;
            break;
          }
        }
      }
    }

    const out: RawSuggestion[] = [];
    for (const [sender, info] of bySender) {
      const domain = domainOf(sender);

      // Score legitimacy 0..1.
      let score = 0;
      if (KNOWN_LEGIT_DOMAINS.has(domain)) score += 0.5;
      if (allSenders.has(sender)) score += 0.3;
      if (info.recentCount > 0) score += 0.2;
      if (info.ids.length > 1) score += 0.1;

      // Job / recruiting mail in junk — often LinkedIn alerts or direct recruiters.
      if (matchJobDomain(domain)) {
        const sample = junk.find((e) => e.senderEmail === sender);
        if (
          sample &&
          isJobOfferEmail(
            {
              fromEmail: sender,
              fromName: info.senderName,
              subject: sample.subject,
              folderId: sample.folderId,
            },
            0.45
          )
        ) {
          score += 0.35;
        }
      } else if (info.ids.length > 0) {
        const sample = junk.find((e) => e.senderEmail === sender);
        const jobScore = sample
          ? scoreJobOfferEmail({
              fromEmail: sender,
              fromName: info.senderName,
              subject: sample.subject,
              folderId: sample.folderId,
            }).score
          : 0;
        if (jobScore >= 0.55) score += jobScore * 0.5;
      }

      // Hard penalties — refuse to recommend rescue on risky signals.
      if (info.spoofedName) score -= 0.5;
      if (info.suspiciousHits > 0) score -= 0.2;

      score = clamp01(score);
      if (score < 0.6) continue;

      const senderLabel =
        info.senderName && !info.senderName.includes('@') ? info.senderName : domain || sender;

      out.push({
        type: 'MOVE_FROM_JUNK',
        groupType: 'security',
        priority: 1,
        confidence: score,
        title: `${senderLabel} landing in Junk (${info.ids.length})`,
        description: `${
          KNOWN_LEGIT_DOMAINS.has(domain) ? 'Known legitimate sender' : 'Recurring sender'
        } sitting in Junk. Likely safe to move back.`,
        actionLabel: 'Move to Inbox',
        actionType: 'move',
        actionPayload: {
          emailIds: info.ids,
          senderEmails: [sender],
          destinationFolder: 'INBOX',
          createRule: true,
          ruleDescription: `Always deliver ${domain} to Inbox`,
        },
        affectedCount: info.ids.length,
        affectedSenders: [sender],
        sizeBytes: info.totalSize,
        source: NAME,
        dedupeKey: `MOVE_FROM_JUNK:${sender}`,
      });
    }

    return out;
  },
};
