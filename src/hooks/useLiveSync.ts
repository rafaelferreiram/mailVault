import { useEffect } from 'react';
import type { LiveSyncStatusPayload, NotificationRecord, PendingActionRecord } from '@shared/types';
import { useLiveSyncStore } from '@/stores/liveSyncStore';

export function useLiveNotifications(): NotificationRecord[] {
  return useLiveSyncStore((s) => s.notifications);
}

export function usePendingActions(): PendingActionRecord[] {
  return useLiveSyncStore((s) => s.pending);
}

export function useLiveBadge(): number {
  return useLiveSyncStore((s) => s.badgeCount);
}

export function useLiveStatus(): LiveSyncStatusPayload | null {
  return useLiveSyncStore((s) => s.status);
}

/** Subscribe to live sync IPC events once at app root. */
export function useLiveSyncSubscriptions() {
  const addNotification = useLiveSyncStore((s) => s.addNotification);
  const addPending = useLiveSyncStore((s) => s.addPending);
  const setStatus = useLiveSyncStore((s) => s.setStatus);
  const setBadge = useLiveSyncStore((s) => s.setBadge);

  useEffect(() => {
    const offN = window.mailvault.onLiveNotification((n) =>
      addNotification(n as NotificationRecord)
    );
    const offP = window.mailvault.onLivePending((p) => addPending(p as PendingActionRecord));
    const offB = window.mailvault.onLiveBadge((b) => setBadge((b as { count: number }).count));
    const offS = window.mailvault.onLiveStatus((s) => setStatus(s as LiveSyncStatusPayload));
    return () => {
      offN();
      offP();
      offB();
      offS();
    };
  }, [addNotification, addPending, setBadge, setStatus]);
}
