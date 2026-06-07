import type { AccountProfile, DashboardSnapshot, Folder, Preferences, User } from '@shared/types';
import { DEFAULT_PREFS } from '@shared/types';

export const TEST_USER: User = {
  id: 'user-test-1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarEmoji: '🦊',
  avatarImage: null,
  createdAt: Date.now() - 86_400_000 * 30,
  lastLogin: Date.now() - 3_600_000,
};

export const TEST_ACCOUNT: AccountProfile = {
  id: 'acct-test-1',
  provider: 'google',
  email: 'user@gmail.com',
  name: 'Test Gmail',
  addedAt: Date.now() - 86_400_000 * 7,
  lastSyncedAt: Date.now() - 3_600_000,
};

export const TEST_FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', count: 42, isSystem: true },
  { id: 'sent', name: 'Sent', count: 10, isSystem: true },
  { id: 'archive', name: 'Archive', count: 5, isSystem: true },
];

export const TEST_PREFS: Preferences = {
  ...structuredClone(DEFAULT_PREFS),
  updatedAt: Date.now(),
};

export const TEST_DASHBOARD: DashboardSnapshot = {
  scope: TEST_ACCOUNT.id,
  hasSyncData: true,
  kpis: {
    totalEmails: 1200,
    weekDelta: 24,
    storageBytes: 2_400_000_000,
    storageWeekDeltaBytes: 120_000_000,
    cleanedCount: 12,
    cleanedBytes: 48_000_000,
    newEmails: 8,
    newEmailsLabel: 'since last sync',
    pendingActions: 0,
    liveSyncActive: false,
  },
  storageHistory: [],
  storageHistoryTotal: { emails: 1200, bytes: 2_400_000_000 },
  newByCategory: [],
  categoryBreakdown: [],
  spaceHogs: [],
  spaceHogsFooter: { topBytes: 0, pctOfTotal: 0 },
  activity: [],
  folders: [],
  cleanup: {
    deletableCount: 40,
    deletableBytes: 200_000_000,
    deletablePct: 8,
    newsletterCount: 15,
    folderSuggestions: 2,
  },
  syncTimeline: [],
  quickActions: {
    newsletterCount: 15,
    organizeCount: 8,
    lastSyncAt: Date.now() - 7_200_000,
    ruleSuggestions: 3,
  },
  liveAccounts: [
    {
      accountId: TEST_ACCOUNT.id,
      email: TEST_ACCOUNT.email,
      provider: 'google',
      status: 'paused',
      lastPollAt: Date.now() - 60_000,
      nextPollAt: Date.now() + 60_000,
      errorMessage: null,
    },
  ],
  junkPendingCount: 0,
};
