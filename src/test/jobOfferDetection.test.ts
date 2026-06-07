import { describe, it, expect } from 'vitest';
import {
  isJobOfferEmail,
  isLinkedInSocialNoise,
  scoreJobOfferEmail,
  JOB_OFFERS_FOLDER,
} from '@shared/jobOfferDetection';

describe('jobOfferDetection', () => {
  it('detects LinkedIn job alerts', () => {
    expect(
      isJobOfferEmail({
        fromEmail: 'jobs-noreply@linkedin.com',
        subject: 'New jobs matching your alert: Software Engineer',
      })
    ).toBe(true);
  });

  it('ignores LinkedIn social notifications', () => {
    expect(
      isLinkedInSocialNoise({
        fromEmail: 'messages-noreply@linkedin.com',
        subject: 'John accepted your invitation to connect',
      })
    ).toBe(true);
    expect(
      isJobOfferEmail({
        fromEmail: 'messages-noreply@linkedin.com',
        subject: 'John accepted your invitation to connect',
      })
    ).toBe(false);
  });

  it('detects direct recruiter email by subject', () => {
    const scored = scoreJobOfferEmail({
      fromEmail: 'sarah.jones@acmecorp.com',
      fromName: 'Sarah Jones — Talent Acquisition',
      subject: 'Interview opportunity at Acme Corp',
    });
    expect(scored.score).toBeGreaterThanOrEqual(0.5);
    expect(scored.signals).toContain('subject');
  });

  it('detects greenhouse.io domain', () => {
    expect(
      isJobOfferEmail({
        fromEmail: 'noreply@greenhouse.io',
        subject: 'Thank you for applying',
      })
    ).toBe(true);
  });

  it('uses dedicated folder constant', () => {
    expect(JOB_OFFERS_FOLDER).toBe('Job Offers & Recruiting');
  });
});
