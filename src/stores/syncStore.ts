import { create } from 'zustand';
import type {
  EmailMessage,
  FetchOptions,
  FolderSuggestion,
  LogEntry,
  SyncLiveStats,
  SyncProgressEvent,
  SyncStage,
  TimeRange,
  TimeRangeKey,
} from '@shared/types';
import { RANGES, rangeFromKey } from '@/lib/timeRange';
import {
  averageProbeLatency,
  estimateSyncDurationMs,
} from '@/lib/syncEta';

interface ProbeResult {
  count: number;
  bytes: number;
  loading?: boolean;
  /** Round-trip ms for the provider count probe (connection speed signal). */
  probeMs?: number;
}

interface PerAccountSync {
  syncId: string | null;
  active: boolean;
  drawerOpen: boolean;
  drawerCollapsed: boolean;
  stage: SyncStage | null;
  stats: SyncLiveStats;
  log: LogEntry[];
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  /** Pre-sync ETA used for remaining-time display in the drawer. */
  estimatedDurationMs: number | null;
  // Final results (after stage 5)
  messages: EmailMessage[];
  suggestions: FolderSuggestion[];
  // Probes for the time range selector
  probes: Partial<Record<TimeRangeKey, ProbeResult>>;
  // Last selected range
  selectedRange: TimeRange;
}

const empty = (): PerAccountSync => ({
  syncId: null,
  active: false,
  drawerOpen: false,
  drawerCollapsed: false,
  stage: null,
  stats: {
    emailsFetched: 0,
    sendersDiscovered: 0,
    bytesAccounted: 0,
    newslettersDetected: 0,
    suggestionsBuilt: 0,
  },
  log: [],
  startedAt: null,
  completedAt: null,
  error: null,
  estimatedDurationMs: null,
  messages: [],
  suggestions: [],
  probes: {},
  selectedRange: { key: '30d' },
});

interface SyncState {
  byAccount: Record<string, PerAccountSync>;

  ensure: (accountId: string) => PerAccountSync;
  setRange: (accountId: string, range: TimeRange) => void;
  start: (accountId: string, opts: FetchOptions) => Promise<void>;
  cancel: (accountId: string) => void;
  toggleDrawer: () => void;
  setCollapsed: (collapsed: boolean) => void;
  closeDrawer: (accountId: string) => void;
  probe: (accountId: string, range: TimeRange) => Promise<void>;
  probeAll: (accountId: string) => Promise<void>;
  removeMessages: (accountId: string, ids: Set<string>) => void;
  dismissSuggestion: (accountId: string, suggestionId: string) => void;
}

const MAX_LOG = 200; // ring buffer

export const useSyncStore = create<SyncState>((set, get) => ({
  byAccount: {},

  ensure: (accountId) => {
    const cur = get().byAccount[accountId];
    if (cur) return cur;
    const fresh = empty();
    set((s) => ({ byAccount: { ...s.byAccount, [accountId]: fresh } }));
    return fresh;
  },

  setRange: (accountId, range) => {
    set((s) => {
      const cur = s.byAccount[accountId] ?? empty();
      return {
        byAccount: { ...s.byAccount, [accountId]: { ...cur, selectedRange: range } },
      };
    });
  },

  probe: async (accountId, range) => {
    set((s) => {
      const cur = s.byAccount[accountId] ?? empty();
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            probes: {
              ...cur.probes,
              [range.key]: { ...(cur.probes[range.key] ?? { count: 0, bytes: 0 }), loading: true },
            },
          },
        },
      };
    });
    try {
      const t0 = performance.now();
      const count = await window.mailvault.probeRange(accountId, range);
      const probeMs = Math.round(performance.now() - t0);
      const bytes = count * 60 * 1024; // 60 KB heuristic
      set((s) => {
        const cur = s.byAccount[accountId] ?? empty();
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              ...cur,
              probes: {
                ...cur.probes,
                [range.key]: { count, bytes, loading: false, probeMs },
              },
            },
          },
        };
      });
    } catch {
      set((s) => {
        const cur = s.byAccount[accountId] ?? empty();
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              ...cur,
              probes: { ...cur.probes, [range.key]: { count: 0, bytes: 0, loading: false } },
            },
          },
        };
      });
    }
  },

  probeAll: async (accountId) => {
    await Promise.all(
      RANGES.map((r) => get().probe(accountId, rangeFromKey(r.key)))
    );
  },

  start: async (accountId, opts) => {
    const curBefore = get().byAccount[accountId] ?? empty();
    const rangeKey = opts.range?.key ?? curBefore.selectedRange.key;
    const probe = curBefore.probes[rangeKey];
    const estimatedDurationMs = estimateSyncDurationMs({
      rangeKey,
      emailCount: probe?.count,
      avgProbeMs: averageProbeLatency(curBefore.probes),
    });

    set((s) => {
      const cur = s.byAccount[accountId] ?? empty();
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            active: true,
            drawerOpen: true,
            drawerCollapsed: false,
            stage: { id: 'fetch', index: 1, total: 5, label: 'Starting…', progress: 0 },
            stats: empty().stats,
            log: [],
            startedAt: Date.now(),
            completedAt: null,
            error: null,
            estimatedDurationMs,
            messages: [],
            suggestions: [],
          },
        },
      };
    });
    try {
      const syncId = await window.mailvault.startSync(accountId, opts);
      set((s) => {
        const cur = s.byAccount[accountId] ?? empty();
        return { byAccount: { ...s.byAccount, [accountId]: { ...cur, syncId } } };
      });
    } catch (e) {
      set((s) => {
        const cur = s.byAccount[accountId] ?? empty();
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: { ...cur, active: false, error: (e as Error).message },
          },
        };
      });
    }
  },

  cancel: (accountId) => {
    const cur = get().byAccount[accountId];
    if (cur?.syncId) {
      void window.mailvault.cancelSync(cur.syncId);
    }
  },

  toggleDrawer: () => {
    set((s) => {
      const next = { ...s.byAccount };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], drawerCollapsed: !next[key].drawerCollapsed };
      }
      return { byAccount: next };
    });
  },

  setCollapsed: (collapsed) => {
    set((s) => {
      const next = { ...s.byAccount };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], drawerCollapsed: collapsed };
      }
      return { byAccount: next };
    });
  },

  closeDrawer: (accountId) => {
    set((s) => {
      const cur = s.byAccount[accountId] ?? empty();
      return {
        byAccount: { ...s.byAccount, [accountId]: { ...cur, drawerOpen: false } },
      };
    });
  },

  removeMessages: (accountId, ids) => {
    set((s) => {
      const cur = s.byAccount[accountId];
      if (!cur) return s;
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            messages: cur.messages.filter((m) => !ids.has(m.id)),
          },
        },
      };
    });
  },

  dismissSuggestion: (accountId, suggestionId) => {
    set((s) => {
      const cur = s.byAccount[accountId];
      if (!cur) return s;
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            ...cur,
            suggestions: cur.suggestions.filter((sg) => sg.id !== suggestionId),
          },
        },
      };
    });
  },
}));

// Wire sync events from main process.
if (typeof window !== 'undefined' && window.mailvault) {
  window.mailvault.onSyncProgress((evt: SyncProgressEvent) => {
    useSyncStore.setState((s) => {
      const cur = s.byAccount[evt.accountId] ?? empty();
      const log = evt.log ? [...cur.log, evt.log].slice(-MAX_LOG) : cur.log;
      const next: PerAccountSync = {
        ...cur,
        stage: evt.stage,
        stats: evt.stats,
        log,
        active: !evt.done && !evt.error,
        completedAt: evt.done ? Date.now() : null,
        error: evt.error ?? null,
      };
      if (evt.result) {
        next.messages = evt.result.messages;
        next.suggestions = evt.result.suggestions;
      }
      return { byAccount: { ...s.byAccount, [evt.accountId]: next } };
    });
  });
}
