import type { Folder } from '../../shared/types.js';
import { GmailClient } from './gmail.js';
import { GraphClient } from './microsoft.js';
import { loadOAuthEnv } from './envConfig.js';
import { SyncDb, dbPathForAccount } from './syncDb.js';

export const FOLDER_CACHE_TTL_MS = 15 * 60_000;

export interface CachedMailFolder {
  id: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
}

function leafName(name: string): string {
  if (/^inbox$/i.test(name)) return 'Inbox';
  if (/^(junk email|junk\/spam|spam|junk)$/i.test(name.trim())) return 'Junk/Spam';
  if (name.includes('/')) {
    const parts = name.split('/');
    return parts[parts.length - 1] ?? name;
  }
  return name;
}

function looksLikeOpaqueFolderId(folderId: string): boolean {
  return folderId.length > 36 && /^[A-Za-z0-9+/=_-]+$/.test(folderId);
}

/** Resolve a folder id to a human-readable label using cached folder metadata. */
export function formatFolderDisplayName(
  folders: CachedMailFolder[],
  folderId: string
): string {
  const id = folderId?.trim() || 'INBOX';
  if (!id || id === 'INBOX') return 'Inbox';
  if (/junk|spam/i.test(id)) return 'Junk/Spam';
  if (/trash|deleted/i.test(id)) return 'Trash';

  const byId = new Map(folders.map((f) => [f.id, f]));
  const folder = byId.get(id);
  if (folder) {
    const path: string[] = [];
    let cur: CachedMailFolder | undefined = folder;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      path.unshift(leafName(cur.name));
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return path.length > 1 ? path.join(' › ') : (path[0] ?? folder.name);
  }

  if (id.includes('/')) {
    return leafName(id);
  }

  if (looksLikeOpaqueFolderId(id)) return 'Unknown folder';
  return leafName(id);
}

export function upsertFolderCache(accountId: string, folders: Folder[]): void {
  const db = new SyncDb(dbPathForAccount(accountId));
  try {
    db.upsertMailFolders(
      accountId,
      folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId ?? null,
        isSystem: f.isSystem ? 1 : 0,
      }))
    );
  } finally {
    db.close();
  }
}

export function readFolderCache(accountId: string): CachedMailFolder[] {
  const db = new SyncDb(dbPathForAccount(accountId));
  try {
    return db.listMailFolders(accountId);
  } finally {
    db.close();
  }
}

async function fetchFoldersLive(accountId: string): Promise<Folder[]> {
  loadOAuthEnv();
  if (accountId.startsWith('google:')) {
    return new GmailClient(accountId).listLabels();
  }
  return new GraphClient(accountId).listMailFolders();
}

/**
 * Load folder id → name metadata from the sync DB cache, refreshing from the
 * provider when the cache is empty or missing ids referenced by synced mail.
 */
export function cachedToFolders(rows: CachedMailFolder[]): Folder[] {
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId ?? undefined,
    isSystem: f.isSystem,
  }));
}

export async function refreshFolderCacheLive(accountId: string): Promise<Folder[]> {
  const live = await fetchFoldersLive(accountId);
  upsertFolderCache(accountId, live);
  return live;
}

/** Return cached folders when available; refresh from provider only when empty or stale. */
export async function listFoldersFast(accountId: string): Promise<Folder[]> {
  const cached = readFolderCache(accountId);
  const db = new SyncDb(dbPathForAccount(accountId));
  let updatedAt: number | null = null;
  try {
    updatedAt = db.getMailFoldersUpdatedAt(accountId);
  } finally {
    db.close();
  }

  const fresh = updatedAt !== null && Date.now() - updatedAt < FOLDER_CACHE_TTL_MS;
  if (cached.length > 0 && fresh) {
    return cachedToFolders(cached);
  }

  if (cached.length > 0 && !fresh) {
    void refreshFolderCacheLive(accountId).catch(() => {});
    return cachedToFolders(cached);
  }

  return refreshFolderCacheLive(accountId);
}

export async function ensureFolderCache(
  accountId: string,
  requiredFolderIds: string[] = []
): Promise<CachedMailFolder[]> {
  let cached = readFolderCache(accountId);
  const known = new Set(cached.map((f) => f.id));
  const needsRefresh =
    cached.length === 0 ||
    requiredFolderIds.some((id) => id && id !== 'INBOX' && !known.has(id));

  if (!needsRefresh) return cached;

  try {
    const live = await fetchFoldersLive(accountId);
    upsertFolderCache(accountId, live);
    cached = readFolderCache(accountId);
  } catch {
    // Offline or auth error — fall back to whatever we have locally.
  }

  return cached;
}
