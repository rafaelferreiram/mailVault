import { create } from 'zustand';
import type { MailRule } from '@shared/types';

interface RulesState {
  byAccount: Record<string, { rules: MailRule[]; loading: boolean; error: string | null }>;
  load: (accountId: string) => Promise<void>;
  create: (accountId: string, rule: MailRule) => Promise<MailRule | null>;
  update: (accountId: string, rule: MailRule) => Promise<MailRule | null>;
  remove: (accountId: string, rule: MailRule) => Promise<boolean>;
}

export const useRulesStore = create<RulesState>((set, get) => ({
  byAccount: {},
  load: async (accountId) => {
    set((s) => ({
      byAccount: {
        ...s.byAccount,
        [accountId]: { rules: s.byAccount[accountId]?.rules ?? [], loading: true, error: null },
      },
    }));
    try {
      const rules = await window.mailvault.listRules(accountId);
      set((s) => ({
        byAccount: { ...s.byAccount, [accountId]: { rules, loading: false, error: null } },
      }));
    } catch (e) {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            rules: s.byAccount[accountId]?.rules ?? [],
            loading: false,
            error: (e as Error).message,
          },
        },
      }));
    }
  },
  create: async (accountId, rule) => {
    try {
      const created = await window.mailvault.createRule(accountId, rule);
      const cur = get().byAccount[accountId]?.rules ?? [];
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: { rules: [...cur, created], loading: false, error: null },
        },
      }));
      return created;
    } catch (e) {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            rules: s.byAccount[accountId]?.rules ?? [],
            loading: false,
            error: (e as Error).message,
          },
        },
      }));
      return null;
    }
  },
  update: async (accountId, rule) => {
    try {
      const updated = await window.mailvault.updateRule(accountId, rule);
      const cur = get().byAccount[accountId]?.rules ?? [];
      const next = cur.map((r) => (r.id === rule.id ? updated : r));
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: { rules: next, loading: false, error: null },
        },
      }));
      return updated;
    } catch (e) {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            rules: s.byAccount[accountId]?.rules ?? [],
            loading: false,
            error: (e as Error).message,
          },
        },
      }));
      return null;
    }
  },
  remove: async (accountId, rule) => {
    try {
      await window.mailvault.deleteRule(accountId, rule);
      const cur = get().byAccount[accountId]?.rules ?? [];
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            rules: cur.filter((r) => r.id !== rule.id),
            loading: false,
            error: null,
          },
        },
      }));
      return true;
    } catch (e) {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            rules: s.byAccount[accountId]?.rules ?? [],
            loading: false,
            error: (e as Error).message,
          },
        },
      }));
      return false;
    }
  },
}));
