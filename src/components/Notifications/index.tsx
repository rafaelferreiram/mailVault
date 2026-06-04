import { useLiveNotifications } from '@/hooks/useLiveSync';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { NotificationBell } from './NotificationBell';

export { NotificationBell } from './NotificationBell';
export { ApprovalModal } from './ApprovalModal';
export { LiveStatusIndicator } from './LiveStatusIndicator';

export function NotificationCenter() {
  const notifications = useLiveNotifications();
  const markAllRead = useLiveSyncStore((s) => s.markAllRead);
  const dismiss = useLiveSyncStore((s) => s.dismiss);

  const visible = notifications.filter((n) => !n.dismissedAt);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-fg">Notifications</h1>
        <button
          type="button"
          onClick={() => void markAllRead()}
          className="text-[11px] font-mono uppercase tracking-wider text-accent"
        >
          Mark all read
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {visible.length === 0 ? (
          <p className="text-fg-muted text-[13px]">You&apos;re all caught up.</p>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className="p-4 border border-border-subtle bg-bg-elevated/50 rounded-md flex justify-between gap-4"
            >
              <div>
                <div className="text-[14px] font-medium text-fg">{n.title}</div>
                <p className="text-[12px] text-fg-muted mt-1">{n.body}</p>
                <p className="text-[10px] font-mono text-fg-subtle mt-2">{n.accountEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => void dismiss(n.id)}
                className="text-[10px] font-mono uppercase text-fg-muted shrink-0 h-fit"
              >
                Dismiss
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
