import { useEffect, useState, useRef } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type { Folder as FolderType } from '@shared/types';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore, COLOR_PALETTE } from '@/stores/foldersStore';
import { useMailboxStore } from '@/stores/mailboxStore';
import { useUIStore } from '@/stores/uiStore';
import { FolderTree } from '@/components/FolderTree';
import { buildFolderTree, countTreeFolders, displayFolderName } from '@/lib/folders';

const EMPTY_FOLDERS: FolderType[] = [];

export function SidebarFolders() {
  const activeId = useAccountsStore((s) => s.activeId);
  const folders =
    useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.folders : undefined)) ??
    EMPTY_FOLDERS;
  const loading = useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.loading : false));
  const load = useFoldersStore((s) => s.load);
  const create = useFoldersStore((s) => s.create);
  const setColor = useFoldersStore((s) => s.setColor);
  const colorFor = useFoldersStore((s) => s.colorFor);
  const showToast = useUIStore((s) => s.showToast);
  const route = useUIStore((s) => s.route);
  const openFolder = useMailboxStore((s) => s.openFolder);
  const activeFolderId = useMailboxStore((s) => s.folder?.id);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColorState] = useState(COLOR_PALETTE[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const tree = buildFolderTree(folders);
  const totalFolders = countTreeFolders(tree);

  useEffect(() => {
    if (activeId) void load(activeId);
  }, [activeId, load]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const onCreate = async () => {
    if (!activeId || !name.trim()) {
      setCreating(false);
      return;
    }
    const folder = await create(activeId, name.trim(), color);
    if (folder) {
      setColor(activeId, folder.id, color);
      showToast('ok', `Created folder "${folder.name}"`);
    } else {
      showToast('err', `Failed to create folder`);
    }
    setName('');
    setCreating(false);
  };

  const onFolderClick = (f: FolderType) => {
    openFolder(f.id, displayFolderName(f));
  };

  return (
    <div
      data-tour="folders-panel"
      className="px-2 py-2 border-t border-border-subtle flex-1 min-h-0 flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-2 mb-1.5 shrink-0">
        <div>
          <span className="label-mono">All folders</span>
          {!loading && totalFolders > 0 && (
            <span className="ml-1.5 text-[9px] font-mono text-fg-subtle">{totalFolders}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => activeId && void load(activeId)}
            className="text-fg-subtle hover:text-accent p-0.5"
            title="Refresh folders"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-fg-subtle hover:text-accent p-0.5"
            title="New folder"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {creating && (
        <div className="px-1 mb-1 flex items-center gap-1.5 panel-inset h-7 animate-fade-in shrink-0">
          <button
            type="button"
            className="w-1.5 h-1.5 shrink-0"
            style={{ backgroundColor: color }}
            onClick={() => {
              const idx = COLOR_PALETTE.indexOf(color);
              setColorState(COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length]);
            }}
          />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreate();
              if (e.key === 'Escape') {
                setCreating(false);
                setName('');
              }
            }}
            onBlur={onCreate}
            placeholder="folder name…"
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-fg placeholder:text-fg-subtle"
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !folders.length ? (
          <div className="px-2 py-2 text-[10px] font-mono text-fg-subtle animate-pulse">
            Loading folder tree…
          </div>
        ) : (
          <FolderTree
            folders={folders}
            accountId={activeId}
            activeFolderId={route === 'mailbox' ? activeFolderId : null}
            onSelect={onFolderClick}
            colorFor={(id, i) => colorFor(activeId ?? '', id, i)}
            variant="sidebar"
          />
        )}
      </div>
    </div>
  );
}
