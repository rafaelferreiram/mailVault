import { create } from 'zustand';
import type { BlockedSender } from '@shared/types';

interface BlockedState {
  byAccount: Record<string, BlockedSender[]>;
  loading: boolean;
  load: (accountId: string) => Promise<void>;
  block: (
    accountId: string,
    payload: { email: string; name?: string; deleteHistorical: boolean; messageIds: string[] }
  ) => Promise<{ blocked: BlockedSender; deletedCount: number } | null>;
  unblock: (accountId: string, email: string) => Promise<boolean>;
}

export const useBlockedStore = create<BlockedState>((set) => ({
  byAccount: {},
  loading: false,
  load: async (accountId) => {
    set({ loading: true });
    try {
      const list = await window.mailvault.listBlocked(accountId);
      set((s) => ({
        byAccount: { ...s.byAccount, [accountId]: list },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },
  block: async (accountId, payload) => {
    try {
      const result = await window.mailvault.blockSender(accountId, payload);
      set((s) => {
        const cur = s.byAccount[accountId] ?? [];
        const idx = cur.findIndex((b) => b.email === result.blocked.email);
        const next = [...cur];
        if (idx >= 0) next[idx] = result.blocked;
        else next.push(result.blocked);
        return { byAccount: { ...s.byAccount, [accountId]: next } };
      });
      return result;
    } catch {
      return null;
    }
  },
  unblock: async (accountId, email) => {
    const ok = await window.mailvault.unblockSender(accountId, email);
    if (ok) {
      set((s) => {
        const cur = s.byAccount[accountId] ?? [];
        return {
          byAccount: { ...s.byAccount, [accountId]: cur.filter((b) => b.email !== email) },
        };
      });
    }
    return ok;
  },
}));
