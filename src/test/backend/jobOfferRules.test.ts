// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildJobOfferRoutingRules } from '@/lib/jobOfferRules';
import type { JobOfferEmailMatch } from '@shared/jobOfferDetection';

const folder = { id: 'label-job-1', name: 'Job Offers & Recruiting' };

function match(partial: Partial<JobOfferEmailMatch> & Pick<JobOfferEmailMatch, 'fromEmail'>): JobOfferEmailMatch {
  return {
    id: partial.id ?? 'msg-1',
    fromEmail: partial.fromEmail,
    fromName: partial.fromName ?? null,
    subject: partial.subject ?? 'Job opportunity',
    receivedAt: partial.receivedAt ?? Date.now(),
    folderId: partial.folderId ?? 'INBOX',
    inJunk: partial.inJunk ?? false,
    score: partial.score ?? 0.8,
    reasons: partial.reasons ?? ['test'],
  };
}

describe('buildJobOfferRoutingRules', () => {
  it('creates a LinkedIn rule for Gmail with label id', () => {
    const rules = buildJobOfferRoutingRules(
      folder,
      [match({ fromEmail: 'jobs-noreply@linkedin.com', subject: 'New job alert' })],
      'google'
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]?.fromContains).toBe('linkedin.com');
    expect(rules[0]?.addLabel).toBe('label-job-1');
    expect(rules[0]?.archive).toBe(true);
  });

  it('creates domain rules for ATS platforms on Outlook', () => {
    const rules = buildJobOfferRoutingRules(
      folder,
      [match({ fromEmail: 'noreply@greenhouse.io' })],
      'microsoft'
    );
    expect(rules[0]?.moveToFolderId).toBe('label-job-1');
    expect(rules[0]?.fromContains).toBe('greenhouse.io');
  });

  it('creates sender-specific rules for direct recruiter emails', () => {
    const rules = buildJobOfferRoutingRules(
      folder,
      [match({ fromEmail: 'recruiter@acmecorp.com', subject: 'Interview invite' })],
      'google'
    );
    expect(rules).toHaveLength(1);
    expect(rules[0]?.fromContains).toBe('acmecorp.com');
    expect(rules[0]?.subjectContains).toBe('interview');
  });
});
