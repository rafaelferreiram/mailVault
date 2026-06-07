// Analyzer: JobOfferAnalyzer
//
// Finds job offers, recruiter outreach, and LinkedIn job alerts across Inbox
// and Junk. Uses sender domain, subject, and sender display name (content
// scoring when snippet is available from future sync fields).

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  parseSubjects,
} from './types.js';
import type { SyncDb } from '../../services/syncDb.js';
import {
  JOB_OFFERS_FOLDER,
  isJunkFolderId,
  isJobOfferEmail,
  matchJobDomain,
  scoreJobOfferEmail,
} from '../../../shared/jobOfferDetection.js';

const NAME = 'JobOfferAnalyzer';
const MIN_SCORE = 0.5;

export const JobOfferAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const existing = new Set(
      ctx.knownFolders.map((f) => f.name.toLowerCase().trim())
    );
    const hasFolder = existing.has(JOB_OFFERS_FOLDER.toLowerCase());

    const inbox = db.listEmailsForAnalyzer(accountId, 'inbox');
    const junk = db.listEmailsForAnalyzer(accountId, 'junk');
    const all = [...inbox, ...junk];

    const matched = all.filter((e) =>
      isJobOfferEmail(
        {
          fromEmail: e.senderEmail,
          fromName: e.senderName,
          subject: e.subject,
          folderId: e.folderId,
        },
        MIN_SCORE
      )
    );

    if (matched.length === 0) return [];

    const out: RawSuggestion[] = [];
    const junkMatches = matched.filter((e) => isJunkFolderId(e.folderId));
    const inboxMatches = matched.filter((e) => !isJunkFolderId(e.folderId));

    // Suggest creating the folder + moving inbox matches.
    if (!hasFolder && inboxMatches.length >= 1) {
      const senders = new Map<string, { count: number; bytes: number; name: string | null }>();
      for (const e of inboxMatches) {
        const cur = senders.get(e.senderEmail) ?? { count: 0, bytes: 0, name: e.senderName };
        cur.count += 1;
        cur.bytes += e.sizeBytes;
        senders.set(e.senderEmail, cur);
      }
      const senderList = [...senders.entries()].sort((a, b) => b[1].count - a[1].count);
      const totalBytes = inboxMatches.reduce((s, e) => s + e.sizeBytes, 0);
      const topDomain = domainOf(senderList[0]?.[0] ?? '');

      out.push({
        type: 'CREATE_FOLDER',
        groupType: 'organize',
        priority: 2,
        confidence: clamp01(0.55 + Math.min(0.35, inboxMatches.length / 30)),
        title: `Create '${JOB_OFFERS_FOLDER}' — ${inboxMatches.length} job emails`,
        description: `Recruiting mail from ${senderList
          .slice(0, 3)
          .map(([email, info]) => info.name || domainOf(email))
          .join(', ')}${senderList.length > 3 ? ` +${senderList.length - 3} more` : ''}.`,
        actionLabel: 'Create & Move',
        actionType: 'create_folder_and_move',
        actionPayload: {
          folderName: JOB_OFFERS_FOLDER,
          folderColor: 'cyan',
          senderEmails: senderList.map(([email]) => email),
          emailIds: inboxMatches.map((e) => e.id),
          estimatedCount: inboxMatches.length,
          estimatedBytes: totalBytes,
          createRule: true,
          notes: topDomain ? `Auto-route ${topDomain} job mail` : undefined,
        },
        affectedCount: inboxMatches.length,
        affectedSenders: senderList.map(([email]) => email),
        sizeBytes: totalBytes,
        source: NAME,
        dedupeKey: `CREATE_FOLDER:${JOB_OFFERS_FOLDER}`,
      });
    }

    // Rescue job mail sitting in Junk (LinkedIn alerts, direct recruiters, etc.).
    if (junkMatches.length >= 1) {
      const bySender = new Map<
        string,
        { ids: string[]; bytes: number; name: string | null; avgScore: number }
      >();
      for (const e of junkMatches) {
        const scored = scoreJobOfferEmail({
          fromEmail: e.senderEmail,
          fromName: e.senderName,
          subject: e.subject,
          folderId: e.folderId,
        });
        let bucket = bySender.get(e.senderEmail);
        if (!bucket) {
          bucket = { ids: [], bytes: 0, name: e.senderName, avgScore: 0 };
          bySender.set(e.senderEmail, bucket);
        }
        bucket.ids.push(e.id);
        bucket.bytes += e.sizeBytes;
        bucket.avgScore = (bucket.avgScore + scored.score) / 2;
      }

      for (const [sender, info] of bySender) {
        const domain = domainOf(sender);
        const label =
          info.name && !info.name.includes('@') ? info.name : domain || sender;
        const rescueScore = clamp01(
          info.avgScore + (matchJobDomain(domain) ? 0.15 : 0) + (info.ids.length > 1 ? 0.05 : 0)
        );
        if (rescueScore < 0.55) continue;

        out.push({
          type: 'MOVE_FROM_JUNK',
          groupType: 'organize',
          priority: 2,
          confidence: rescueScore,
          title: `Job mail in Junk — ${label} (${info.ids.length})`,
          description: hasFolder
            ? `Move to “${JOB_OFFERS_FOLDER}” and keep future mail organized.`
            : `Likely a misfiled job alert or recruiter message. Rescue to Inbox or your job folder.`,
          actionLabel: hasFolder ? 'Move to job folder' : 'Rescue from Junk',
          actionType: 'move',
          actionPayload: {
            emailIds: info.ids,
            senderEmails: [sender],
            destinationFolder: hasFolder ? JOB_OFFERS_FOLDER : 'INBOX',
            markNotJunk: true,
            createRule: true,
            ruleDescription: `Route ${matchJobDomain(domain) ? domain : sender} job mail`,
          },
          affectedCount: info.ids.length,
          affectedSenders: [sender],
          sizeBytes: info.bytes,
          source: NAME,
          dedupeKey: `JOB_JUNK:${sender}`,
        });
      }
    }

    // Subject-based senders from sender_groups not caught by domain presets.
    const groups = db.listSenderGroups(accountId);
    const subjectHits = groups.filter((g) => {
      const subjects = parseSubjects(g.sampleSubjects);
      return subjects.some((subject) =>
        isJobOfferEmail({ fromEmail: g.id, fromName: g.senderName, subject }, MIN_SCORE)
      );
    });
    if (!hasFolder && subjectHits.length >= 2 && inboxMatches.length === 0) {
      const total = subjectHits.reduce((s, g) => s + g.emailCount, 0);
      out.push({
        type: 'CREATE_FOLDER',
        groupType: 'organize',
        priority: 3,
        confidence: clamp01(0.5 + subjectHits.length / 20),
        title: `Job outreach detected — ${subjectHits.length} senders`,
        description: `Subjects mention interviews, openings, or recruiting from ${subjectHits
          .slice(0, 2)
          .map((g) => g.senderName || domainOf(g.id))
          .join(' and ')}.`,
        actionLabel: 'Create job folder',
        actionType: 'create_folder_and_move',
        actionPayload: {
          folderName: JOB_OFFERS_FOLDER,
          folderColor: 'cyan',
          senderEmails: subjectHits.map((g) => g.id),
          estimatedCount: total,
          estimatedBytes: subjectHits.reduce((s, g) => s + g.totalSizeBytes, 0),
          createRule: true,
        },
        affectedCount: total,
        affectedSenders: subjectHits.map((g) => g.id),
        sizeBytes: subjectHits.reduce((s, g) => s + g.totalSizeBytes, 0),
        source: NAME,
        dedupeKey: `CREATE_FOLDER:${JOB_OFFERS_FOLDER}:subjects`,
      });
    }

    return out;
  },
};
