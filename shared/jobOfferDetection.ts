/** Dedicated folder name for job / recruiting mail. Keep in sync across analyzers + UI. */
export const JOB_OFFERS_FOLDER = 'Job Offers & Recruiting';

export const JOB_RECRUITING_DOMAINS = [
  'linkedin.com',
  'e.linkedin.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workday.com',
  'myworkday.com',
  'myworkdayjobs.com',
  'icims.com',
  'smartrecruiters.com',
  'jobvite.com',
  'recruitee.com',
  'workable.com',
  'taleo.net',
  'successfactors.com',
  'ultipro.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'hired.com',
  'dice.com',
  'monster.com',
  'careerbuilder.com',
  'wellfound.com',
  'otta.com',
  'joinhandshake.com',
  'handshake.com',
  'ripplematch.com',
  'breezy.hr',
  'bamboohr.com',
  'jazz.co',
  'applytojob.com',
  'recruiting.com',
  'jobs2web.com',
  'phenom.com',
  'eightfold.ai',
  'gem.com',
];

const LINKEDIN_SOCIAL_SUBJECT_RE =
  /(?:invitation to connect|accepted your invitation|commented on your|mentioned you|liked your|shared a post|followed you|birthday|network news|people you may know)/i;

const JOB_SUBJECT_RE =
  /\b(?:job\s+(?:alert|offer|opportunity|opening|posting|match|recommendation)|new\s+jobs?|career\s+opportun|recruiter|recruiting|hiring|interview|application\s+(?:received|update|status|submitted)|(?:open|available)\s+(?:role|position)|position\s+(?:at|with|for)|role\s+(?:at|with|for)|talent\s+(?:acquisition|partner|team)|staffing|headhunt|candidate|join\s+(?:our|the)\s+team|work\s+with\s+us|inmail.*(?:opportun|role|position|hiring)|you(?:'re|r)\s+a\s+match|profile\s+viewed\s+by\s+a\s+recruiter)/i;

const JOB_SENDER_NAME_RE =
  /\b(?:recruit|talent|hiring|careers?|human resources|staffing|headhunt|people\s+ops)\b/i;

const JOB_SNIPPET_RE =
  /\b(?:job\s+opportun|we(?:'re|\s+are)\s+hiring|open\s+(?:role|position)|schedule\s+(?:an\s+)?interview|application\s+for|recruiter|salary\s+range|compensation\s+package|remote\s+role|full[\s-]time\s+position)\b/i;

export type JobOfferSignal = 'domain' | 'subject' | 'sender_name' | 'content' | 'linkedin_job';

export interface JobOfferMatchInput {
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  folderId?: string | null;
}

export interface JobOfferScore {
  score: number;
  reasons: string[];
  signals: JobOfferSignal[];
}

export interface JobOfferEmailMatch {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  receivedAt: number;
  folderId: string | null;
  inJunk: boolean;
  score: number;
  reasons: string[];
}

export interface JobOfferScanResult {
  folderName: string;
  matches: JobOfferEmailMatch[];
  byLocation: { inbox: number; junk: number; other: number };
  topDomains: Array<{ domain: string; count: number }>;
  needsSync: boolean;
}

export interface JobOfferOrganizeResult {
  folder: { id: string; name: string } | null;
  moved: number;
  failed: number;
  rulesCreated: number;
  rulesFailed: number;
  error?: string;
}

export function domainOf(email: string): string {
  const at = email.indexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export function matchJobDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  for (const entry of JOB_RECRUITING_DOMAINS) {
    if (d === entry || d.endsWith('.' + entry)) return true;
  }
  return false;
}

export function isJunkFolderId(folderId: string | null | undefined): boolean {
  if (!folderId) return false;
  const f = folderId.toLowerCase();
  return f.includes('junk') || f.includes('spam') || f === 'spam';
}

export function isLinkedInSocialNoise(input: JobOfferMatchInput): boolean {
  const domain = domainOf(input.fromEmail);
  if (!domain.includes('linkedin')) return false;
  const subject = (input.subject ?? '').trim();
  if (!subject) return false;
  return LINKEDIN_SOCIAL_SUBJECT_RE.test(subject);
}

export function scoreJobOfferEmail(input: JobOfferMatchInput): JobOfferScore {
  const reasons: string[] = [];
  const signals: JobOfferSignal[] = [];
  let score = 0;

  const domain = domainOf(input.fromEmail);
  const subject = (input.subject ?? '').trim();
  const fromName = (input.fromName ?? '').trim();
  const snippet = (input.snippet ?? '').trim();

  if (isLinkedInSocialNoise(input)) {
    return { score: 0, reasons: ['LinkedIn social notification (not job-related)'], signals: [] };
  }

  if (matchJobDomain(domain)) {
    score += domain.includes('linkedin') ? 0.35 : 0.55;
    reasons.push(`Recruiting platform domain (${domain})`);
    signals.push(domain.includes('linkedin') ? 'linkedin_job' : 'domain');
  }

  if (subject && JOB_SUBJECT_RE.test(subject)) {
    score += 0.45;
    reasons.push(`Subject looks job-related: “${truncate(subject, 64)}”`);
    signals.push('subject');
  }

  if (fromName && JOB_SENDER_NAME_RE.test(fromName)) {
    score += 0.25;
    reasons.push(`Sender name suggests recruiting (${fromName})`);
    signals.push('sender_name');
  }

  if (snippet && JOB_SNIPPET_RE.test(snippet)) {
    score += 0.2;
    reasons.push('Preview text mentions hiring or interviews');
    signals.push('content');
  }

  // LinkedIn job alerts often have minimal subjects — boost when domain + not social.
  if (domain.includes('linkedin') && score >= 0.35 && !signals.includes('subject')) {
    const local = input.fromEmail.split('@')[0]?.toLowerCase() ?? '';
    if (/jobs?|hiring|recruit|talent|career/.test(local)) {
      score += 0.25;
      reasons.push('LinkedIn jobs sender address');
      signals.push('linkedin_job');
    }
  }

  // Direct recruiter @ company.com with strong subject
  if (!matchJobDomain(domain) && subject && JOB_SUBJECT_RE.test(subject)) {
    score += 0.15;
    reasons.push('Direct email with recruiting subject line');
  }

  if (isJunkFolderId(input.folderId) && score >= 0.45) {
    score += 0.05;
    reasons.push('Found in Junk/Spam — likely misfiled');
  }

  return { score: Math.min(1, score), reasons, signals };
}

export function isJobOfferEmail(input: JobOfferMatchInput, minScore = 0.5): boolean {
  return scoreJobOfferEmail(input).score >= minScore;
}

export function classifySenderCategoryWork(
  email: string,
  subjects: string[]
): boolean {
  for (const subject of subjects) {
    if (isJobOfferEmail({ fromEmail: email, subject })) return true;
  }
  if (subjects.length === 0) {
    return isJobOfferEmail({ fromEmail: email, subject: '' });
  }
  return isJobOfferEmail({ fromEmail: email, subject: subjects.join(' ') });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
