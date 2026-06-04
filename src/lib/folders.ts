import type { Folder } from '@shared/types';

/** System folders we surface in the sidebar (excluding noisy Gmail labels). */
export const SIDEBAR_SYSTEM_NAMES = new Set([
  'Inbox',
  'INBOX',
  'Sent Items',
  'Sent',
  'SENT',
  'Archive',
  'Drafts',
  'DRAFT',
  'Junk Email',
  'Junk/Spam',
  'Spam',
  'SPAM',
  'Deleted Items',
  'Trash',
  'TRASH',
]);

export interface FolderTreeNode {
  folder: Folder;
  children: FolderTreeNode[];
}

const EXPANDED_KEY = 'mailvault.folderTree.expanded';

export function isInboxFolder(f: Folder): boolean {
  if (!f.id && !f.name) return false;
  if (f.id === 'INBOX' || f.id.toLowerCase() === 'inbox') return true;
  return /^inbox$/i.test(f.name.trim());
}

export function isJunkFolder(f: Folder): boolean {
  if (!f.id && !f.name) return false;
  const id = f.id.toUpperCase();
  if (id === 'SPAM' || id === 'JUNK' || f.id.toLowerCase() === 'junkemail') return true;
  return /^(junk email|junk\/spam|spam|junk)$/i.test(f.name.trim());
}

export function isSidebarSystemFolder(f: Folder): boolean {
  if (isInboxFolder(f) || isJunkFolder(f)) return true;
  if (!f.isSystem) return false;
  return SIDEBAR_SYSTEM_NAMES.has(f.name) || SIDEBAR_SYSTEM_NAMES.has(f.name.toUpperCase());
}

export function isUserFolder(f: Folder): boolean {
  if (!f.name) return false;
  if (f.id?.startsWith('CATEGORY_')) return false;
  if (f.id === 'CHAT' || f.id === 'CHATS') return false;
  if (isInboxFolder(f) || isJunkFolder(f)) return false;
  if (f.isSystem && !isSidebarSystemFolder(f)) return false;
  return true;
}

export function displayFolderName(f: Folder): string {
  if (isInboxFolder(f)) return 'Inbox';
  if (isJunkFolder(f)) return 'Junk/Spam';
  // Nested Gmail labels: show leaf segment in tree rows; full path in breadcrumbs.
  if (f.name.includes('/')) {
    const parts = f.name.split('/');
    return parts[parts.length - 1] ?? f.name;
  }
  return f.name;
}

/** Gmail nested labels use "Parent/Child" names — infer parentId links. */
export function inferGmailLabelParents(folders: Folder[]): Folder[] {
  const byName = new Map(folders.map((f) => [f.name.toLowerCase(), f]));
  return folders.map((f) => {
    if (f.parentId || f.isSystem) return f;
    const slash = f.name.lastIndexOf('/');
    if (slash <= 0) return f;
    const parentName = f.name.slice(0, slash);
    const parent =
      byName.get(parentName.toLowerCase()) ??
      folders.find((x) => x.name.toLowerCase() === parentName.toLowerCase());
    return parent ? { ...f, parentId: parent.id } : f;
  });
}

function folderSortRank(f: Folder): number {
  if (isInboxFolder(f)) return 0;
  if (isJunkFolder(f)) return 1;
  if (isSidebarSystemFolder(f)) return 2;
  return 3;
}

function compareFolders(a: Folder, b: Folder): number {
  const ra = folderSortRank(a);
  const rb = folderSortRank(b);
  if (ra !== rb) return ra - rb;
  return displayFolderName(a).localeCompare(displayFolderName(b));
}

/** Build a hierarchical tree from a flat folder list (Outlook nested + Gmail labels). */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const normalized = inferGmailLabelParents(folders);
  const ids = new Set(normalized.map((f) => f.id));
  const childMap = new Map<string | null, Folder[]>();

  for (const f of normalized) {
    let parentKey: string | null = f.parentId ?? null;
    if (parentKey && !ids.has(parentKey)) parentKey = null;
    const list = childMap.get(parentKey) ?? [];
    list.push(f);
    childMap.set(parentKey, list);
  }

  const build = (parentId: string | null): FolderTreeNode[] => {
    const kids = childMap.get(parentId) ?? [];
    return [...kids].sort(compareFolders).map((folder) => ({
      folder,
      children: build(folder.id),
    }));
  };

  return build(null);
}

/** Flatten tree depth-first (Inbox first at each level). */
export function flattenFolderTree(nodes: FolderTreeNode[]): Folder[] {
  const out: Folder[] = [];
  const walk = (list: FolderTreeNode[]) => {
    for (const n of list) {
      out.push(n.folder);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Breadcrumb path from root → target folder. */
export function getFolderPath(folders: Folder[], folderId: string): Folder[] {
  const byId = new Map(inferGmailLabelParents(folders).map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur = byId.get(folderId);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function formatFolderPath(folders: Folder[], folderId: string): string {
  return getFolderPath(folders, folderId).map(displayFolderName).join(' › ');
}

export function loadExpandedFolderIds(accountId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(`${EXPANDED_KEY}:${accountId}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveExpandedFolderIds(accountId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(`${EXPANDED_KEY}:${accountId}`, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

/** Default expanded: Inbox + any folder with children on first visit. */
export function defaultExpandedIds(tree: FolderTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: FolderTreeNode[]) => {
    for (const n of nodes) {
      if (isInboxFolder(n.folder) || n.children.length > 0) ids.add(n.folder.id);
      walk(n.children);
    }
  };
  walk(tree);
  return ids;
}

/** Inbox first, then junk, then other system folders, then user folders (alpha). */
export function sortFoldersForDisplay(folders: Folder[]): Folder[] {
  const tree = buildFolderTree(folders);
  return flattenFolderTree(tree);
}

export function partitionFolders(folders: Folder[]) {
  const inbox = folders.find(isInboxFolder) ?? null;
  const junk = folders.find(isJunkFolder) ?? null;
  const system = folders.filter(
    (f) => isSidebarSystemFolder(f) && !isInboxFolder(f) && !isJunkFolder(f)
  );
  const user = folders.filter(isUserFolder);
  return { inbox, junk, system, user };
}

export function countTreeFolders(nodes: FolderTreeNode[]): number {
  let n = 0;
  const walk = (list: FolderTreeNode[]) => {
    for (const node of list) {
      n += 1;
      walk(node.children);
    }
  };
  walk(nodes);
  return n;
}

/**
 * Keep only the branch leading to `folderId` (ancestors + target) and all
 * descendants below the target — hide unrelated sibling folders.
 */
export function filterFolderTreeToSelection(
  nodes: FolderTreeNode[],
  folderId: string
): FolderTreeNode[] {
  const walk = (list: FolderTreeNode[]): FolderTreeNode[] | null => {
    for (const node of list) {
      if (node.folder.id === folderId) {
        return [node];
      }
      const branch = walk(node.children);
      if (branch) {
        return [{ ...node, children: branch }];
      }
    }
    return null;
  };

  return walk(nodes) ?? [];
}

/** Flat folder list limited to the selected branch (for scoped folder trees). */
export function filterFoldersToSelectionBranch(folders: Folder[], folderId: string): Folder[] {
  const tree = buildFolderTree(folders);
  const scoped = filterFolderTreeToSelection(tree, folderId);
  if (!scoped.length) return folders;
  return flattenFolderTree(scoped);
}
