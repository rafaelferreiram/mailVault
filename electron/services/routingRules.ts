import type { MailRule } from '../../shared/types.js';
import { ACCOUNT_ROUTING_BY_EMAIL } from '../config/accountRoutingRules.js';
import { storage } from '../store.js';
import { resolveGraphFolderByPath, findFolderByName } from './folderResolve.js';
import type { GraphClient } from './microsoft.js';
import type { GmailClient } from './gmail.js';

type RoutingClient =
  | { kind: 'google'; gmail: GmailClient }
  | { kind: 'microsoft'; graph: GraphClient };

export interface RoutingApplyResult {
  rules: { created: number; skipped: number; errors: string[] };
  moved: number;
  failed: number;
  skippedAlreadyInFolder: number;
  byRule: Array<{ name: string; moved: number; failed: number; skipped: number }>;
}

async function resolveFolderId(
  client: RoutingClient,
  def: (typeof ACCOUNT_ROUTING_BY_EMAIL)[string][number]
): Promise<string | null> {
  if (client.kind === 'microsoft') {
    let moveToFolderId = await resolveGraphFolderByPath(client.graph, def.folderPath);
    if (!moveToFolderId) {
      const leaf = def.folderPath[def.folderPath.length - 1];
      const folders = await client.graph.listMailFolders();
      moveToFolderId = findFolderByName(folders, leaf)?.id ?? null;
    }
    return moveToFolderId;
  }
  return def.folderPath.filter((s) => s.toLowerCase() !== 'inbox').join('/') || null;
}

/**
 * Create MailVault + provider rules for known account routing presets (idempotent).
 */
export async function ensureAccountRoutingRules(
  accountId: string,
  accountEmail: string,
  client: RoutingClient
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const defs = ACCOUNT_ROUTING_BY_EMAIL[accountEmail.trim().toLowerCase()];
  if (!defs?.length) return { created: 0, skipped: 0, errors: [] };

  const existing = storage.getRules(accountId);
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const def of defs) {
    if (existing.some((r) => r.name === def.name || r.id.startsWith(`routing-${def.id}`))) {
      skipped++;
      continue;
    }

    const moveToFolderId = await resolveFolderId(client, def);
    if (client.kind === 'microsoft' && !moveToFolderId) {
      errors.push(`Folder not found: ${def.folderPath.join(' › ')}`);
      continue;
    }

    const rule: MailRule = {
      id: `routing-${def.id}-${Date.now()}`,
      source: 'local',
      name: def.name,
      senderContains: def.senderContains,
      fromContains: def.fromMatch,
      moveToFolderId: moveToFolderId ?? undefined,
      addLabel: client.kind === 'google' ? (moveToFolderId ?? undefined) : undefined,
      enabled: true,
      createdAt: Date.now(),
    };

    try {
      const remote =
        client.kind === 'google'
          ? await client.gmail.createFilter(rule)
          : await client.graph.createRule(rule);
      existing.push(remote);
      created++;
    } catch (e) {
      errors.push(`${def.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (created > 0) storage.setRules(accountId, existing);
  return { created, skipped, errors };
}

/**
 * Create Outlook/Gmail rules and move matching historical mail into target folders.
 */
export async function applyAccountRoutingRules(
  accountId: string,
  accountEmail: string,
  client: RoutingClient,
  opts: { maxMessagesPerRule?: number } = {}
): Promise<RoutingApplyResult> {
  const defs = ACCOUNT_ROUTING_BY_EMAIL[accountEmail.trim().toLowerCase()];
  if (!defs?.length) {
    return {
      rules: { created: 0, skipped: 0, errors: [] },
      moved: 0,
      failed: 0,
      skippedAlreadyInFolder: 0,
      byRule: [],
    };
  }

  const rules = await ensureAccountRoutingRules(accountId, accountEmail, client);
  const max = opts.maxMessagesPerRule ?? 10_000;

  let moved = 0;
  let failed = 0;
  let skippedAlreadyInFolder = 0;
  const byRule: RoutingApplyResult['byRule'] = [];

  if (client.kind !== 'microsoft') {
    return { rules, moved, failed, skippedAlreadyInFolder, byRule };
  }

  for (const def of defs) {
    const folderId = await resolveFolderId(client, def);
    if (!folderId) {
      rules.errors.push(`Retroactive skip — folder missing: ${def.folderPath.join(' › ')}`);
      byRule.push({ name: def.name, moved: 0, failed: 0, skipped: 0 });
      continue;
    }

    let ruleMoved = 0;
    let ruleFailed = 0;
    let ruleSkipped = 0;

    const messages = await client.graph.listMessagesBySenderContains(def.senderContains, {
      maxMessages: max,
    }).catch((e: Error) => {
      rules.errors.push(`${def.name} search: ${e.message}`);
      return [] as Awaited<ReturnType<GraphClient['listMessagesBySenderContains']>>;
    });

    for (const msg of messages) {
      if (msg.folderId === folderId) {
        ruleSkipped++;
        skippedAlreadyInFolder++;
        continue;
      }
      try {
        await client.graph.moveMessage(msg.id, folderId);
        ruleMoved++;
        moved++;
      } catch {
        ruleFailed++;
        failed++;
      }
    }

    byRule.push({ name: def.name, moved: ruleMoved, failed: ruleFailed, skipped: ruleSkipped });
  }

  return { rules, moved, failed, skippedAlreadyInFolder, byRule };
}
