import { useState } from 'react';
import { Lightbulb, Check, X, Settings2, Sparkles } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useSyncStore } from '@/stores/syncStore';
import { useFoldersStore } from '@/stores/foldersStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';
import type { FolderSuggestion } from '@shared/types';
import { formatNumber, formatBytes } from '@/lib/format';

export function SmartSuggestions() {
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const dismiss = useSyncStore((s) => s.dismissSuggestion);
  const removeMessages = useSyncStore((s) => s.removeMessages);
  const create = useFoldersStore((s) => s.create);
  const setColor = useFoldersStore((s) => s.setColor);
  const showToast = useUIStore((s) => s.showToast);

  const [working, setWorking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!sync || !sync.suggestions.length) {
    return (
      <div className="panel p-5 border-dashed">
        <div className="flex items-center gap-2 text-fg-muted">
          <Lightbulb className="w-3.5 h-3.5 text-fg-subtle" />
          <div className="font-mono text-[11px] uppercase tracking-[0.16em]">No suggestions yet</div>
        </div>
        <div className="text-xs text-fg-subtle mt-1">
          Run an analysis from the Analyze tab and we'll surface folder suggestions based on your senders.
        </div>
      </div>
    );
  }

  const onCreateAndMove = async (s: FolderSuggestion) => {
    if (!activeId) return;
    setWorking(s.id);
    try {
      const folder = await create(activeId, s.folderName);
      if (!folder) throw new Error('Failed to create folder');

      const palette = ['#00d4ff', '#00e676', '#ffab00', '#9b8cff', '#ff7eb6'];
      setColor(activeId, folder.id, palette[s.id.length % palette.length]);

      const senderEmails = new Set(s.senders.map((sd) => sd.email));
      const messageIds = sync.messages
        .filter((m) => senderEmails.has(m.fromEmail))
        .map((m) => m.id);

      if (messageIds.length) {
        const result = await window.mailvault.moveEmails(activeId, {
          messageIds,
          destinationFolderId: folder.id,
        });
        removeMessages(activeId, new Set(messageIds));
        showToast(
          'ok',
          `Created "${folder.name}" and moved ${result.moved} email${result.moved === 1 ? '' : 's'}`
        );
      } else {
        showToast('ok', `Created "${folder.name}"`);
      }
      dismiss(activeId, s.id);
    } catch (e) {
      showToast('err', `Failed: ${(e as Error).message}`);
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-warn" />
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
            Smart Folder Suggestions
          </div>
          <div className="text-[11px] text-fg-subtle">
            {sync.suggestions.length} suggestion{sync.suggestions.length === 1 ? '' : 's'} from
            your last sync · Click "show reasoning" to inspect
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sync.suggestions.map((s) => {
          const isOpen = expanded === s.id;
          return (
            <div key={s.id} className="panel-inset">
              <div className="grid grid-cols-12 items-center gap-3 px-3 py-2.5">
                <div className="col-span-5">
                  <div className="text-sm font-medium text-fg flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-warn">
                      {s.category}
                    </span>
                    →
                    <span>"{s.folderName}"</span>
                  </div>
                  <div className="text-[11px] text-fg-muted mt-0.5">{s.reason}</div>
                </div>
                <div className="col-span-3 font-mono text-[12px] text-fg tabular-nums">
                  <span className="text-accent">{formatNumber(s.totalCount)}</span> emails ·{' '}
                  <span className="text-fg-muted">
                    {formatBytes(
                      s.senders.reduce((acc, sd) => acc + sd.bytes, 0)
                    )}
                  </span>
                </div>
                <div className="col-span-4 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="btn btn-ghost !h-6 !px-2 !text-[10px]"
                  >
                    <Settings2 className="w-3 h-3" />
                    {isOpen ? 'Hide reasoning' : 'Show reasoning'}
                  </button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => activeId && dismiss(activeId, s.id)}
                    iconLeft={<X className="w-3 h-3" />}
                  >
                    Skip
                  </Button>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={() => onCreateAndMove(s)}
                    disabled={working === s.id}
                    iconLeft={<Check className="w-3 h-3" />}
                  >
                    {working === s.id ? 'Working…' : 'Create & Move'}
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border-subtle px-3 py-2 bg-bg-inset animate-fade-in">
                  <div className="label-mono mb-2">Senders included</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {s.senders.map((sd) => (
                      <div
                        key={sd.email}
                        className="flex items-center gap-3 text-[11px] font-mono text-fg-muted"
                      >
                        <span className="flex-1 truncate">{sd.email}</span>
                        <span className="text-fg-subtle tabular-nums shrink-0">
                          {formatNumber(sd.count)}
                        </span>
                        <span className="text-fg-subtle tabular-nums w-16 text-right shrink-0">
                          {formatBytes(sd.bytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
