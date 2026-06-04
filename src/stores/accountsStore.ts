import { create } from 'zustand';
import type { AccountProfile } from '@shared/types';

interface AccountsState {
  accounts: AccountProfile[];
  activeId: string | null;
  loading: boolean;
  loginInProgress: 'google' | 'microsoft' | null;
  error: string | null;
  /** Last auth-error code surfaced to the UI (e.g. for showing "Reconnect" CTA). */
  errorCode: string | null;

  refresh: () => Promise<void>;
  setActive: (id: string) => void;
  login: (provider: 'google' | 'microsoft') => Promise<AccountProfile | null>;
  reauth: (accountId: string) => Promise<AccountProfile | null>;
  logout: (id: string) => Promise<void>;
  /** Set on a needs-reauth event from the main process. */
  markNeedsReauth: (accountId: string, message?: string) => void;
  clearError: () => void;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  activeId: null,
  loading: false,
  loginInProgress: null,
  error: null,
  errorCode: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const accounts = await window.mailvault.listAccounts();
      const settings = await window.mailvault.getSettings();
      let activeId = settings.activeAccountId ?? null;
      if (activeId && !accounts.find((a) => a.id === activeId)) activeId = null;
      if (!activeId && accounts.length) activeId = accounts[0].id;
      set({ accounts, activeId, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  setActive: (id) => {
    set({ activeId: id });
    void window.mailvault.setSettings({ activeAccountId: id });
  },

  login: async (provider) => {
    if (get().accounts.length >= 4) {
      set({ error: 'Maximum of 4 accounts reached. Remove one first.', errorCode: null });
      return null;
    }
    set({ loginInProgress: provider, error: null, errorCode: null });
    const result = await window.mailvault.authLogin(provider);
    if (!result.ok) {
      set({
        loginInProgress: null,
        error: result.error.message,
        errorCode: result.error.code ?? null,
      });
      return null;
    }
    await get().refresh();
    get().setActive(result.profile.id);
    set({ loginInProgress: null });
    return result.profile;
  },

  reauth: async (accountId) => {
    set({ loginInProgress: get().loginInProgress, error: null, errorCode: null });
    const result = await window.mailvault.authReauth(accountId);
    if (!result.ok) {
      set({ error: result.error.message, errorCode: result.error.code ?? null });
      return null;
    }
    await get().refresh();
    return result.profile;
  },

  logout: async (id) => {
    await window.mailvault.authLogout(id);
    await get().refresh();
  },

  markNeedsReauth: (accountId, message) => {
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, needsReauth: true } : a)),
      error: message ?? `Account needs to be reconnected.`,
      errorCode: 'invalid_grant',
    }));
  },

  clearError: () => set({ error: null, errorCode: null }),
}));

// Subscribe to main-process auth events.
if (typeof window !== 'undefined' && window.mailvault?.onAuthChanged) {
  window.mailvault.onAuthChanged((p) => {
    if (p.type === 'needs-reauth') {
      useAccountsStore.getState().markNeedsReauth(p.accountId, p.message);
    } else if (p.type === 'removed') {
      void useAccountsStore.getState().refresh();
    }
  });
}
