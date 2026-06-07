// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { SyncDb } from '../../../electron/services/syncDb';
import { scanJobOffers, buildJobOfferRoutingRules } from '../../../electron/services/jobOfferScan';

const ACCOUNT = 'google:test@example.com';

type AnalyzerEmail = {
  id: string;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  receivedAt: number;
  folderId: string;
};

function mockDb(options: {
  totals?: { count: number };
  inbox?: AnalyzerEmail[];
  junk?: AnalyzerEmail[];
}): SyncDb {
  return {
    getEmailTotals: () => options.totals ?? { count: 0 },
    listEmailsForAnalyzer: (_accountId: string, scope: 'inbox' | 'junk') =>
      scope === 'inbox' ? (options.inbox ?? []) : (options.junk ?? []),
  } as unknown as SyncDb;
}

describe('scanJobOffers', () => {
  it('returns needsSync when database is empty', () => {
    const result = scanJobOffers(mockDb({ totals: { count: 0 } }), ACCOUNT);
    expect(result.needsSync).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it('finds LinkedIn job alerts in inbox and junk', () => {
    const result = scanJobOffers(
      mockDb({
        totals: { count: 3 },
        inbox: [
          {
            id: '1',
            senderEmail: 'jobs-noreply@linkedin.com',
            senderName: 'LinkedIn',
            subject: 'New jobs matching your alert',
            receivedAt: Date.now(),
            folderId: 'INBOX',
          },
          {
            id: '3',
            senderEmail: 'news@company.com',
            senderName: 'Company',
            subject: 'Weekly newsletter',
            receivedAt: Date.now(),
            folderId: 'INBOX',
          },
        ],
        junk: [
          {
            id: '2',
            senderEmail: 'noreply@greenhouse.io',
            senderName: 'Greenhouse',
            subject: 'Thank you for applying',
            receivedAt: Date.now(),
            folderId: 'SPAM',
          },
        ],
      }),
      ACCOUNT
    );

    expect(result.needsSync).toBe(false);
    expect(result.matches).toHaveLength(2);
    expect(result.byLocation.inbox).toBe(1);
    expect(result.byLocation.junk).toBe(1);
    expect(result.topDomains.some((d) => d.domain.includes('linkedin'))).toBe(true);
  });

  it('builds routing rules from scan matches', () => {
    const rules = buildJobOfferRoutingRules(
      { id: 'job-folder', name: 'Job Offers & Recruiting' },
      [
        {
          id: '1',
          fromEmail: 'jobs-noreply@linkedin.com',
          fromName: null,
          subject: 'Job alert',
          receivedAt: Date.now(),
          folderId: 'INBOX',
          inJunk: false,
          score: 0.9,
          reasons: [],
        },
        {
          id: '2',
          fromEmail: 'recruiter@startup.io',
          fromName: 'Recruiter',
          subject: 'Interview opportunity',
          receivedAt: Date.now(),
          folderId: 'INBOX',
          inJunk: false,
          score: 0.7,
          reasons: [],
        },
      ],
      'google'
    );
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => r.fromContains === 'linkedin.com')).toBe(true);
  });
});
