import type {
  AccountProfile,
  EmailMessage,
  EmailPreview,
  FetchOptions,
  MailRule,
  BlockedSender,
  DeleteProgress,
  MoveProgress,
  Folder,
  TimeRange,
  SyncProgressEvent,
  User,
  OnboardingState,
  OAuthConfigStatus,
  Suggestion,
  SuggestionGroup,
  SuggestionFilter,
  IntelligenceProgress,
  IntelligenceSummary,
  Preferences,
  DashboardSnapshot,
} from '@shared/types';

// Personalization prefs are also dropped on the global window object by the
// preload's no-flash boot path. Components shouldn't read them directly —
// `usePrefsStore` is the source of truth — but we declare the type so the
// boot code in preload.ts has something to typecheck against.
declare global {
  // eslint-disable-next-line no-var
  var __MAILVAULT_PREFS__: Preferences | null | undefined;
}

type AuthError = { code?: string; message: string };

declare global {
  interface Window {
    mailvault: {
      // User session (local MailVault account)
      userRegister: (payload: {
        username: string;
        email: string;
        password: string;
      }) => Promise<{ ok: true; user: User } | { ok: false; error: AuthError }>;
      userLogin: (payload: {
        identifier: string;
        password: string;
      }) => Promise<{ ok: true; user: User } | { ok: false; error: AuthError }>;
      userLogout: () => Promise<boolean>;
      userMe: () => Promise<User | null>;
      userHasAny: () => Promise<boolean>;
      userChangePassword: (payload: {
        currentPassword: string;
        newPassword: string;
      }) => Promise<{ ok: true } | { ok: false; error: AuthError }>;
      userUpdateProfile: (payload: {
        displayName?: string;
        email?: string;
        avatarEmoji?: string | null;
        avatarImage?: string | null;
      }) => Promise<{ ok: true; user: User } | { ok: false; error: AuthError }>;
      onUserChanged: (cb: (p: { user: User | null }) => void) => () => void;

      // Email-provider auth
      authLogin: (
        provider: 'google' | 'microsoft'
      ) => Promise<
        | { ok: true; profile: AccountProfile }
        | { ok: false; error: { code?: string; message: string } }
      >;
      authReauth: (
        accountId: string
      ) => Promise<
        | { ok: true; profile: AccountProfile }
        | { ok: false; error: { code?: string; message: string } }
      >;
      authLogout: (accountId: string) => Promise<boolean>;
      listAccounts: () => Promise<AccountProfile[]>;
      authUpdateAccount: (
        accountId: string,
        patch: { name?: string }
      ) => Promise<AccountProfile | null>;
      onAuthChanged: (
        cb: (p: { type: 'needs-reauth' | 'removed'; accountId: string; code?: string; message?: string }) => void
      ) => () => void;

      probeRange: (accountId: string, range: TimeRange) => Promise<number>;
      startSync: (accountId: string, opts: FetchOptions) => Promise<string>;
      cancelSync: (syncId: string) => Promise<boolean>;
      onSyncProgress: (cb: (p: SyncProgressEvent) => void) => () => void;

      // Intelligence engine
      runIntelligence: (accountId: string) => Promise<string>;
      cancelIntelligence: (accountId: string) => Promise<boolean>;
      listSuggestions: (
        accountId: string,
        filter?: SuggestionFilter
      ) => Promise<{ suggestions: Suggestion[]; groups: SuggestionGroup[] }>;
      getSuggestion: (accountId: string, suggestionId: string) => Promise<Suggestion | null>;
      dismissSuggestion: (accountId: string, suggestionId: string) => Promise<boolean>;
      undismissSuggestion: (accountId: string, suggestionId: string) => Promise<boolean>;
      applySuggestion: (
        accountId: string,
        suggestionId: string
      ) => Promise<{ ok: boolean; error?: string; affected: number; undoableIds?: string[] }>;
      onIntelligenceProgress: (cb: (p: IntelligenceProgress) => void) => () => void;
      onIntelligenceComplete: (
        cb: (p: { accountId: string; runId: string; summary: IntelligenceSummary }) => void
      ) => () => void;

      deleteEmails: (
        accountId: string,
        payload: {
          messages: Array<{ id: string; senderEmail: string }>;
          mode?: 'trash' | 'permanent';
        }
      ) => Promise<{
        deleted: number;
        failed: number;
        perSender: Record<string, { ok: number; fail: number }>;
        undoableIds: string[];
        mode: 'trash' | 'permanent';
      }>;
      restoreEmails: (accountId: string, ids: string[]) => Promise<{ restored: number; failed: number }>;
      moveEmails: (
        accountId: string,
        payload: { messageIds: string[]; destinationFolderId: string; markNotJunk?: boolean }
      ) => Promise<{ moved: number; failed: number }>;

      onDeleteProgress: (cb: (p: DeleteProgress) => void) => () => void;
      onMoveProgress: (cb: (p: MoveProgress) => void) => () => void;

      listFolders: (accountId: string) => Promise<Folder[]>;
      createFolder: (accountId: string, payload: { name: string; color?: string }) => Promise<Folder>;
      listEmailsByFolder: (
        accountId: string,
        payload: { folderId: string; limit?: number; offset?: number }
      ) => Promise<{ messages: EmailMessage[]; source: 'cache' | 'live' }>;
      getEmailPreview: (accountId: string, messageId: string) => Promise<EmailPreview | null>;
      scanJobOffers: (accountId: string) => Promise<import('@shared/jobOfferDetection').JobOfferScanResult>;
      organizeJobOffers: (
        accountId: string,
        payload?: { messageIds?: string[] }
      ) => Promise<import('@shared/jobOfferDetection').JobOfferOrganizeResult>;

      listRules: (accountId: string) => Promise<MailRule[]>;
      createRule: (accountId: string, rule: MailRule) => Promise<MailRule>;
      updateRule: (accountId: string, rule: MailRule) => Promise<MailRule>;
      deleteRule: (accountId: string, rule: MailRule) => Promise<boolean>;

      blockSender: (
        accountId: string,
        payload: { email: string; name?: string; deleteHistorical: boolean; messageIds: string[] }
      ) => Promise<{ blocked: BlockedSender; deletedCount: number }>;
      unblockSender: (accountId: string, email: string) => Promise<boolean>;
      listBlocked: (accountId: string) => Promise<BlockedSender[]>;

      getSettings: () => Promise<{
        deletionMode: 'trash' | 'permanent';
        autoRefreshMinutes: number;
        maxFetchPerAccount: number;
        activeAccountId?: string;
      }>;
      setSettings: (partial: Partial<{
        deletionMode: 'trash' | 'permanent';
        autoRefreshMinutes: number;
        maxFetchPerAccount: number;
        activeAccountId?: string;
      }>) => Promise<{
        deletionMode: 'trash' | 'permanent';
        autoRefreshMinutes: number;
        maxFetchPerAccount: number;
        activeAccountId?: string;
      }>;

      // OAuth setup
      oauthConfigStatus: () => Promise<OAuthConfigStatus>;
      oauthOpenEnv: () => Promise<{ ok: boolean; path: string }>;
      oauthReopenUrl: (url: string) => Promise<{ ok: boolean }>;
      onOAuthAuthUrl: (
        cb: (payload: { provider: 'google' | 'microsoft'; url: string }) => void
      ) => () => void;
      onOAuthAuthDone: (
        cb: (payload: { provider: 'google' | 'microsoft'; ok: boolean }) => void
      ) => () => void;

      // Onboarding
      onboardingGet: () => Promise<OnboardingState>;
      onboardingSet: (
        payload: { reset: true } | { patch: Partial<OnboardingState> }
      ) => Promise<OnboardingState>;
      onOnboardingRestart: (cb: () => void) => () => void;
      onShowShortcuts: (cb: () => void) => () => void;
      onShowWhatsNew: (cb: () => void) => () => void;

      // Personalization
      getPreferences: () => Promise<Preferences>;
      setPreferences: (partial: Partial<Preferences>) => Promise<Preferences>;
      onOpenPersonalization: (cb: () => void) => () => void;

      liveSyncStart: () => Promise<unknown>;
      liveSyncStop: () => Promise<unknown>;
      liveSyncSetEnabled: (enabled: boolean) => Promise<unknown>;
      liveSyncPause: () => Promise<unknown>;
      liveSyncResume: () => Promise<unknown>;
      liveSyncCheckNow: () => Promise<unknown>;
      liveSyncStatus: () => Promise<unknown>;
      listNotifications: (opts?: { limit?: number; accountId?: string }) => Promise<unknown>;
      markNotificationsRead: (ids?: string[]) => Promise<boolean>;
      dismissNotification: (id: string) => Promise<boolean>;
      listPendingActions: () => Promise<unknown>;
      resolvePendingAction: (id: string, resolution: string) => Promise<{ ok: boolean }>;
      undoLiveAction: (actionLogId: string) => Promise<{ ok: boolean; error?: string }>;
      getDashboard: (scope: string | 'all') => Promise<DashboardSnapshot>;
      onLiveNotification: (cb: (p: unknown) => void) => () => void;
      onLivePending: (cb: (p: unknown) => void) => () => void;
      onLiveBadge: (cb: (p: unknown) => void) => () => void;
      onLiveStatus: (cb: (p: unknown) => void) => () => void;
      onLiveAutoAction: (cb: (p: unknown) => void) => () => void;
      onLivePollStatus: (cb: (p: unknown) => void) => () => void;
    };
  }
}

export {};
