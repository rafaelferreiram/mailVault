import type { AccountProfile, Folder, MailRule } from '@shared/types';
import type { JobOfferEmailMatch } from '@shared/jobOfferDetection';
import {
  domainOf,
  JOB_OFFERS_FOLDER,
  matchJobDomain,
} from '@shared/jobOfferDetection';

export { JOB_OFFERS_FOLDER };

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
      const key = domain.includes('linkedin') ? 'linkedin:jobs' : `domain:${domain}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(
        domain.includes('linkedin')
          ? linkedInJobRule(folder, provider)
          : domainRule(folder, domain, provider)
      );
      continue;
    }

    for (const row of rows) {
      const key = `sender:${row.fromEmail.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push(senderRule(folder, row.fromEmail, row.subject, provider));
    }
  }

  return rules;
}

function linkedInJobRule(folder: Folder, provider: AccountProfile['provider']): MailRule {
  return {
    id: `local-linkedin-jobs-${Date.now()}`,
    source: 'local',
    name: 'LinkedIn job alerts → Job Offers',
    fromContains: 'linkedin.com',
    subjectContains: provider === 'google' ? 'job' : undefined,
    senderContains: provider === 'microsoft' ? 'linkedin' : undefined,
    enabled: true,
    createdAt: Date.now(),
    archive: provider === 'google',
    ...(provider === 'google'
      ? { addLabel: folder.id }
      : { moveToFolderId: folder.id }),
  };
}

function domainRule(
  folder: Folder,
  domain: string,
  provider: AccountProfile['provider']
): MailRule {
  return {
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
  };
}

function senderRule(
  folder: Folder,
  email: string,
  subject: string | null,
  provider: AccountProfile['provider']
): MailRule {
  const match = domainOf(email) || email;
  const rule: MailRule = {
    id: `local-job-sender-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    source: 'local',
    name: `${email} → ${folder.name}`,
    fromContains: match,
    enabled: true,
    createdAt: Date.now(),
    archive: provider === 'google',
    ...(provider === 'google'
      ? { addLabel: folder.id }
      : { moveToFolderId: folder.id, senderContains: match }),
  };

  if (subject && /interview|offer|opportun|hiring|recruit/i.test(subject)) {
    const token = subject.match(/\b(interview|offer|opportun|hiring|recruit\w*)\b/i)?.[1];
    if (token) rule.subjectContains = token.toLowerCase();
  }

  return rule;
}
