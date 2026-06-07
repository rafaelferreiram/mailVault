import type { AccountProfile, Folder, MailRule } from '@shared/types';

/** Normalize user input into a substring match for provider filters. */
export function normalizeSenderMatch(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  return s.startsWith('@') ? s.slice(1) : s;
}

export function describeSenderMatch(raw: string): string {
  const n = normalizeSenderMatch(raw);
  if (!n) return '';
  return n.includes('@') ? n : `@${n}`;
}

export function buildFolderRoutingRule(
  folder: Folder,
  senderMatch: string,
  provider: AccountProfile['provider'],
  opts?: { skipInbox?: boolean }
): MailRule {
  const match = normalizeSenderMatch(senderMatch);
  const label = senderMatch.trim() || match;

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: 'local',
    name: `${describeSenderMatch(label)} → ${folder.name}`,
    fromContains: match,
    enabled: true,
    createdAt: Date.now(),
    archive: opts?.skipInbox ?? provider === 'google',
    ...(provider === 'google'
      ? { addLabel: folder.id }
      : { moveToFolderId: folder.id, senderContains: match }),
  };
}
