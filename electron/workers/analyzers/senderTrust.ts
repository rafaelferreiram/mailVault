// Analyzer 8: SenderTrustAnalyzer
//
// Heuristic-only suspicion scoring (no WHOIS or external lookups). The score
// is a weighted sum of signals; we only emit BLOCK_SENDER when the score
// reasonably clears 0.6, and even then we explain WHY in the description so
// the user can verify.

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  localOf,
  parseSubjects,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'SenderTrustAnalyzer';

const URGENCY_RE =
  /(urgent|immediate action|account suspended|verify (?:now|your)|confirm your identity|unusual sign-?in|limited offer expires|act now|exclusive deal)/i;

const KNOWN_BRANDS = [
  'apple',
  'google',
  'microsoft',
  'amazon',
  'paypal',
  'stripe',
  'github',
  'netflix',
  'spotify',
  'fedex',
  'ups',
  'dhl',
  'irs',
  'wells fargo',
  'chase',
  'bank of america',
];

export const SenderTrustAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const senders = db.listSenderGroups(accountId);
    const out: RawSuggestion[] = [];
    const oneYearAgo = ctx.now - 365 * 24 * 3600 * 1000;

    for (const g of senders) {
      let suspicion = 0;
      const reasons: string[] = [];

      // (a) "Domain less than 1 year old" — heuristic: never received until
      // recently AND volume is suddenly high.
      if (g.firstSeen && g.firstSeen > oneYearAgo && g.emailCount >= 8) {
        suspicion += 0.35;
        reasons.push('new sender pattern');
      }

      // (b) Subject urgency.
      const subjects = parseSubjects(g.sampleSubjects);
      if (subjects.some((s) => URGENCY_RE.test(s))) {
        suspicion += 0.25;
        reasons.push('urgent subject lines');
      }

      // (c) Display-name spoof: name claims a known brand, domain doesn't
      // contain it.
      const senderName = (g.senderName || '').toLowerCase();
      const domain = domainOf(g.id);
      const brandHit = KNOWN_BRANDS.find((b) => senderName.includes(b));
      if (brandHit && !domain.includes(brandHit.replace(/\s+/g, ''))) {
        suspicion += 0.2;
        reasons.push(`name claims '${brandHit}' but domain is ${domain}`);
      }

      // (d) High frequency, never engaged, not a confirmed newsletter.
      if (g.emailCount >= 15 && g.unreadCount >= g.emailCount * 0.8 && g.isNewsletter !== 1) {
        suspicion += 0.15;
        reasons.push('high volume, never read');
      }

      // (e) Local part looks random (consonant clusters).
      if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(localOf(g.id))) {
        suspicion += 0.1;
        reasons.push('random-looking address');
      }

      // (f) Wide subject variety with same template length range — proxy
      // signal: many distinct sample subjects but they're all similar length.
      if (subjects.length >= 3) {
        const lengths = subjects.map((s) => s.length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance =
          lengths.reduce((a, b) => a + (b - avg) * (b - avg), 0) / lengths.length;
        if (variance < 50 && new Set(subjects).size === subjects.length) {
          suspicion += 0.1;
          reasons.push('templated subject lines');
        }
      }

      suspicion = clamp01(suspicion);
      if (suspicion < 0.6) continue; // not confident enough to recommend block

      out.push({
        type: 'BLOCK_SENDER',
        groupType: 'security',
        priority: 1,
        confidence: suspicion,
        title: `Block suspicious sender: ${g.id}`,
        description: `${reasons.slice(0, 2).join(' · ')}. ${g.emailCount} emails seen.`,
        actionLabel: 'Block & Delete',
        actionType: 'block',
        actionPayload: {
          blockSenderEmail: g.id,
          deleteHistory: true,
          ruleSpec: {
            name: `Block ${g.id}`,
            conditions: [{ field: 'from', operator: 'is', value: g.id }],
            actions: [{ type: 'delete' }, { type: 'block' }],
          },
          providerFormat: ctx.provider,
        },
        affectedCount: g.emailCount,
        affectedSenders: [g.id],
        sizeBytes: g.totalSizeBytes,
        source: NAME,
        dedupeKey: `BLOCK_SENDER:${g.id}:trust`,
      });
    }

    return out;
  },
};
