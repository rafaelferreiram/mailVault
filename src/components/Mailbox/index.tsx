import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { Inbox, Mail, RefreshCw, Loader2, ChevronLeft } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore } from '@/stores/foldersStore';
import { useMailboxStore } from '@/stores/mailboxStore';
import { FolderTree, FolderBreadcrumb } from '@/components/FolderTree';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { Skeleton, SkeletonRows } from '../ui/Skeleton';
import { LoadingIndicator, LoadingBar } from '../ui/LoadingIndicator';
import { formatNumber } from '@/lib/format';
import { formatDistanceToNow } from 'date-fns';
import {
  displayFolderName,
  formatFolderPath,
  getFolderPath,
  countTreeFolders,
  buildFolderTree,
  filterFoldersToSelectionBranch,
} from '@/lib/folders';

import type { Folder as FolderType } from '@shared/types';

const EMPTY_FOLDERS: FolderType[] = [];

export function Mailbox() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const allFolders =
    useFoldersStore((s) => (activeId ? s.byAccount[activeId]?.folders : undefined)) ??
    EMPTY_FOLDERS;
  const foldersLoading = useFoldersStore((s) =>
    activeId ? s.byAccount[activeId]?.loading : false
  );
  const loadFolders = useFoldersStore((s) => s.load);
  const colorFor = useFoldersStore((s) => s.colorFor);

  const folder = useMailboxStore((s) => s.folder);
  const messages = useMailboxStore((s) => s.messages);
  const source = useMailboxStore((s) => s.source);
  const loading = useMailboxStore((s) => s.loading);
  const error = useMailboxStore((s) => s.error);
  const selectedId = useMailboxStore((s) => s.selectedMessageId);
  const preview = useMailboxStore((s) => s.preview);
  const previewLoading = useMailboxStore((s) => s.previewLoading);
  const loadFolder = useMailboxStore((s) => s.loadFolder);
  const selectMessage = useMailboxStore((s) => s.selectMessage);
  const clearPreview = useMailboxStore((s) => s.clearPreview);
  const openFolder = useMailboxStore((s) => s.openFolder);

  useEffect(() => {
    if (activeId) void loadFolders(activeId);
  }, [activeId, loadFolders]);

  useEffect(() => {
    if (activeId && folder) void loadFolder(activeId);
  }, [activeId, folder?.id, loadFolder]);

  const folderPath = useMemo(
    () => (folder ? getFolderPath(allFolders, folder.id) : []),
    [allFolders, folder]
  );
  const scopedFolders = useMemo(
    () => (folder ? filterFoldersToSelectionBranch(allFolders, folder.id) : allFolders),
    [allFolders, folder]
  );
  const fullPathLabel = folder ? formatFolderPath(allFolders, folder.id) : '';
  const treeCount = useMemo(
    () => countTreeFolders(buildFolderTree(scopedFolders)),
    [scopedFolders]
  );

  if (!account || !folder) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-muted text-[13px]">
        Select a folder from the sidebar to read mail.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PageHeader
        title={fullPathLabel || folder.name}
        subtitle={
          <span className="flex flex-col gap-1">
            <FolderBreadcrumb
              path={folderPath}
              onSelect={(f) => openFolder(f.id, displayFolderName(f))}
            />
            <span>
              {account.email} · {treeCount} folders ·{' '}
              {loading ? 'Loading…' : `${formatNumber(messages.length)} messages`}
              {source ? ` · ${source === 'live' ? 'live' : 'cached'}` : ''}
            </span>
          </span>
        }
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
        actions={
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<RefreshCw className={clsx('w-3 h-3', loading && 'animate-spin')} />}
            onClick={() => activeId && void loadFolder(activeId)}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex-1 flex flex-col xl:flex-row min-h-0 border-t border-border">
        {/* Folder tree — full mailbox hierarchy */}
        <div className="hidden xl:flex w-[220px] shrink-0 flex-col min-h-0 border-r border-border bg-bg-elevated">
          <div className="px-3 h-8 border-b border-border-subtle flex items-center justify-between shrink-0">
            <span className="label-mono text-[10px]">Folder tree</span>
            <button
              type="button"
              onClick={() => activeId && void loadFolders(activeId)}
              className="text-fg-subtle hover:text-accent"
              title="Refresh folders"
            >
              <RefreshCw className={clsx('w-3 h-3', foldersLoading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <FolderTree
              folders={scopedFolders}
              accountId={activeId}
              activeFolderId={folder.id}
              onSelect={(f) => openFolder(f.id, displayFolderName(f))}
              colorFor={(id, i) => colorFor(activeId ?? '', id, i)}
              variant="panel"
            />
          </div>
        </div>

        {/* Message list */}
        <div
          className={clsx(
            'shrink-0 flex flex-col min-h-0 border-r border-border bg-bg w-full xl:w-[min(340px,32%)]',
            selectedId ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="px-3 h-8 border-b border-border-subtle flex items-center shrink-0">
            <span className="label-mono text-[10px]">Messages</span>
          </div>
          <LoadingBar active={loading && messages.length > 0} />
          {loading && !messages.length ? (
            <div className="flex-1 flex flex-col min-h-0">
              <LoadingIndicator label="Loading messages" className="py-6" />
              <SkeletonRows rows={5} />
            </div>
          ) : error ? (
            <div className="p-4 text-[12px] text-danger">{error}</div>
          ) : !messages.length ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Inbox className="w-8 h-8 text-fg-dim mb-3" />
              <div className="text-[13px] text-fg-muted">No messages in this folder.</div>
              <div className="text-[11px] text-fg-subtle mt-1 max-w-[240px]">
                Subfolders may have their own mail. Expand the tree or run Analyze to sync.
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {messages.map((m, i) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => activeId && void selectMessage(activeId, m.id)}
                    className={clsx(
                      'mail-row-enter w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors',
                      active
                        ? 'bg-accent/10 border-l-2 border-l-accent'
                        : 'hover:bg-bg-hover border-l-2 border-l-transparent',
                      m.isUnread && !active && 'bg-bg-elevated/50'
                    )}
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span
                        className={clsx(
                          'text-[12px] truncate',
                          m.isUnread ? 'font-semibold text-fg' : 'text-fg-muted'
                        )}
                      >
                        {m.fromName || m.fromEmail}
                      </span>
                      <span className="text-[10px] font-mono text-fg-subtle shrink-0 tabular-nums">
                        {formatDistanceToNow(m.receivedAt, { addSuffix: true })}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        'text-[12px] truncate mb-0.5',
                        m.isUnread ? 'text-fg' : 'text-fg-muted'
                      )}
                    >
                      {m.subject || '(no subject)'}
                    </div>
                    <div className="text-[11px] text-fg-subtle line-clamp-2 leading-snug">
                      {m.snippet || m.fromEmail}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Reading pane */}
        <div
          className={clsx(
            'flex-1 flex flex-col min-w-0 min-h-0 bg-bg',
            selectedId ? 'flex' : 'hidden md:flex'
          )}
        >
          <div className="px-3 h-8 border-b border-border-subtle flex items-center gap-2 shrink-0">
            {selectedId && (
              <button
                type="button"
                className="md:hidden p-1 -ml-1 text-fg-subtle hover:text-fg"
                onClick={() => clearPreview()}
                aria-label="Back to message list"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <span className="label-mono text-[10px]">Preview</span>
          </div>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-fg-subtle text-[12px] font-mono uppercase tracking-widest">
              Select a message
            </div>
          ) : previewLoading ? (
            <LoadingIndicator label="Loading preview" variant="dots" className="flex-1 preview-loading" />
          ) : preview ? (
            <>
              <div className="px-5 py-4 border-b border-border-subtle shrink-0">
                <h2 className="text-[15px] font-medium text-fg leading-snug mb-2">
                  {preview.subject}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
                  <span>
                    <span className="text-fg-subtle font-mono uppercase tracking-wider mr-1">
                      From
                    </span>
                    {preview.fromName}{' '}
                    <span className="text-fg-subtle">&lt;{preview.fromEmail}&gt;</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {new Date(preview.receivedAt).toLocaleString()}
                  </span>
                  {preview.isUnread && (
                    <span className="px-1.5 py-px bg-accent/15 text-accent font-mono text-[9px] uppercase tracking-widest">
                      Unread
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {preview.bodyHtml ? (
                  <div
                    className="email-preview-html text-[13px] text-fg leading-relaxed max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(preview.bodyHtml) }}
                  />
                ) : (
                  <div className="text-[13px] text-fg leading-relaxed whitespace-pre-wrap">
                    {preview.bodyText || preview.snippet || 'No content.'}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-fg-subtle">
              <Mail className="w-5 h-5 mr-2 opacity-40" />
              Preview unavailable
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
