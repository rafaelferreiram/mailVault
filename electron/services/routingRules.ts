import type { MailRule } from '../../shared/types.js';
import { ACCOUNT_ROUTING_BY_EMAIL } from '../config/accountRoutingRules.js';
import { storage } from '../store.js';
import { resolveGraphFolderByPath, findFolderByName } from './folderResolve.js';
import type { GraphClient } from './microsoft.js';
import type { GmailClient } from './gmail.js';

/**
 * Create MailVault + provider rules for known account routing presets (idempotent).
 */
export async function ensureAccountRoutingRules(
  accountId: string,
  accountEmail: string,
  client:
    | { kind: 'google'; gmail: GmailClient }
    | { kind: 'microsoft'; graph: GraphClient }
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

    let moveToFolderId: string | null = null;
    let addLabel: string | undefined;

    if (client.kind === 'microsoft') {
      moveToFolderId = await resolveGraphFolderByPath(client.graph, def.folderPath);
      if (!moveToFolderId) {
        const leaf = def.folderPath[def.folderPath.length - 1];
        const folders = await client.graph.listMailFolders();
        const found = findFolderByName(folders, leaf);
        moveToFolderId = found?.id ?? null;
      }
      if (!moveToFolderId) {
        errors.push(`Folder not found: ${def.folderPath.join(' › ')}`);
        continue;
      }
    } else {
      // Gmail: use label path with slashes
      addLabel = def.folderPath.filter((s) => s.toLowerCase() !== 'inbox').join('/');
    }

    const rule: MailRule = {
      id: `routing-${def.id}-${Date.now()}`,
      source: 'local',
      name: def.name,
      senderContains: def.senderContains,
      fromContains: def.fromMatch,
      moveToFolderId: moveToFolderId ?? undefined,
      addLabel,
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
