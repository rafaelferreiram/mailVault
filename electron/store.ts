import Store from 'electron-store';
import {
  DEFAULT_ONBOARDING,
  DEFAULT_PREFS,
  DEFAULT_LIVE_SYNC,
  type OnboardingState,
  type MailRule,
  type BlockedSender,
  type AccountProfile,
  type Preferences,
  type LiveSyncPrefs,
} from '../shared/types.js';

// IMPORTANT: This store does NOT hold OAuth tokens. Tokens live in the OS keychain
// (see electron/services/keychain.ts). This file persists only metadata.

interface PersistedShape {
  accounts: AccountProfile[];
  rules: Record<string, MailRule[]>;
  blocked: Record<string, BlockedSender[]>;
  settings: {
    deletionMode: 'trash' | 'permanent';
    autoRefreshMinutes: number;
    maxFetchPerAccount: number;
    activeAccountId?: string;
  };
  /** Onboarding state. Tracked per-machine, not per-user — onboarding teaches the app. */
  onboarding: OnboardingState;
  /** Personalization layer: theme, style, layout, panels, wizard status. Per-machine. */
  preferences: Preferences;
}

const defaults: PersistedShape = {
  accounts: [],
  rules: {},
  blocked: {},
  settings: {
    deletionMode: 'trash',
    autoRefreshMinutes: 30,
    maxFetchPerAccount: 5000,
  },
  onboarding: { ...DEFAULT_ONBOARDING },
  preferences: { ...DEFAULT_PREFS },
};

const store = new (Store as unknown as new (opts: object) => Store<PersistedShape>)({
  name: 'mailvault',
  defaults,
  // Disk-level encryption for the metadata file too. (Tokens are NOT here.)
  encryptionKey: 'mailvault-disk-v2',
  clearInvalidConfig: true,
});

export const storage = {
  // Accounts ----------------------------------------------------------------
  listAccounts(): AccountProfile[] {
    return store.get('accounts');
  },
  upsertAccount(profile: AccountProfile) {
    const accounts = store.get('accounts');
    const idx = accounts.findIndex((a) => a.id === profile.id);
    if (idx >= 0) accounts[idx] = { ...accounts[idx], ...profile };
    else accounts.push(profile);
    store.set('accounts', accounts);
  },
  removeAccount(id: string) {
    store.set(
      'accounts',
      store.get('accounts').filter((a) => a.id !== id)
    );
    const rules = store.get('rules');
    delete rules[id];
    store.set('rules', rules);
    const blocked = store.get('blocked');
    delete blocked[id];
    store.set('blocked', blocked);
  },
  patchAccount(id: string, patch: Partial<AccountProfile>) {
    const accounts = store.get('accounts');
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx < 0) return;
    accounts[idx] = { ...accounts[idx], ...patch };
    store.set('accounts', accounts);
  },

  // Rules -------------------------------------------------------------------
  getRules(accountId: string): MailRule[] {
    return store.get('rules')[accountId] ?? [];
  },
  setRules(accountId: string, rules: MailRule[]) {
    const all = store.get('rules');
    all[accountId] = rules;
    store.set('rules', all);
  },

  // Blocked -----------------------------------------------------------------
  getBlocked(accountId: string): BlockedSender[] {
    return store.get('blocked')[accountId] ?? [];
  },
  setBlocked(accountId: string, list: BlockedSender[]) {
    const all = store.get('blocked');
    all[accountId] = list;
    store.set('blocked', all);
  },

  // Settings ----------------------------------------------------------------
  getSettings() {
    return store.get('settings');
  },
  setSettings(partial: Partial<PersistedShape['settings']>) {
    const cur = store.get('settings');
    store.set('settings', { ...cur, ...partial });
  },

  // Onboarding --------------------------------------------------------------
  getOnboarding(): OnboardingState {
    return { ...DEFAULT_ONBOARDING, ...(store.get('onboarding') ?? {}) };
  },
  setOnboarding(partial: Partial<OnboardingState>): OnboardingState {
    const cur = { ...DEFAULT_ONBOARDING, ...(store.get('onboarding') ?? {}) };
    const next: OnboardingState = { ...cur, ...partial, lastSeenAt: Date.now() };
    store.set('onboarding', next);
    return next;
  },
  resetOnboarding(): OnboardingState {
    const fresh: OnboardingState = {
      ...DEFAULT_ONBOARDING,
      lastSeenAt: Date.now(),
    };
    store.set('onboarding', fresh);
    return fresh;
  },

  // Preferences (personalization) -----------------------------------------
  // Stored as a single object so partial updates from the renderer go through
  // a deep merge below — clients only send the slice they changed (e.g. just
  // the appearance section), and we keep the rest of the structure intact.
  getPreferences(): Preferences {
    const raw = store.get('preferences');
    return mergePrefs(DEFAULT_PREFS, raw);
  },
  setPreferences(partial: DeepPartial<Preferences>): Preferences {
    const cur = mergePrefs(DEFAULT_PREFS, store.get('preferences'));
    const next = mergePrefs(cur, partial);
    next.updatedAt = Date.now();
    store.set('preferences', next);
    return next;
  },
  resetPreferences(): Preferences {
    const fresh: Preferences = { ...DEFAULT_PREFS, updatedAt: Date.now() };
    store.set('preferences', fresh);
    return fresh;
  },
};

// ─── Preferences helpers ────────────────────────────────────────────────
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/**
 * Merge a partial Preferences object onto the current value. Arrays (e.g.
 * `sidebarItems`) are replaced wholesale; nested objects merge one level
 * deep, which is exactly the structure of `Preferences`.
 */
function mergePrefs(base: Preferences, patch?: unknown): Preferences {
  const p = (patch ?? {}) as DeepPartial<Preferences>;
  return {
    appearance: { ...base.appearance, ...(p.appearance ?? {}) },
    layout: {
      ...base.layout,
      ...(p.layout ?? {}),
      sidebarItems: p.layout?.sidebarItems
        ? [...p.layout.sidebarItems]
        : [...base.layout.sidebarItems],
    },
    panels: { ...base.panels, ...(p.panels ?? {}) },
    emailView: { ...base.emailView, ...(p.emailView ?? {}) },
    wizard: { ...base.wizard, ...(p.wizard ?? {}) },
    liveSync: mergeLiveSync(base.liveSync ?? DEFAULT_LIVE_SYNC, p.liveSync),
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : base.updatedAt,
  };
}

function mergeLiveSync(base: LiveSyncPrefs, patch?: DeepPartial<LiveSyncPrefs>): LiveSyncPrefs {
  const p = patch ?? {};
  return {
    ...base,
    ...p,
    autoActions: { ...base.autoActions, ...(p.autoActions ?? {}) },
    notifications: { ...base.notifications, ...(p.notifications ?? {}) },
  };
}
