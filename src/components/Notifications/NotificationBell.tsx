import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Mail,
  CircleCheck,
  TriangleAlert,
  Ban,
  Folder,
  SlidersHorizontal,
  RefreshCw,
  Lock,
} from 'lucide-react';
import clsx from 'clsx';
import type { NotificationRecord } from '@shared/types';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { useLiveBadge, useLiveNotifications, useLiveStatus } from '@/hooks/useLiveSync';
import { usePrefsStore } from '@/stores/prefsStore';
import { useUIStore } from '@/stores/uiStore';
import { useAccountsStore } from '@/stores/accountsStore';
import { Icon, topBarIconBtn, topBarIconBtnActive } from '@/components/ui/Icon';
import { ApprovalModal } from './ApprovalModal';

type Tab = 'all' | 'pending' | 'actions' | 'sync';

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function iconFor(type: NotificationRecord['iconType']) {
  switch (type) {
    case 'email':
      return Mail;
    case 'check':
      return CircleCheck;
    case 'warning':
      return TriangleAlert;
    case 'block':
      return Ban;
    case 'folder':
      return Folder;
    case 'rule':
      return SlidersHorizontal;
    case 'sync':
      return RefreshCw;
    case 'auth':
      return Lock;
    default:
      return Bell;
  }
}

function iconColor(type: NotificationRecord['iconType']) {
  switch (type) {
    case 'check':
      return 'text-ok';
    case 'warning':
      return 'text-warn';
    case 'block':
      return 'text-danger';
    case 'sync':
      return 'text-accent';
    case 'auth':
      return 'text-warn';
    default:
      return 'text-fg-muted';
  }
}

function filterTab(tab: Tab, n: NotificationRecord): boolean {
  switch (tab) {
    case 'pending':
      return ['APPROVAL_NEEDED', 'JUNK_RESCUE', 'AUTH_REQUIRED'].includes(n.type);
    case 'actions':
      return n.type === 'AUTO_ACTION_APPLIED';
    case 'sync':
      return ['SYNC_STARTED', 'SYNC_COMPLETE', 'SYNC_ERROR'].includes(n.type);
    default:
      return true;
  }
}

function priorityBorder(p: number) {
  if (p === 1) return 'border-l-[3px] border-l-danger';
  if (p === 2) return 'border-l-[3px] border-l-warn';
  if (p === 3) return 'border-l-[3px] border-l-accent';
  return '';
}

export function NotificationBell() {
  const notifications = useLiveNotifications();
  const badgeCount = useLiveBadge();
  const status = useLiveStatus();
  const liveEnabled = usePrefsStore((s) => s.prefs.liveSync.enabled);
  const dropdownOpen = useLiveSyncStore((s) => s.dropdownOpen);
  const setDropdownOpen = useLiveSyncStore((s) => s.setDropdownOpen);
  const bellRinging = useLiveSyncStore((s) => s.bellRinging);
  const unreadDot = useLiveSyncStore((s) => s.unreadDot);
  const markAllRead = useLiveSyncStore((s) => s.markAllRead);
  const dismiss = useLiveSyncStore((s) => s.dismiss);
  const setApprovalOpen = useLiveSyncStore((s) => s.setApprovalOpen);
  const undoAction = useLiveSyncStore((s) => s.undoAction);
  const setRoute = useUIStore((s) => s.setRoute);
  const reauth = useAccountsStore((s) => s.reauth);

  const [tab, setTab] = useState<Tab>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [dropdownOpen, setDropdownOpen]);

  const filtered = notifications.filter((n) => !n.dismissedAt && filterTab(tab, n));
  const pendingTabCount = notifications.filter(
    (n) => !n.dismissedAt && filterTab('pending', n)
  ).length;
  const syncActive = liveEnabled && status?.enabled;
  const hasUrgent = badgeCount > 0;

  const onRowClick = (n: NotificationRecord) => {
    if (n.actionUrl === 'senders') setRoute('senders');
    if (n.actionUrl === 'dashboard') setRoute('dashboard');
    if (n.actionUrl === 'reauth') void reauth(n.accountId);
    if (n.actionUrl === 'approval' && n.pendingId) setApprovalOpen(true, n.pendingId);
    if (n.type === 'APPROVAL_NEEDED' || n.type === 'JUNK_RESCUE') {
      if (n.pendingId) setApprovalOpen(true, n.pendingId);
    }
    setDropdownOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={dropdownOpen}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={clsx(
          dropdownOpen || hasUrgent ? topBarIconBtnActive : topBarIconBtn,
          'relative'
        )}
        title="Notifications"
      >
        <Icon
          icon={Bell}
          size="sm"
          className={clsx(
            bellRinging && 'animate-bell-ring origin-top',
            hasUrgent && 'text-accent',
            dropdownOpen && !hasUrgent && 'text-fg'
          )}
        />
        {hasUrgent && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center text-[8px] font-mono leading-none bg-danger text-white rounded-full animate-badge-pop">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {!hasUrgent && unreadDot && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent ring-2 ring-bg-elevated" />
        )}
        {syncActive && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ok/80" />
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[380px] max-h-[520px] flex flex-col bg-bg-elevated border border-border rounded-lg shadow-2xl z-50 animate-dropdown-in">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="text-[13px] font-medium text-fg">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[10px] font-mono uppercase tracking-wider text-accent hover:underline"
            >
              Mark all read
            </button>
          </div>

          <div className="flex gap-1 px-2 py-1.5 border-b border-border-subtle text-[10px] font-mono uppercase tracking-wider">
            {(['all', 'pending', 'actions', 'sync'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx(
                  'px-2 py-1 rounded-sm',
                  tab === t ? 'text-accent border-b border-accent' : 'text-fg-muted hover:text-fg'
                )}
              >
                {t === 'all' ? 'All' : t === 'pending' ? `Pending (${pendingTabCount})` : t === 'actions' ? 'Actions' : 'Sync'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-[120px]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-fg-muted text-[12px]">
                {tab === 'pending' ? 'No pending approvals' : tab === 'actions' ? 'No automated actions yet' : "You're all caught up"}
              </div>
            ) : (
              filtered.map((n) => {
                const RowIcon = iconFor(n.iconType);
                const undoable =
                  n.actionLogId &&
                  n.type === 'AUTO_ACTION_APPLIED' &&
                  Date.now() < n.createdAt + 30 * 60_000;
                return (
                  <div
                    key={n.id}
                    className={clsx(
                      'px-3 py-2.5 border-b border-border-subtle/50 cursor-pointer hover:bg-bg-hover',
                      priorityBorder(n.priority),
                      !n.readAt && 'bg-bg-surface/50'
                    )}
                    onClick={() => onRowClick(n)}
                    onKeyDown={(e) => e.key === 'Enter' && onRowClick(n)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex gap-2.5">
                      <Icon
                        icon={RowIcon}
                        size="lg"
                        spin={n.iconType === 'sync' && n.type === 'SYNC_STARTED'}
                        className={clsx('mt-0.5', iconColor(n.iconType))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-[13px] font-medium text-fg truncate">{n.title}</span>
                          <span className="text-[10px] text-fg-subtle shrink-0">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="text-[12px] text-fg-muted truncate">{n.body}</p>
                        <p className="text-[10px] font-mono text-fg-subtle mt-0.5">{n.accountEmail}</p>
                        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          {(n.type === 'APPROVAL_NEEDED' || n.type === 'JUNK_RESCUE') && n.pendingId && (
                            <>
                              <button
                                type="button"
                                className="text-[10px] font-mono uppercase text-accent"
                                onClick={() => setApprovalOpen(true, n.pendingId!)}
                              >
                                Review →
                              </button>
                              <button
                                type="button"
                                className="text-[10px] font-mono uppercase text-fg-muted"
                                onClick={() => void dismiss(n.id)}
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                          {n.type === 'AUTO_ACTION_APPLIED' && n.actionLogId && (
                            <>
                              <button
                                type="button"
                                disabled={!undoable}
                                className={clsx(
                                  'text-[10px] font-mono uppercase',
                                  undoable ? 'text-fg-muted' : 'text-fg-subtle opacity-40'
                                )}
                                onClick={() => void undoAction(n.actionLogId!)}
                              >
                                Undo
                              </button>
                              <button
                                type="button"
                                className="text-[10px] font-mono uppercase text-accent"
                                onClick={() => void dismiss(n.id)}
                              >
                                OK
                              </button>
                            </>
                          )}
                          {n.type === 'AUTH_REQUIRED' && (
                            <button
                              type="button"
                              className="text-[10px] font-mono uppercase text-accent"
                              onClick={() => void reauth(n.accountId)}
                            >
                              Reconnect →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-border-subtle text-[10px] text-fg-muted">
            <div className="flex items-center gap-2 mb-1">
              <span>Live sync: {syncActive ? 'Active' : 'Off'}</span>
              {status?.accounts.map((a) => (
                <span
                  key={a.accountId}
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    a.status === 'active' && 'bg-ok',
                    a.status === 'polling' && 'bg-accent animate-pulse-soft',
                    a.status === 'paused' && 'bg-warn',
                    a.status === 'error' && 'bg-danger'
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              className="text-accent hover:underline font-mono uppercase tracking-wider"
              onClick={() => {
                setRoute('notifications');
                setDropdownOpen(false);
              }}
            >
              View all in notification center
            </button>
          </div>
        </div>
      )}

      <ApprovalModal />
    </div>
  );
}
