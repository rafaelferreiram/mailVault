import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import type { EmailListDensity, UnreadStyleMode } from '@shared/types';
import { senderColorHash, senderInitials } from './mockEmails';

export interface MockEmailRowProps {
  sender: string;
  subject: string;
  preview: string;
  date: string;
  categoryColor: string;
  isUnread: boolean;
  hasAttachment: boolean;
  density: EmailListDensity;
  previewLines: 1 | 2 | 3;
  showAvatar: boolean;
  showCategoryBadge: boolean;
  unreadStyle: UnreadStyleMode;
  selected: boolean;
  onClick: () => void;
}

export function MockEmailRow({
  sender,
  subject,
  preview,
  date,
  categoryColor,
  isUnread,
  hasAttachment,
  density,
  previewLines,
  showAvatar,
  showCategoryBadge,
  unreadStyle,
  selected,
  onClick,
}: MockEmailRowProps) {
  const h =
    density === 'comfortable' ? 64 : density === 'compact' ? 40 : 28;
  const avatarColor = senderColorHash(sender);
  const bold = isUnread && unreadStyle !== 'none';
  const rowBg =
    isUnread && unreadStyle === 'row-bg' ? 'bg-accent/8' : selected ? 'bg-bg-hover' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 border-b border-border-subtle transition-colors hover:bg-bg-hover',
        rowBg,
        density === 'condensed' && 'text-[11px]'
      )}
      style={{ minHeight: h, height: h }}
    >
      {density === 'condensed' ? (
        <div className="flex items-center gap-2 h-full">
          {showCategoryBadge && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: categoryColor }} />
          )}
          <span className={clsx('truncate shrink-0 max-w-[28%]', bold && 'font-semibold')}>{sender}</span>
          <span className="truncate flex-1 text-fg-muted">{subject}</span>
          {isUnread && unreadStyle === 'bold-dot' && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          )}
          <span className="text-fg-subtle shrink-0 text-[10px]">{date}</span>
        </div>
      ) : density === 'compact' ? (
        <div className="flex items-center gap-2 h-full">
          {showAvatar ? (
            <span
              className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold text-white"
              style={{ background: avatarColor }}
            >
              {senderInitials(sender)}
            </span>
          ) : showCategoryBadge ? (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryColor }} />
          ) : null}
          <span className={clsx('truncate shrink-0', bold && 'font-semibold')}>{sender}</span>
          <span className="text-fg-subtle">—</span>
          <span className="truncate flex-1 text-fg-muted">{subject}</span>
          <span className="text-fg-subtle shrink-0 text-[10px]">{date}</span>
          {hasAttachment && <Paperclip className="w-3 h-3 text-fg-subtle shrink-0" />}
        </div>
      ) : (
        <div className="flex gap-2 py-1.5">
          {showAvatar ? (
            <span
              className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold text-white mt-0.5"
              style={{ background: avatarColor }}
            >
              {senderInitials(sender)}
            </span>
          ) : showCategoryBadge ? (
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-2"
              style={{ background: categoryColor }}
            />
          ) : (
            <span className="w-9 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={clsx('truncate text-[12px]', bold && 'font-semibold')}>{sender}</span>
              <span className="text-[10px] text-fg-subtle ml-auto shrink-0">{date}</span>
            </div>
            <div className="text-[12px] truncate text-fg">{subject}</div>
            <p
              className="text-[11px] text-fg-muted mt-0.5"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: previewLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {preview}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isUnread && unreadStyle === 'bold-dot' && (
              <span className="w-2 h-2 rounded-full bg-accent" />
            )}
            {hasAttachment && <Paperclip className="w-3 h-3 text-fg-subtle" />}
          </div>
        </div>
      )}
    </button>
  );
}
