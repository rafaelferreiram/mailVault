import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronRight,
  Folder as FolderIcon,
  Inbox,
  ShieldAlert,
  Mail,
} from 'lucide-react';
import type { Folder as FolderType } from '@shared/types';
import {
  buildFolderTree,
  defaultExpandedIds,
  displayFolderName,
  isInboxFolder,
  isJunkFolder,
  loadExpandedFolderIds,
  saveExpandedFolderIds,
  type FolderTreeNode,
} from '@/lib/folders';
import { formatNumber } from '@/lib/format';

interface FolderTreeProps {
  folders: FolderType[];
  accountId: string | null;
  activeFolderId?: string | null;
  onSelect: (folder: FolderType) => void;
  colorFor: (folderId: string, index: number) => string;
  variant?: 'sidebar' | 'panel';
  className?: string;
}

export function FolderTree({
  folders,
  accountId,
  activeFolderId,
  onSelect,
  colorFor,
  variant = 'sidebar',
  className,
}: FolderTreeProps) {
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!accountId) return;
    const stored = loadExpandedFolderIds(accountId);
    setExpanded(stored.size ? stored : defaultExpandedIds(tree));
  }, [accountId, tree]);

  useEffect(() => {
    if (!accountId) return;
    saveExpandedFolderIds(accountId, expanded);
  }, [accountId, expanded]);

  useEffect(() => {
    if (!activeFolderId) return;
    const byId = new Map(folders.map((f) => [f.id, f]));
    setExpanded((prev) => {
      const next = new Set(prev);
      let cur = byId.get(activeFolderId);
      let changed = false;
      while (cur?.parentId) {
        if (!next.has(cur.parentId)) {
          next.add(cur.parentId);
          changed = true;
        }
        cur = byId.get(cur.parentId);
      }
      return changed ? next : prev;
    });
  }, [activeFolderId, folders]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!tree.length) {
    return (
      <div className="px-2 py-3 text-[10px] font-mono text-fg-subtle uppercase tracking-widest">
        No folders
      </div>
    );
  }

  let colorIndex = 0;

  const renderBranch = (nodes: FolderTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const idx = colorIndex++;
      const { folder, children } = node;
      const hasChildren = children.length > 0;
      const isOpen = expanded.has(folder.id);
      const active = activeFolderId === folder.id;
      const color = colorFor(folder.id, idx);
      const Icon = isInboxFolder(folder) ? Inbox : isJunkFolder(folder) ? ShieldAlert : FolderIcon;
      const pad = variant === 'panel' ? 12 : 8;

      return (
        <div key={folder.id}>
          <div
            className={clsx(
              'flex items-center gap-0.5 group',
              variant === 'panel' ? 'h-8' : 'h-7'
            )}
            style={{ paddingLeft: depth * pad + 4 }}
          >
            <button
              type="button"
              onClick={() => hasChildren && toggle(folder.id)}
              className={clsx(
                'w-4 h-4 shrink-0 flex items-center justify-center text-fg-subtle hover:text-fg',
                !hasChildren && 'invisible'
              )}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-90')}
              />
            </button>

            <button
              type="button"
              onClick={() => onSelect(folder)}
              className={clsx(
                'flex-1 flex items-center gap-2 min-w-0 text-left rounded-sm transition-colors border-l-2',
                variant === 'panel' ? 'h-8 pr-2' : 'h-7 pr-1',
                active
                  ? 'bg-accent/10 border-l-accent text-fg'
                  : 'border-l-transparent hover:bg-bg-hover text-fg-muted'
              )}
            >
              <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: color }} aria-hidden />
              <Icon
                className={clsx('w-3 h-3 shrink-0', active ? 'text-accent' : 'text-fg-subtle')}
              />
              <span
                className={clsx('flex-1 truncate text-[12px]', active && 'font-medium text-fg')}
              >
                {displayFolderName(folder)}
              </span>
              {typeof folder.count === 'number' && folder.count > 0 && (
                <span className="font-mono text-[10px] text-fg-subtle tabular-nums shrink-0">
                  {formatNumber(folder.count, { compact: true })}
                </span>
              )}
            </button>
          </div>
          {hasChildren && isOpen ? renderBranch(children, depth + 1) : null}
        </div>
      );
    });

  return <div className={clsx('space-y-px', className)}>{renderBranch(tree, 0)}</div>;
}

export function FolderBreadcrumb({
  path,
  onSelect,
}: {
  path: FolderType[];
  onSelect?: (folder: FolderType) => void;
}) {
  if (!path.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-fg-muted">
      <Mail className="w-3 h-3 text-fg-subtle shrink-0" />
      {path.map((f, i) => (
        <span key={f.id} className="flex items-center gap-1 min-w-0">
          {i > 0 && <span className="text-fg-dim">›</span>}
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(f)}
              className={clsx(
                'truncate hover:text-accent transition-colors',
                i === path.length - 1 && 'text-fg font-medium'
              )}
            >
              {displayFolderName(f)}
            </button>
          ) : (
            <span className={clsx('truncate', i === path.length - 1 && 'text-fg font-medium')}>
              {displayFolderName(f)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
