import { useEffect } from 'react';
import type { NotificationRecord } from '@shared/types';
import { usePrefsStore } from '@/stores/prefsStore';
import { useUIStore } from '@/stores/uiStore';

/** In-app toasts when a manual sync finishes or fails. */
export function useSyncNotifications() {
  const showToast = useUIStore((s) => s.showToast);
  const notifyOnSyncComplete = usePrefsStore(
    (s) => s.prefs.liveSync.notifications.notifyOnSyncComplete
  );

  useEffect(() => {
    const off = window.mailvault.onLiveNotification((n) => {
      if (!notifyOnSyncComplete) return;
      const rec = n as NotificationRecord;
      if (rec.type === 'SYNC_COMPLETE') {
        showToast('ok', rec.body);
        return;
      }
      if (rec.type === 'SYNC_ERROR' && rec.title === 'Sync failed') {
        showToast('err', rec.body);
      }
    });
    return off;
  }, [showToast, notifyOnSyncComplete]);
}
