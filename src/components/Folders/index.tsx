import { useEffect, useState, useRef } from 'react';
import { Plus, Folder as FolderIcon, RefreshCw, Search, Filter } from 'lucide-react';
import type { Folder as FolderType } from '@shared/types';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore, COLOR_PALETTE } from '@/stores/foldersStore';
import { useUIStore } from '@/stores/uiStore';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { formatNumber } from '@/lib/format';
import { useMailboxStore } from '@/stores/mailboxStore';
import {
  buildFolderTree,
  countTreeFolders,
  displayFolderName,
  formatFolderPath,
  isInboxFolder,
  isJunkFolder,
} from '@/lib/folders';
import { Skeleton } from '../ui/Skeleton';
import { SmartSuggestions } from './SmartSuggestions';
import { CreateFolderRuleModal } from './CreateFolderRuleModal';
import { JobOffersOrganizer } from './JobOffersOrganizer';
import { FolderTree } from '@/components/FolderTree';

// Stable reference — see `EMPTY_BLOCKED` in Blocked/index.tsx for the rationale.
const EMPTY_FOLDERS: FolderType[] = [];

export function Folders() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const folders =
    useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.folders : undefined)) ??
    EMPTY_FOLDERS;
  const loading = useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.loading : false));
  const load = useFoldersStore((s) => s.load);
  const create = useFoldersStore((s) => s.create);
  const setColor = useFoldersStore((s) => s.setColor);
  const colorFor = useFoldersStore((s) => s.colorFor);
  const showToast = useUIStore((s) => s.showToast);
  const openFolder = useMailboxStore((s) => s.openFolder);

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [folderRuleOpen, setFolderRuleOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColorState] = useState(COLOR_PALETTE[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeId) void load(activeId);
  }, [activeId, load]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  if (!account) return null;

  const tree = buildFolderTree(folders);
  const totalFolders = countTreeFolders(tree);
  const listForSearch = search.trim()
    ? folders.filter((f) => {
        const q = search.toLowerCase();
        return (
          displayFolderName(f).toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          formatFolderPath(folders, f.id).toLowerCase().includes(q)
        );
      })
    : null;

  const renderRow = (f: FolderType, i: number, pinned?: boolean) => {
    const c = colorFor(activeId ?? '', f.id, i);
    return (
      <button
        key={f.id}
        type="button"
        onClick={() => openFolder(f.id, displayFolderName(f))}
        className={`w-full grid grid-cols-12 px-3 grid-row items-center text-[12px] hover:bg-bg-hover text-left transition-colors data-grid-row ${
          pinned && isInboxFolder(f) ? 'bg-accent/[0.04] border-l-2 border-l-accent' : ''
        }`}
      >
        <div className="col-span-7 flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="w-2 h-2 cursor-pointer hover:scale-125 transition-transform shrink-0"
            style={{ backgroundColor: c }}
            onClick={(e) => {
              e.stopPropagation();
              if (!activeId) return;
              const idx = COLOR_PALETTE.indexOf(c);
              setColor(activeId, f.id, COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length]);
            }}
            title="Cycle color"
          />
          <FolderIcon className="w-3 h-3 text-fg-subtle shrink-0" />
          <span className={`truncate ${isInboxFolder(f) ? 'font-medium text-fg' : ''}`}>
            {search.trim() ? formatFolderPath(folders, f.id) : displayFolderName(f)}
          </span>
        </div>
        <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
          {isInboxFolder(f) || isJunkFolder(f) || f.isSystem ? 'Mailbox' : 'User'}
        </div>
        <div className="col-span-3 text-right font-mono tabular-nums text-fg-muted">
          {typeof f.count === 'number' ? formatNumber(f.count) : '—'}
        </div>
      </button>
    );
  };

  const onCreate = async () => {
    if (!activeId || !name.trim()) {
      setCreating(false);
      return;
    }
    const folder = await create(activeId, name.trim(), color);
    if (folder) {
      setColor(activeId, folder.id, color);
      showToast('ok', `Created "${folder.name}"`);
    } else showToast('err', 'Failed to create folder');
    setName('');
    setCreating(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Folders"
        subtitle={`${totalFolders} folder${totalFolders === 1 ? '' : 's'} (including nested) on ${account.email}`}
        badge={account.provider === 'google' ? 'GMAIL · LABELS' : 'OUTLOOK · FOLDERS'}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => activeId && void load(activeId)}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Filter className="w-3 h-3" />}
              onClick={() => setFolderRuleOpen(true)}
            >
              Folder + rule
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="w-3 h-3" />}
              onClick={() => setCreating(true)}
            >
              New folder
            </Button>
          </>
        }
      />

      <div className="page-content space-y-5">
        <JobOffersOrganizer />
        <SmartSuggestions />

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders…"
              className="input pl-8"
            />
          </div>
        </div>

        {/* Full folder tree or search results */}
        <div className="panel">
          {creating && (
            <div className="grid grid-cols-12 px-3 grid-row items-center gap-2 border-b border-border-subtle bg-accent/[0.04] animate-fade-in">
              <div className="col-span-7 flex items-center gap-2">
                <button
                  type="button"
                  className="w-2 h-2 cursor-pointer hover:scale-125 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    const idx = COLOR_PALETTE.indexOf(color);
                    setColorState(COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length]);
                  }}
                />
                <FolderIcon className="w-3 h-3 text-fg-subtle" />
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
                  placeholder="Folder name…"
                  className="bg-transparent border-none outline-none text-[12px] flex-1"
                />
              </div>
              <div className="col-span-2 text-fg-subtle text-[10px] font-mono uppercase">New</div>
              <div className="col-span-3 text-right text-fg-subtle text-[10px] font-mono">
                Pending…
              </div>
            </div>
          )}

          {loading && !folders.length ? (
            <div className="space-y-px p-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          ) : listForSearch ? (
            <>
              <div className="grid grid-cols-12 px-3 h-7 border-b border-border label-mono">
                <div className="col-span-7">Search results</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-3 text-right">Count</div>
              </div>
              {!listForSearch.length ? (
                <div className="h-32 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
                  No folders match
                </div>
              ) : (
                <div className="zebra">{listForSearch.map((f, i) => renderRow(f, i))}</div>
              )}
            </>
          ) : !tree.length ? (
            <div className="h-32 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
              No folders yet
            </div>
          ) : (
            <>
              <div className="px-3 h-7 border-b border-border label-mono flex items-center justify-between">
                <span>Complete folder tree</span>
                <span className="text-fg-subtle normal-case tracking-normal font-sans text-[10px]">
                  Click to open · chevron to expand
                </span>
              </div>
              <div className="py-2 max-h-[480px] overflow-y-auto">
                <FolderTree
                  folders={folders}
                  accountId={activeId}
                  onSelect={(f) => openFolder(f.id, displayFolderName(f))}
                  colorFor={(id, i) => colorFor(activeId ?? '', id, i)}
                  variant="panel"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <CreateFolderRuleModal open={folderRuleOpen} onClose={() => setFolderRuleOpen(false)} />
    </div>
  );
}
