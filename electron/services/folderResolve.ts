import type { Folder } from '../../shared/types.js';
import type { GraphClient } from './microsoft.js';

/**
 * Resolve a nested folder path (e.g. Inbox › RF-IT › Portugal › Car) to a Graph folder id.
 * The first segment may be "Inbox" (skipped — traversal starts at inbox root).
 */
export async function resolveGraphFolderByPath(
  graph: GraphClient,
  pathSegments: string[]
): Promise<string | null> {
  const folders = await graph.listMailFolders();
  let inboxId = await graph.getWellKnownFolderId('inbox');
  if (!inboxId) {
    const inbox = folders.find((f) => /^inbox$/i.test(f.name));
    inboxId = inbox?.id ?? null;
  }
  if (!inboxId) return null;

  let start = 0;
  if (pathSegments[0]?.toLowerCase() === 'inbox') start = 1;

  let currentId = inboxId;
  for (let i = start; i < pathSegments.length; i++) {
    const seg = pathSegments[i].trim();
    const child = folders.find(
      (f) => f.parentId === currentId && f.name.toLowerCase() === seg.toLowerCase()
    );
    if (!child) return null;
    currentId = child.id;
  }
  return currentId;
}

/** Find a folder by display name anywhere in the tree (fallback when path fails). */
export function findFolderByName(folders: Folder[], name: string): Folder | undefined {
  const needle = name.toLowerCase();
  return folders.find((f) => f.name.toLowerCase() === needle);
}
