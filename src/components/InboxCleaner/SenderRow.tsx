import { ChevronDown, ChevronRight, ShieldOff, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { SenderGroup, EmailMessage } from '@shared/types';
import { Checkbox } from '../ui/Checkbox';
import { Avatar } from '../ui/Avatar';
import { formatBytes, formatDateRange, formatNumber } from '@/lib/format';
import { useBlockedStore } from '@/stores/blockedStore';
import { useUIStore } from '@/stores/uiStore';
import { useSyncStore } from '@/stores/syncStore';

interface Props {
  group: SenderGroup;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  messages: EmailMessage[];
  accountId: string;
}

export function SenderRow({
  group,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  messages,
  accountId,
}: Props) {
  const block = useBlockedStore((s) => s.block);
  const showToast = useUIStore((s) => s.showToast);
  const openMovePicker = useUIStore((s) => s.openMovePicker);
  const removeMessages = useSyncStore((s) => s.removeMessages);

  const onBlock = async () => {
    const deleteHistorical = confirm(
      `Block ${group.email}?\n\nA filter will auto-delete future emails.\n\nClick OK to also delete the ${formatNumber(group.count)} existing emails. Cancel to only block future emails.`
    );
    const result = await block(accountId, {
      email: group.email,
      name: group.name,
      deleteHistorical,
      messageIds: deleteHistorical ? group.messageIds : [],
    });
    if (result) {
      if (deleteHistorical && result.deletedCount > 0) {
        removeMessages(accountId, new Set(group.messageIds));
      }
      showToast(
        'ok',
        `Blocked ${group.email}${deleteHistorical ? ` and removed ${result.deletedCount}` : ''}`
      );
    } else {
      showToast('err', `Failed to block ${group.email}`);
    }
  };

  return (
    <div
      className={clsx(
        'transition-colors',
        selected ? 'bg-accent/[0.06] outline outline-1 outline-accent/40' : 'hover:bg-bg-hover'
      )}
    >
      <div className="grid grid-cols-12 px-3 grid-row items-center gap-2 group data-grid-row">
        <div className="col-span-1">
          <Checkbox checked={selected} onChange={onToggleSelect} size="sm" />
        </div>

        <div className="col-span-5 min-w-0 flex items-center gap-2.5">
          <button onClick={onToggleExpand} className="text-fg-subtle hover:text-fg shrink-0">
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <Avatar email={group.email} name={group.name} size={20} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate flex items-center gap-2">
              {group.name}
              {group.unreadCount > 0 && (
                <span className="text-[9px] font-mono px-1 h-[14px] bg-accent/10 text-accent border border-accent/30 shrink-0">
                  {group.unreadCount} UN
                </span>
              )}
              {group.isNewsletter && (
                <span className="text-[9px] font-mono px-1 h-[14px] bg-warn/10 text-warn border border-warn/30 shrink-0">
                  NEWS
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-fg-subtle truncate">{group.email}</div>
          </div>
        </div>

        <div className="col-span-1 text-right font-mono tabular-nums text-[12px]">
          {formatNumber(group.count)}
        </div>
        <div className="col-span-2 text-right font-mono tabular-nums text-[12px]">
          {formatBytes(group.totalBytes)}
        </div>
        <div className="col-span-2 text-right font-mono text-[10px] text-fg-muted">
          {formatDateRange(group.oldestAt, group.newestAt)}
        </div>

        <div className="col-span-1 flex items-center justify-end gap-0.5">
          <button
            onClick={() => openMovePicker([group.email])}
            className="p-1 text-fg-subtle hover:text-accent hover:bg-accent/10 transition-colors"
            title="Move to folder (M)"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void onBlock();
            }}
            className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
            title="Block sender"
          >
            <ShieldOff className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="sender-inline-detail border-t border-border-subtle bg-bg-inset px-4 sm:px-12 py-2 animate-fade-in">
          <div className="label-mono mb-2">
            Recent subjects · showing {Math.min(messages.length, 25)} of {messages.length}
          </div>
          <div className="space-y-0.5 max-h-72 overflow-y-auto">
            {messages
              .slice()
              .sort((a, b) => b.receivedAt - a.receivedAt)
              .slice(0, 25)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 text-[10px] font-mono text-fg-muted py-0.5 hover:text-fg group"
                >
                  <span className="w-20 text-fg-subtle shrink-0">
                    {new Date(m.receivedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: '2-digit',
                    })}
                  </span>
                  <span className={clsx('flex-1 truncate', m.isUnread && 'text-fg')}>
                    {m.subject}
                  </span>
                  <span className="text-fg-subtle shrink-0">{formatBytes(m.sizeBytes)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
