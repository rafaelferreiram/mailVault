import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder as FolderIcon, Search, Plus, ArrowRight, X } from 'lucide-react';
import clsx from 'clsx';
import type { Folder as FolderType } from '@shared/types';
import { useUIStore } from '@/stores/uiStore';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore } from '@/stores/foldersStore';
import { useSyncStore } from '@/stores/syncStore';
import { displayFolderName, sortFoldersForDisplay } from '@/lib/folders';

const EMPTY_FOLDERS: FolderType[] = [];

const RECENT_KEY = 'mailvault.recentFolders';

function getRecents(accountId: string): string[] {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY}:${accountId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(accountId: string, folderId: string) {
  const cur = getRecents(accountId).filter((id) => id !== folderId);
  cur.unshift(folderId);
  localStorage.setItem(`${RECENT_KEY}:${accountId}`, JSON.stringify(cur.slice(0, 5)));
}

export function MovePicker() {
  const open = useUIStore((s) => s.movePickerOpen);
  const close = useUIStore((s) => s.closeMovePicker);
  const senderEmails = useUIStore((s) => s.movePickerSenders);
  const showToast = useUIStore((s) => s.showToast);
  const activeId = useAccountsStore((s) => s.activeId);
  const folders =
    useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.folders : undefined)) ??
    EMPTY_FOLDERS;
  const colorFor = useFoldersStore((s) => s.colorFor);
  const create = useFoldersStore((s) => s.create);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const removeMessages = useSyncStore((s) => s.removeMessages);

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [working, setWorking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const messageIds = useMemo(() => {
    if (!sync) return [];
    const fromMessages = sync.messages
      .filter((m) => senderEmails.includes(m.fromEmail))
      .map((m) => m.id);
    if (fromMessages.length) return fromMessages;
    return [];
  }, [sync, senderEmails]);

  const resolveMessageIds = async (): Promise<string[]> => {
    if (messageIds.length) return messageIds;
    if (!activeId || senderEmails.length !== 1) return [];
    return window.mailvault.listMessageIdsBySender(activeId, senderEmails[0]!);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const recents = activeId ? getRecents(activeId) : [];
    const recentSet = new Set(recents);
    let list = sortFoldersForDisplay(folders.filter((f) => f.name && (!q || displayFolderName(f).toLowerCase().includes(q))));
    // Sort: recents first, then alphabetical, but boost exact matches.
    list = list.sort((a, b) => {
      if (recentSet.has(a.id) && !recentSet.has(b.id)) return -1;
      if (!recentSet.has(a.id) && recentSet.has(b.id)) return 1;
      return displayFolderName(a).localeCompare(displayFolderName(b));
    });
    return list;
  }, [folders, query, activeId]);

  const onMove = async (folderId: string, folderName: string) => {
    if (!activeId) return;
    const ids = messageIds.length ? messageIds : await resolveMessageIds();
    if (!ids.length) return;
    setWorking(true);
    try {
      const result = await window.mailvault.moveEmails(activeId, {
        messageIds: ids,
        destinationFolderId: folderId,
      });
      removeMessages(activeId, new Set(ids));
      pushRecent(activeId, folderId);
      showToast(
        result.failed > 0 ? 'err' : 'ok',
        `Moved ${result.moved} email${result.moved === 1 ? '' : 's'} → ${folderName}${
          result.failed ? ` · ${result.failed} failed` : ''
        }`
      );
      close();
    } catch (e) {
      showToast('err', `Move failed: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  };

  const onCreateAndMove = async () => {
    if (!activeId || !query.trim()) return;
    const folder = await create(activeId, query.trim());
    if (folder) {
      await onMove(folder.id, folder.name);
    } else {
      showToast('err', 'Failed to create folder');
    }
  };

  if (!open) return null;

  const hasExact = filtered.some(
    (f) => displayFolderName(f).toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 animate-fade-in pt-[15vh]"
      onClick={close}
    >
      <div
        className="panel w-full max-w-xl mx-4 flex flex-col max-h-[60vh] animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 h-10 border-b border-border flex items-center gap-2">
          <ArrowRight className="w-3.5 h-3.5 text-accent" />
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg flex-1">
            Move {messageIds.length} email{messageIds.length === 1 ? '' : 's'} from{' '}
            <span className="text-accent">
              {senderEmails.length} sender{senderEmails.length === 1 ? '' : 's'}
            </span>
          </div>
          <button onClick={close} className="text-fg-subtle hover:text-fg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-3 py-2 border-b border-border-subtle">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(filtered.length, h + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (highlight < filtered.length) {
                    const f = filtered[highlight];
                    void onMove(f.id, displayFolderName(f));
                  } else if (query.trim() && !hasExact) {
                    void onCreateAndMove();
                  }
                }
              }}
              placeholder="Search folders or type a new name…"
              className="input pl-8"
            />
          </div>
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.map((f, i) => {
            const c = colorFor(activeId ?? '', f.id, i);
            return (
              <button
                key={f.id}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => onMove(f.id, displayFolderName(f))}
                disabled={working}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 h-8 text-left transition-colors',
                  highlight === i ? 'bg-accent/10 text-accent' : 'text-fg hover:bg-bg-hover'
                )}
              >
                <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: c }} />
                <FolderIcon className="w-3 h-3 text-fg-subtle shrink-0" />
                <span className="flex-1 truncate text-[12px]">{displayFolderName(f)}</span>
                {f.isSystem && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                    SYS
                  </span>
                )}
                {typeof f.count === 'number' && (
                  <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}

          {!hasExact && query.trim() && (
            <button
              onMouseEnter={() => setHighlight(filtered.length)}
              onClick={onCreateAndMove}
              disabled={working}
              className={clsx(
                'w-full flex items-center gap-3 px-3 h-8 text-left transition-colors',
                highlight === filtered.length ? 'bg-accent/10 text-accent' : 'text-accent hover:bg-bg-hover'
              )}
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span className="text-[12px]">
                Create "{query.trim()}" and move
              </span>
            </button>
          )}
          {!filtered.length && !query.trim() && (
            <div className="px-3 py-3 text-[11px] font-mono text-fg-subtle uppercase tracking-widest">
              No folders yet — type a name to create one.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 h-8 border-t border-border-subtle flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> Navigate
          </span>
          <span>
            <span className="kbd">↵</span> Confirm
          </span>
          <span>
            <span className="kbd">Esc</span> Close
          </span>
        </div>
      </div>
    </div>
  );
}
