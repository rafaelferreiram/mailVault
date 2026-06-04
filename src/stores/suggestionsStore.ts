import { create } from 'zustand';
import type {
  IntelligenceProgress,
  IntelligenceSummary,
  Suggestion,
  SuggestionGroup,
  SuggestionGroupType,
} from '@shared/types';

export type SuggestionStatusFilter = 'active' | 'applied' | 'dismissed' | 'all';

interface SuggestionsState {
  byAccount: Record<
    string,
    {
      suggestions: Suggestion[];
      groups: SuggestionGroup[];
      lastFetchedAt: number;
      lastSummary?: IntelligenceSummary;
      progress?: IntelligenceProgress;
      loading: boolean;
    }
  >;
  filter: {
    status: SuggestionStatusFilter;
    groupType: SuggestionGroupType | 'all';
    /** "high-priority only" toggles. */
    onlyHighPriority: boolean;
    sort: 'priority' | 'storage' | 'count';
  };
  setFilter: (patch: Partial<SuggestionsState['filter']>) => void;

  /** Local set of suggestion IDs the user is currently applying — drives spinners. */
  applying: Set<string>;
  setApplying: (id: string, on: boolean) => void;

  loadSuggestions: (accountId: string) => Promise<void>;
  setProgress: (accountId: string, progress: IntelligenceProgress) => void;
  applySuggestion: (
    accountId: string,
    id: string
  ) => Promise<{ ok: boolean; error?: string; affected: number; undoableIds?: string[] }>;
  dismissSuggestion: (accountId: string, id: string) => Promise<void>;
  undismissSuggestion: (accountId: string, id: string) => Promise<void>;
  /** Mark a suggestion locally as applied without re-fetching from disk. */
  markApplied: (accountId: string, id: string) => void;
  /** Re-run the intelligence engine. */
  rerun: (accountId: string) => Promise<void>;
}

function emptyAccount() {
  return {
    suggestions: [] as Suggestion[],
    groups: [] as SuggestionGroup[],
    lastFetchedAt: 0,
    loading: false,
  };
}

export const useSuggestionsStore = create<SuggestionsState>((set, get) => ({
  byAccount: {},
  filter: {
    status: 'active',
    groupType: 'all',
    onlyHighPriority: false,
    sort: 'priority',
  },
  setFilter: (patch) => set((s) => ({ filter: { ...s.filter, ...patch } })),

  applying: new Set(),
  setApplying: (id, on) =>
    set((s) => {
      const next = new Set(s.applying);
      if (on) next.add(id);
      else next.delete(id);
      return { applying: next };
    }),

  loadSuggestions: async (accountId) => {
    set((s) => ({
      byAccount: {
        ...s.byAccount,
        [accountId]: { ...(s.byAccount[accountId] ?? emptyAccount()), loading: true },
      },
    }));
    try {
      const { suggestions, groups } = await window.mailvault.listSuggestions(accountId, {
        status: get().filter.status,
        minConfidence: 0.5,
      });
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...(s.byAccount[accountId] ?? emptyAccount()),
            suggestions,
            groups,
            lastFetchedAt: Date.now(),
            loading: false,
          },
        },
      }));
    } catch {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: { ...(s.byAccount[accountId] ?? emptyAccount()), loading: false },
        },
      }));
    }
  },

  setProgress: (accountId, progress) =>
    set((s) => ({
      byAccount: {
        ...s.byAccount,
        [accountId]: {
          ...(s.byAccount[accountId] ?? emptyAccount()),
          progress,
          lastSummary: progress.summary ?? s.byAccount[accountId]?.lastSummary,
        },
      },
    })),

  applySuggestion: async (accountId, id) => {
    get().setApplying(id, true);
    try {
      const result = await window.mailvault.applySuggestion(accountId, id);
      if (result.ok) {
        get().markApplied(accountId, id);
      }
      return result;
    } finally {
      get().setApplying(id, false);
    }
  },

  dismissSuggestion: async (accountId, id) => {
    await window.mailvault.dismissSuggestion(accountId, id);
    set((s) => {
      const cur = s.byAccount[accountId];
      if (!cur) return s;
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            suggestions: cur.suggestions.filter((x) => x.id !== id),
          },
        },
      };
    });
  },

  undismissSuggestion: async (accountId, id) => {
    await window.mailvault.undismissSuggestion(accountId, id);
    await get().loadSuggestions(accountId);
  },

  markApplied: (accountId, id) =>
    set((s) => {
      const cur = s.byAccount[accountId];
      if (!cur) return s;
      const ts = Date.now();
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            suggestions: cur.suggestions.map((x) =>
              x.id === id ? { ...x, appliedAt: ts } : x
            ),
          },
        },
      };
    }),

  rerun: async (accountId) => {
    await window.mailvault.runIntelligence(accountId);
    // Loading state is driven by the progress events; the actual list refresh
    // happens in the renderer's IntelligenceComplete listener.
  },
}));

// Wire intelligence events from main process. We do this once at module
// import time — the listeners stay alive for the renderer's lifetime.
if (typeof window !== 'undefined' && window.mailvault) {
  window.mailvault.onIntelligenceProgress((p: IntelligenceProgress) => {
    useSuggestionsStore.getState().setProgress(p.accountId, p);
  });
  window.mailvault.onIntelligenceComplete(({ accountId }) => {
    void useSuggestionsStore.getState().loadSuggestions(accountId);
  });
}
