import type { SyncDb } from './syncDb.js';
import type { AccountProfile, Folder, MailRule } from '../../shared/types.js';
import {
  domainOf,
  isJunkFolderId,
  isJobOfferEmail,
  JOB_OFFERS_FOLDER,
  matchJobDomain,
  scoreJobOfferEmail,
  type JobOfferEmailMatch,
  type JobOfferScanResult,
} from '../../shared/jobOfferDetection.js';

const MIN_SCORE = 0.48;

export function scanJobOffers(db: SyncDb, accountId: string): JobOfferScanResult {
  const totals = db.getEmailTotals(accountId);
  if (totals.count === 0) {
    return {
      folderName: JOB_OFFERS_FOLDER,
      matches: [],
      byLocation: { inbox: 0, junk: 0, other: 0 },
      topDomains: [],
      needsSync: true,
    };
  }

  const inbox = db.listEmailsForAnalyzer(accountId, 'inbox');
  const junk = db.listEmailsForAnalyzer(accountId, 'junk');
  const all = [...inbox, ...junk];

  const matches: JobOfferEmailMatch[] = [];
  for (const e of all) {
    if (
      !isJobOfferEmail(
        {
          fromEmail: e.senderEmail,
          fromName: e.senderName,
          subject: e.subject,
          folderId: e.folderId,
        },
        MIN_SCORE
      )
    ) {
      continue;
    }
    const result = scoreJobOfferEmail({
      fromEmail: e.senderEmail,
      fromName: e.senderName,
      subject: e.subject,
      folderId: e.folderId,
    });
    matches.push({
      id: e.id,
      fromEmail: e.senderEmail,
      fromName: e.senderName,
      subject: e.subject,
      receivedAt: e.receivedAt,
      folderId: e.folderId,
      inJunk: isJunkFolderId(e.folderId),
      score: result.score,
      reasons: result.reasons,
    });
  }

  matches.sort((a, b) => b.receivedAt - a.receivedAt);

  const byLocation = {
    inbox: matches.filter((m) => !m.inJunk).length,
    junk: matches.filter((m) => m.inJunk).length,
    other: 0,
  };

  const domainCounts = new Map<string, number>();
  for (const m of matches) {
    const d = domainOf(m.fromEmail);
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }

  const topDomains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([domain, count]) => ({ domain, count }));

  return {
    folderName: JOB_OFFERS_FOLDER,
    matches,
    byLocation,
    topDomains,
    needsSync: false,
  };
}

export function buildJobOfferRoutingRules(
  folder: Folder,
  matches: JobOfferEmailMatch[],
  provider: AccountProfile['provider']
): MailRule[] {
  const rules: MailRule[] = [];
  const seen = new Set<string>();
  const byDomain = new Map<string, JobOfferEmailMatch[]>();

  for (const m of matches) {
    const d = domainOf(m.fromEmail);
    const arr = byDomain.get(d) ?? [];
    arr.push(m);
    byDomain.set(d, arr);
  }

  for (const [domain, rows] of byDomain) {
    if (matchJobDomain(domain)) {
      const key = domain.includes('linkedin') ? 'linkedin' : domain;
      if (seen.has(key)) continue;
      seen.add(key);
      if (domain.includes('linkedin')) {
        rules.push({
          id: `local-linkedin-jobs-${Date.now()}`,
          source: 'local',
          name: 'LinkedIn job alerts → Job Offers',
          fromContains: 'linkedin.com',
          subjectContains: provider === 'google' ? 'job' : undefined,
          senderContains: provider === 'microsoft' ? 'linkedin' : undefined,
          enabled: true,
          createdAt: Date.now(),
          archive: provider === 'google',
          ...(provider === 'google' ? { addLabel: folder.id } : { moveToFolderId: folder.id }),
        });
      } else {
        rules.push({
          id: `local-job-${domain}-${Date.now()}`,
          source: 'local',
          name: `${domain} → ${folder.name}`,
          fromContains: domain,
          enabled: true,
          createdAt: Date.now(),
          archive: provider === 'google',
          ...(provider === 'google'
            ? { addLabel: folder.id }
            : { moveToFolderId: folder.id, senderContains: domain }),
        });
      }
      continue;
    }

    for (const row of rows) {
      const key = row.fromEmail.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const rule: MailRule = {
        id: `local-job-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        source: 'local',
        name: `${row.fromEmail} → ${folder.name}`,
        fromContains: domainOf(row.fromEmail) || row.fromEmail,
        enabled: true,
        createdAt: Date.now(),
        archive: provider === 'google',
        ...(provider === 'google'
          ? { addLabel: folder.id }
          : { moveToFolderId: folder.id, senderContains: domainOf(row.fromEmail) }),
      };
      if (row.subject && /interview|offer|opportun|hiring|recruit/i.test(row.subject)) {
        const token = row.subject.match(/\b(interview|offer|opportun|hiring|recruit\w*)\b/i)?.[1];
        if (token) rule.subjectContains = token.toLowerCase();
      }
      rules.push(rule);
    }
  }

  return rules;
}
