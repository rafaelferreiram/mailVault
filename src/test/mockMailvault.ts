import { vi } from 'vitest';
import type { Preferences } from '@shared/types';
import { DEFAULT_PREFS } from '@shared/types';
import { TEST_ACCOUNT, TEST_DASHBOARD, TEST_FOLDERS, TEST_PREFS, TEST_USER } from './fixtures';

const noopOff = () => () => {};

export function createMailvaultMock() {
  const prefs: Preferences = structuredClone(TEST_PREFS);

  return {
    userRegister: vi.fn(async () => ({ ok: true as const, user: TEST_USER })),
    userLogin: vi.fn(async () => ({ ok: true as const, user: TEST_USER })),
    userLogout: vi.fn(async () => true),
    userMe: vi.fn(async () => TEST_USER),
    userHasAny: vi.fn(async () => true),
    userChangePassword: vi.fn(async () => ({ ok: true as const })),
    userUpdateProfile: vi.fn(async (patch: Partial<typeof TEST_USER>) => ({
      ok: true as const,
      user: { ...TEST_USER, ...patch },
    })),
    onUserChanged: vi.fn(noopOff),

    authLogin: vi.fn(async () => ({ ok: true as const, profile: TEST_ACCOUNT })),
    authReauth: vi.fn(async () => ({ ok: true as const, profile: TEST_ACCOUNT })),
    authLogout: vi.fn(async () => true),
    listAccounts: vi.fn(async () => [TEST_ACCOUNT]),
    authUpdateAccount: vi.fn(async (_id: string, patch: { name?: string }) => ({
      ...TEST_ACCOUNT,
      name: patch.name ?? TEST_ACCOUNT.name,
    })),
    onAuthChanged: vi.fn(noopOff),

    probeRange: vi.fn(async () => 500),
    startSync: vi.fn(async () => 'sync-1'),
    cancelSync: vi.fn(async () => true),
    onSyncProgress: vi.fn(noopOff),

    runIntelligence: vi.fn(async () => 'intel-1'),
    cancelIntelligence: vi.fn(async () => true),
    listSuggestions: vi.fn(async () => ({ suggestions: [], groups: [] })),
    getSuggestion: vi.fn(async () => null),
    dismissSuggestion: vi.fn(async () => true),
    undismissSuggestion: vi.fn(async () => true),
    applySuggestion: vi.fn(async () => ({ ok: true, affected: 0 })),
    onIntelligenceProgress: vi.fn(noopOff),
    onIntelligenceComplete: vi.fn(noopOff),

    deleteEmails: vi.fn(async () => ({
      deleted: 0,
      failed: 0,
      perSender: {},
      undoableIds: [],
      mode: 'trash' as const,
    })),
    restoreEmails: vi.fn(async () => ({ restored: 0, failed: 0 })),
    moveEmails: vi.fn(async () => ({ moved: 0, failed: 0 })),
    onDeleteProgress: vi.fn(noopOff),
    onMoveProgress: vi.fn(noopOff),

    listFolders: vi.fn(async () => TEST_FOLDERS),
    createFolder: vi.fn(async (_id: string, p: { name: string }) => ({
      id: `folder-${p.name}`,
      name: p.name,
      parentId: null,
      isSystem: false,
    })),
    listEmailsByFolder: vi.fn(async () => ({ messages: [], source: 'cache' as const })),
    getEmailPreview: vi.fn(async () => null),
    scanJobOffers: vi.fn(async () => ({
      folderName: 'Job Offers & Recruiting',
      matches: [],
      byLocation: { inbox: 0, junk: 0, other: 0 },
      topDomains: [],
      needsSync: true,
    })),
    organizeJobOffers: vi.fn(async () => ({
      folder: null,
      moved: 0,
      failed: 0,
      rulesCreated: 0,
      rulesFailed: 0,
    })),

    listRules: vi.fn(async () => []),
    createRule: vi.fn(async (_id: string, rule: unknown) => rule),
    updateRule: vi.fn(async (_id: string, rule: unknown) => rule),
    deleteRule: vi.fn(async () => true),

    blockSender: vi.fn(async () => ({
      blocked: { email: 'x@y.com', name: 'X', blockedAt: Date.now(), deleteHistorical: false },
      deletedCount: 0,
    })),
    unblockSender: vi.fn(async () => true),
    listBlocked: vi.fn(async () => []),

    getSettings: vi.fn(async () => ({
      deletionMode: 'trash' as const,
      autoRefreshMinutes: 30,
      maxFetchPerAccount: 5000,
      activeAccountId: TEST_ACCOUNT.id,
    })),
    setSettings: vi.fn(async (partial: Record<string, unknown>) => ({
      deletionMode: 'trash' as const,
      autoRefreshMinutes: 30,
      maxFetchPerAccount: 5000,
      activeAccountId: TEST_ACCOUNT.id,
      ...partial,
    })),

    oauthConfigStatus: vi.fn(async () => ({
      google: { configured: true, clientId: 'x' },
      microsoft: { configured: true, clientId: 'y' },
    })),
    oauthOpenEnv: vi.fn(async () => ({ ok: true, path: '/tmp/.env' })),
    oauthReopenUrl: vi.fn(async () => ({ ok: true })),
    onOAuthAuthUrl: vi.fn(noopOff),
    onOAuthAuthDone: vi.fn(noopOff),

    onboardingGet: vi.fn(async () => ({
      completed: true,
      dismissed: true,
      currentStep: 0,
      lastSeenAt: Date.now(),
    })),
    onboardingSet: vi.fn(async () => ({
      completed: true,
      dismissed: true,
      currentStep: 0,
      lastSeenAt: Date.now(),
    })),
    onOnboardingRestart: vi.fn(noopOff),
    onShowShortcuts: vi.fn(noopOff),
    onShowWhatsNew: vi.fn(noopOff),

    getPreferences: vi.fn(async () => prefs),
    setPreferences: vi.fn(async (partial: Partial<Preferences>) => {
      Object.assign(prefs, partial);
      return prefs;
    }),
    onOpenPersonalization: vi.fn(noopOff),

    liveSyncStart: vi.fn(async () => ({})),
    liveSyncStop: vi.fn(async () => ({})),
    liveSyncSetEnabled: vi.fn(async () => ({})),
    liveSyncPause: vi.fn(async () => ({})),
    liveSyncResume: vi.fn(async () => ({})),
    liveSyncCheckNow: vi.fn(async () => ({})),
    liveSyncStatus: vi.fn(async () => ({
      enabled: false,
      accounts: [{ accountId: TEST_ACCOUNT.id, status: 'idle', enabled: true }],
    })),
    listNotifications: vi.fn(async () => []),
    markNotificationsRead: vi.fn(async () => true),
    dismissNotification: vi.fn(async () => true),
    listPendingActions: vi.fn(async () => []),
    resolvePendingAction: vi.fn(async () => ({ ok: true })),
    undoLiveAction: vi.fn(async () => ({ ok: true })),
    getDashboard: vi.fn(async () => TEST_DASHBOARD),
    listMessageIdsBySender: vi.fn(async () => []),
    onLiveNotification: vi.fn(noopOff),
    onLivePending: vi.fn(noopOff),
    onLiveBadge: vi.fn(noopOff),
    onLiveStatus: vi.fn(noopOff),
    onLiveAutoAction: vi.fn(noopOff),
    onLivePollStatus: vi.fn(noopOff),
  };
}

let installed = false;

export function installMailvaultMock() {
  if (installed) return;
  installed = true;
  window.mailvault = createMailvaultMock() as unknown as Window['mailvault'];
  globalThis.__MAILVAULT_PREFS__ = structuredClone(DEFAULT_PREFS);
}

export function getMailvaultMock() {
  return window.mailvault as unknown as ReturnType<typeof createMailvaultMock>;
}
