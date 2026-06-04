import { create } from 'zustand';
import type {
  LiveSyncStatusPayload,
  NotificationRecord,
  PendingActionRecord,
} from '@shared/types';

interface LiveSyncState {
  status: LiveSyncStatusPayload | null;
  notifications: NotificationRecord[];
  pending: PendingActionRecord[];
  badgeCount: number;
  unreadDot: boolean;
  dropdownOpen: boolean;
  approvalOpen: boolean;
  approvalPendingId: string | null;
  bellRinging: boolean;
  lastModalShownAt: number;

  bootstrap: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshPending: () => Promise<void>;
  setDropdownOpen: (open: boolean) => void;
  setApprovalOpen: (open: boolean, pendingId?: string | null) => void;
  addNotification: (n: NotificationRecord) => void;
  addPending: (p: PendingActionRecord) => void;
  setStatus: (s: LiveSyncStatusPayload) => void;
  setBadge: (count: number) => void;
  triggerBellRing: () => void;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  resolvePending: (id: string, resolution: 'approved' | 'rejected' | 'dismissed') => Promise<void>;
  undoAction: (actionLogId: string) => Promise<boolean>;
  setLiveSyncEnabled: (enabled: boolean) => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  checkNow: () => Promise<void>;
}

export const useLiveSyncStore = create<LiveSyncState>((set, get) => ({
  status: null,
  notifications: [],
  pending: [],
  badgeCount: 0,
  unreadDot: false,
  dropdownOpen: false,
  approvalOpen: false,
  approvalPendingId: null,
  bellRinging: false,
  lastModalShownAt: 0,

  async bootstrap() {
    try {
      const [status, notifications, pending] = await Promise.all([
        window.mailvault.liveSyncStatus(),
        window.mailvault.listNotifications({ limit: 100 }),
        window.mailvault.listPendingActions(),
      ]);
      set({
        status: status as LiveSyncStatusPayload,
        notifications: notifications as NotificationRecord[],
        pending: pending as PendingActionRecord[],
        badgeCount: (status as LiveSyncStatusPayload).pendingBadgeCount ?? 0,
        unreadDot: (status as LiveSyncStatusPayload).unreadDot ?? false,
      });
    } catch {
      // non-fatal
    }
  },

  async refreshNotifications() {
    const notifications = (await window.mailvault.listNotifications({ limit: 100 })) as NotificationRecord[];
    set({ notifications });
  },

  async refreshPending() {
    const pending = (await window.mailvault.listPendingActions()) as PendingActionRecord[];
    set({ pending, badgeCount: pending.filter((p) => p.priority <= 2).length });
  },

  setDropdownOpen(open) {
    set({ dropdownOpen: open });
  },

  setApprovalOpen(open, pendingId = null) {
    set({ approvalOpen: open, approvalPendingId: pendingId });
    if (open) set({ lastModalShownAt: Date.now() });
  },

  addNotification(n) {
    set((s) => ({ notifications: [n, ...s.notifications].slice(0, 200) }));
    if (n.priority <= 2 && !n.readAt) get().triggerBellRing();
    if (n.type === 'NEW_EMAIL' || n.type === 'AUTO_ACTION_APPLIED') {
      set({ unreadDot: true });
    }
  },

  addPending(p) {
    set((s) => ({
      pending: [p, ...s.pending],
      badgeCount: s.badgeCount + (p.priority <= 2 ? 1 : 0),
    }));
  },

  setStatus(status) {
    set({
      status,
      badgeCount: status.pendingBadgeCount,
      unreadDot: status.unreadDot,
    });
  },

  setBadge(count) {
    set({ badgeCount: count });
  },

  triggerBellRing() {
    if (get().bellRinging) return;
    set({ bellRinging: true });
    setTimeout(() => set({ bellRinging: false }), 700);
  },

  async markAllRead() {
    await window.mailvault.markNotificationsRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, readAt: n.readAt ?? Date.now() })),
      unreadDot: false,
    }));
  },

  async dismiss(id) {
    await window.mailvault.dismissNotification(id);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, dismissedAt: Date.now(), readAt: n.readAt ?? Date.now() } : n
      ),
    }));
  },

  async resolvePending(id, resolution) {
    await window.mailvault.resolvePendingAction(id, resolution);
    await get().refreshPending();
    await get().refreshNotifications();
  },

  async undoAction(actionLogId) {
    const r = await window.mailvault.undoLiveAction(actionLogId);
    await get().refreshNotifications();
    return !!r.ok;
  },

  async setLiveSyncEnabled(enabled) {
    const status = (await window.mailvault.liveSyncSetEnabled(enabled)) as LiveSyncStatusPayload;
    set({ status });
  },

  async pauseSync() {
    const status = (await window.mailvault.liveSyncPause()) as LiveSyncStatusPayload;
    set({ status });
  },

  async resumeSync() {
    const status = (await window.mailvault.liveSyncResume()) as LiveSyncStatusPayload;
    set({ status });
  },

  async checkNow() {
    const status = (await window.mailvault.liveSyncCheckNow()) as LiveSyncStatusPayload;
    set({ status });
  },
}));
