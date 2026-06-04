// Analyzer 5: RuleSuggestionAnalyzer
//
// Recommends mail rules that keep the inbox clean going forward. The same
// sender can drive at most one rule suggestion (we pick the highest-priority
// kind that fits) so we don't surface "auto-delete X" alongside "auto-move X".

import {
  type Analyzer,
  type AnalyzerContext,
  type RawSuggestion,
  clamp01,
  domainOf,
  monthsBetween,
} from './types.js';
import type { RuleSpec } from '../../../shared/types.js';
import type { SyncDb } from '../../services/syncDb.js';

const NAME = 'RuleSuggestionAnalyzer';

const FOLDER_FOR_CATEGORY: Record<string, string> = {
  finance: 'Finance & Banking',
  shopping: 'Orders & Shipping',
  travel: 'Travel',
  dev: 'Dev & Work Tools',
  social: 'Social',
  newsletter: 'Newsletters',
  transactional: 'Receipts',
};

export const RuleSuggestionAnalyzer: Analyzer = {
  name: NAME,
  async run(db: SyncDb, accountId: string, ctx: AnalyzerContext) {
    const senders = db.listSenderGroups(accountId);
    const out: RawSuggestion[] = [];

    for (const g of senders) {
      if (g.emailCount < 15) continue;

      const monthsSinceFirst = monthsBetween(ctx.now, g.firstSeen ?? ctx.now);
      const monthlyRate = g.emailCount / monthsSinceFirst;
      const projectedAnnual = Math.round(monthlyRate * 12);
      const isStale = ctx.now - g.lastSeen > 90 * 24 * 3600 * 1000;

      // Decide which rule kind is most appropriate for this sender.
      let kind:
        | 'auto_delete'
        | 'auto_move'
        | 'auto_label'
        | 'unsub_block'
        | null = null;

      if (g.isNewsletter === 1 && isStale) {
        kind = 'unsub_block';
      } else if ((g.isNewsletter === 1 || g.isNotification === 1) && g.confidenceDelete >= 1) {
        kind = 'auto_delete';
      } else if (g.suggestedFolder) {
        kind = 'auto_move';
      } else if (g.isNotification === 1 && g.emailCount >= 30) {
        kind = 'auto_label';
      }

      if (!kind) continue;

      const senderLabel =
        g.senderName && !g.senderName.includes('@') ? g.senderName : domainOf(g.id) || g.id;

      const priority: 1 | 2 | 3 | 4 | 5 =
        monthlyRate > 50 ? 1 : monthlyRate > 20 ? 2 : monthlyRate > 5 ? 3 : 4;
      // Confidence scales gently with monthly volume.
      const confidence = clamp01(0.5 + Math.min(0.4, monthlyRate / 50));

      const ruleSpec = buildRuleSpec(kind, g.id, senderLabel, g.suggestedFolder ?? undefined);

      switch (kind) {
        case 'auto_delete':
          out.push({
            type: 'CREATE_RULE_AUTO_DELETE',
            groupType: 'rules',
            priority,
            confidence,
            title: `Auto-delete future emails from ${senderLabel}`,
            description: `~${projectedAnnual.toLocaleString()} emails / year. Skip the inbox entirely.`,
            actionLabel: 'Create Rule',
            actionType: 'create_rule',
            actionPayload: {
              ruleSpec,
              providerFormat: ctx.provider,
              estimatedMonthlyImpact: Math.round(monthlyRate),
            },
            affectedCount: g.emailCount,
            affectedSenders: [g.id],
            sizeBytes: g.totalSizeBytes,
            source: NAME,
            dedupeKey: `CREATE_RULE:${g.id}:auto_delete`,
          });
          break;

        case 'auto_move':
          out.push({
            type: 'CREATE_RULE_AUTO_MOVE',
            groupType: 'rules',
            priority,
            confidence,
            title: `Auto-file ${senderLabel} → ${g.suggestedFolder}`,
            description: `~${Math.round(monthlyRate)} emails / month. Land directly in ${
              g.suggestedFolder
            }.`,
            actionLabel: 'Create Rule',
            actionType: 'create_rule',
            actionPayload: {
              ruleSpec,
              providerFormat: ctx.provider,
              estimatedMonthlyImpact: Math.round(monthlyRate),
              folderName: g.suggestedFolder ?? undefined,
            },
            affectedCount: g.emailCount,
            affectedSenders: [g.id],
            sizeBytes: g.totalSizeBytes,
            source: NAME,
            dedupeKey: `CREATE_RULE:${g.id}:auto_move`,
          });
          break;

        case 'auto_label':
          out.push({
            type: 'CREATE_RULE_AUTO_LABEL',
            groupType: 'rules',
            priority,
            confidence,
            title: `Label ${senderLabel} automatically`,
            description: `~${Math.round(
              monthlyRate
            )} emails / month. Apply a label so they're easy to filter.`,
            actionLabel: 'Create Rule',
            actionType: 'create_rule',
            actionPayload: {
              ruleSpec,
              providerFormat: ctx.provider,
              estimatedMonthlyImpact: Math.round(monthlyRate),
            },
            affectedCount: g.emailCount,
            affectedSenders: [g.id],
            sizeBytes: g.totalSizeBytes,
            source: NAME,
            dedupeKey: `CREATE_RULE:${g.id}:auto_label`,
          });
          break;

        case 'unsub_block':
          out.push({
            type: 'BLOCK_SENDER',
            groupType: 'security',
            priority,
            confidence,
            title: `Stop emails from ${senderLabel} permanently`,
            description: `${g.emailCount} sent so far · last received ${Math.round(
              (ctx.now - g.lastSeen) / (24 * 3600 * 1000)
            )} days ago.`,
            actionLabel: 'Unsubscribe & Block',
            actionType: 'block',
            actionPayload: {
              ruleSpec,
              providerFormat: ctx.provider,
              estimatedMonthlyImpact: Math.round(monthlyRate),
              blockSenderEmail: g.id,
              deleteHistory: true,
            },
            affectedCount: g.emailCount,
            affectedSenders: [g.id],
            sizeBytes: g.totalSizeBytes,
            source: NAME,
            dedupeKey: `BLOCK_SENDER:${g.id}:unsub_block`,
          });
          break;
      }
    }

    return out;
  },
};

function buildRuleSpec(
  kind: 'auto_delete' | 'auto_move' | 'auto_label' | 'unsub_block',
  senderEmail: string,
  senderLabel: string,
  folderName?: string
): RuleSpec {
  const base = {
    name:
      kind === 'auto_delete'
        ? `Auto-trash from ${senderLabel}`
        : kind === 'auto_move'
        ? `Auto-file ${senderLabel} to ${folderName ?? 'folder'}`
        : kind === 'auto_label'
        ? `Label ${senderLabel}`
        : `Block ${senderLabel}`,
    conditions: [
      {
        field: 'from' as const,
        operator: 'contains' as const,
        value: senderEmail,
      },
    ],
  };
  if (kind === 'auto_delete') {
    return { ...base, actions: [{ type: 'delete' }] };
  }
  if (kind === 'auto_move') {
    return {
      ...base,
      actions: [
        { type: 'move', target: folderName },
        { type: 'mark_read' },
      ],
    };
  }
  if (kind === 'auto_label') {
    return { ...base, actions: [{ type: 'label', target: 'Notifications' }] };
  }
  // unsub_block
  return { ...base, actions: [{ type: 'block' }, { type: 'delete' }] };
}

export { FOLDER_FOR_CATEGORY };
