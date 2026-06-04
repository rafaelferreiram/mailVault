import { create } from 'zustand';

export type Route =
  | 'dashboard'
  | 'suggestions'
  | 'analyze'
  | 'senders'
  | 'mailbox'
  | 'folders'
  | 'rules'
  | 'blocked'
  | 'settings'
  | 'notifications';

export interface PendingUndo {
  id: string;
  accountId: string;
  count: number;
  messageIds: string[];
  expiresAt: number;
  summary: string;
}

interface UIState {
  route: Route;
  setRoute: (r: Route) => void;

  selectedSenders: Set<string>;
  toggleSender: (email: string) => void;
  selectMany: (emails: string[]) => void;
  clearSelection: () => void;

  expandedSender: string | null;
  toggleExpanded: (email: string) => void;

  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;

  movePickerOpen: boolean;
  movePickerSenders: string[];
  openMovePicker: (senderEmails: string[]) => void;
  closeMovePicker: () => void;

  toast:
    | { id: string; kind: 'ok' | 'err' | 'info'; message: string; ttl: number; createdAt: number }
    | null;
  showToast: (kind: 'ok' | 'err' | 'info', message: string, ttlMs?: number) => void;
  dismissToast: () => void;

  pendingUndo: PendingUndo | null;
  setPendingUndo: (u: PendingUndo | null) => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  compact: boolean;
  toggleCompact: () => void;

  /** Prefill Senders search when navigating from dashboard. */
  sendersSearch: string | null;
  setSendersSearch: (q: string | null) => void;
  sendersFilter: 'all' | 'newsletters' | 'unread' | 'old';
  setSendersFilter: (f: 'all' | 'newsletters' | 'unread' | 'old') => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  route: 'dashboard',
  setRoute: (r) => set({ route: r }),

  selectedSenders: new Set(),
  toggleSender: (email) => {
    const next = new Set(get().selectedSenders);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    set({ selectedSenders: next });
  },
  selectMany: (emails) => set({ selectedSenders: new Set(emails) }),
  clearSelection: () => set({ selectedSenders: new Set() }),

  expandedSender: null,
  toggleExpanded: (email) =>
    set((s) => ({ expandedSender: s.expandedSender === email ? null : email })),

  reviewOpen: false,
  setReviewOpen: (open) => set({ reviewOpen: open }),

  movePickerOpen: false,
  movePickerSenders: [],
  openMovePicker: (emails) => set({ movePickerOpen: true, movePickerSenders: emails }),
  closeMovePicker: () => set({ movePickerOpen: false, movePickerSenders: [] }),

  toast: null,
  showToast: (kind, message, ttl = 4000) => {
    const id = `${Date.now()}-${Math.random()}`;
    set({ toast: { id, kind, message, ttl, createdAt: Date.now() } });
    setTimeout(() => {
      const cur = get().toast;
      if (cur && cur.id === id) set({ toast: null });
    }, ttl);
  },
  dismissToast: () => set({ toast: null }),

  pendingUndo: null,
  setPendingUndo: (u) => set({ pendingUndo: u }),

  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  compact: false,
  toggleCompact: () => {
    const next = !get().compact;
    set({ compact: next });
    document.documentElement.classList.toggle('compact', next);
  },

  sendersSearch: null,
  setSendersSearch: (q) => set({ sendersSearch: q }),
  sendersFilter: 'all',
  setSendersFilter: (f) => set({ sendersFilter: f }),
}));
