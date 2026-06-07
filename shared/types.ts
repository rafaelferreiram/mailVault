// Shared types between Electron main and renderer.

export type Provider = 'google' | 'microsoft';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
  idToken?: string;
}

export interface AccountProfile {
  id: string;
  provider: Provider;
  email: string;
  name: string;
  avatarUrl?: string;
  addedAt: number;
  /** True when refresh failed → user must re-authenticate. */
  needsReauth?: boolean;
  /** epoch ms of last successful API call. */
  lastSyncedAt?: number;
}

export interface StoredAccount extends AccountProfile {
  tokens: OAuthTokens;
}

export class AuthError extends Error {
  code:
    | 'invalid_grant'
    | 'consent_required'
    | 'tenant_mismatch'
    | 'access_denied'
    | 'missing_credentials'
    | 'network'
    | 'unknown';
  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export interface OAuthConfigStatus {
  google: { configured: boolean; clientId: boolean; clientSecret: boolean };
  microsoft: { configured: boolean; clientId: boolean };
  /** Absolute path to the .env file the main process is reading. */
  envPath: string;
  /** True when the file exists on disk (regardless of whether it has values). */
  envExists: boolean;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  sizeBytes: number;
  isUnread: boolean;
  hasListUnsubscribe: boolean;
  listUnsubscribeValue?: string;
  labelIds?: string[];
  folder?: string;
}

/** Full message preview for the mailbox reading pane. */
export interface EmailPreview {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  receivedAt: number;
  isUnread: boolean;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
}

export interface SenderGroup {
  email: string;
  name: string;
  domain: string;
  count: number;
  totalBytes: number;
  oldestAt: number;
  newestAt: number;
  unreadCount: number;
  hasListUnsubscribe: boolean;
  isNewsletter: boolean;
  category?: SenderCategory;
  sampleSubjects: string[];
  messageIds: string[];
}

export type SenderCategory =
  | 'newsletter'
  | 'transactional'
  | 'social'
  | 'dev'
  | 'finance'
  | 'shopping'
  | 'travel'
  | 'work'
  | 'other';

export interface MailRule {
  id: string;
  providerRuleId?: string;
  source: 'remote' | 'local' | 'suggested';
  name?: string;
  /** Local + Gmail filter matching (substring in from address). Use @domain for domain rules. */
  fromContains?: string;
  /** Outlook messageRules: matches strings in the From field (e.g. levels.pt, bmw). */
  senderContains?: string;
  subjectContains?: string;
  bodyContains?: string;
  hasAttachment?: boolean;
  addLabel?: string;
  removeLabel?: string;
  /** Outlook: Graph folder id for moveToFolder action. */
  moveToFolderId?: string;
  archive?: boolean;
  delete?: boolean;
  markRead?: boolean;
  forwardTo?: string;
  enabled: boolean;
  createdAt: number;
}

export interface BlockedSender {
  email: string;
  name?: string;
  blockedAt: number;
  ruleId?: string;
  deletedHistorical: boolean;
  unsubscribeAttempted: boolean;
}

export interface Folder {
  id: string;
  name: string;
  count?: number;
  color?: string;
  isSystem?: boolean;
  parentId?: string;
}

export interface FolderSuggestion {
  id: string;
  category: SenderCategory;
  folderName: string;
  reason: string;
  senders: Array<{ email: string; name: string; count: number; bytes: number }>;
  totalCount: number;
  action: 'create_and_move' | 'create_only';
}

// ─── Sync engine ─────────────────────────────────────────────────────
export type SyncStageId =
  | 'fetch'
  | 'group'
  | 'storage'
  | 'detect'
  | 'suggest';

export interface SyncStage {
  id: SyncStageId;
  index: number;       // 1-based
  total: number;       // 5
  label: string;
  progress: number;    // 0..1 within this stage
}

export type LogLevel = 'info' | 'discover' | 'warn' | 'ok' | 'err';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  message: string;
}

export interface SyncLiveStats {
  emailsFetched: number;
  sendersDiscovered: number;
  bytesAccounted: number;
  newslettersDetected: number;
  suggestionsBuilt: number;
}

export interface SyncProgressEvent {
  syncId: string;
  accountId: string;
  stage: SyncStage;
  stats: SyncLiveStats;
  log?: LogEntry;
  done: boolean;
  error?: string;
  result?: {
    messages: EmailMessage[];
    suggestions: FolderSuggestion[];
    senderGroups?: SenderGroup[];
  };
}

export interface RangeProbe {
  rangeKey: TimeRangeKey;
  count: number;
  estimatedBytes: number;
  fetchedAt: number;
}

export type TimeRangeKey =
  | 'today'
  | '7d'
  | '30d'
  | '6mo'
  | '1y'
  | '2y'
  | '5y'
  | 'all'
  | 'custom';

export interface TimeRange {
  key: TimeRangeKey;
  // epoch ms; if start undefined and key='all', no lower bound. end always = now (or custom).
  startMs?: number;
  endMs?: number;
}

export interface FetchOptions {
  range?: TimeRange;
  maxMessages?: number;
  unreadOnly?: boolean;
  labelOrFolder?: string;
}

export interface DeleteProgress {
  accountId: string;
  deleted: number;
  failed: number;
  total: number;
  perSender: Record<string, { ok: number; fail: number }>;
  done: boolean;
  error?: string;
}

export interface MoveProgress {
  accountId: string;
  moved: number;
  failed: number;
  total: number;
  done: boolean;
  error?: string;
}

export interface UndoableAction {
  id: string;
  kind: 'delete';
  accountId: string;
  count: number;
  createdAt: number;
  expiresAt: number;
  // For Gmail: messageIds in trash. For Graph: ids that were moved to deletedItems.
  messageIds: string[];
  // optional summary fields
  summary?: string;
}

// ─── User accounts (local MailVault auth, separate from email provider auth) ─────────
export interface User {
  id: string;
  username: string;
  email: string;
  /** Display name shown in the app; falls back to username when unset. */
  displayName: string;
  /** Single emoji avatar (e.g. "🦊"). Mutually exclusive with avatarImage. */
  avatarEmoji: string | null;
  /** Data URL for a profile photo (JPEG/PNG, stored locally). */
  avatarImage: string | null;
  createdAt: number;
  lastLogin: number | null;
}

export interface UserProfilePatch {
  displayName?: string;
  email?: string;
  avatarEmoji?: string | null;
  avatarImage?: string | null;
}

export interface SessionState {
  user: User | null;
  hasAnyUser: boolean;
}

// ─── Intelligence engine (post-sync analysis) ────────────────────────
export type SuggestionType =
  | 'DELETE_BULK_SENDER'
  | 'DELETE_NEWSLETTERS'
  | 'DELETE_NOTIFICATIONS'
  | 'DELETE_LARGE_ATTACHMENTS'
  | 'DELETE_DUPLICATES'
  | 'MOVE_TO_FOLDER'
  | 'MOVE_FROM_JUNK'
  | 'MOVE_FROM_INBOX'
  | 'CREATE_FOLDER'
  | 'CREATE_RULE_AUTO_LABEL'
  | 'CREATE_RULE_AUTO_MOVE'
  | 'CREATE_RULE_AUTO_DELETE'
  | 'BLOCK_SENDER'
  | 'UNSUBSCRIBE'
  | 'ARCHIVE_OLD';

export type SuggestionGroupType = 'cleanup' | 'organize' | 'rules' | 'security';

export type SuggestionActionType =
  | 'delete'
  | 'move'
  | 'create_folder_and_move'
  | 'create_rule'
  | 'create_folder'
  | 'block'
  | 'label'
  | 'unsubscribe'
  | 'archive';

export interface RuleConditionSpec {
  field: 'from' | 'subject' | 'body' | 'has_attachment' | 'is_newsletter';
  operator: 'is' | 'contains' | 'not_contains';
  value: string | boolean;
}

export interface RuleActionSpec {
  type: 'delete' | 'move' | 'label' | 'archive' | 'mark_read' | 'block';
  /** target folder name or label */
  target?: string;
}

export interface RuleSpec {
  name: string;
  conditions: RuleConditionSpec[];
  actions: RuleActionSpec[];
}

/** Action payload for an applied suggestion. Shape varies by action_type. */
export interface SuggestionActionPayload {
  /** The provider message IDs to operate on. Optional — many actions resolve emails by sender. */
  emailIds?: string[];
  /** Sender emails this suggestion targets. */
  senderEmails?: string[];
  /** Where to move emails (provider folder id). */
  destinationFolder?: string;
  /** Graph folder id for move actions (alias used by routing rules). */
  destinationFolderId?: string;
  /** New folder to create before moving. */
  folderName?: string;
  folderColor?: string;
  /** Rule to install when applying. */
  ruleSpec?: RuleSpec;
  /** Provider variant the rule spec is encoded for. We accept both legacy
   *  'gmail' and the canonical 'google' label so analyzer code can pass the
   *  same value the rest of the app uses. */
  providerFormat?: 'gmail' | 'google' | 'microsoft';
  /** UI-only metadata: estimated impact, etc. */
  estimatedCount?: number;
  estimatedBytes?: number;
  estimatedMonthlyImpact?: number;
  /** Newsletter unsubscribe URL pulled from List-Unsubscribe header. */
  unsubscribeUrl?: string;
  /** Whether to also create a rule alongside the immediate action. */
  createRule?: boolean;
  ruleDescription?: string;
  /** When moving from Junk/Spam, also mark as not junk on the provider. */
  markNotJunk?: boolean;
  /** Sender to block + optionally delete history. */
  blockSenderEmail?: string;
  deleteHistory?: boolean;
  /** Free-form notes for analyzers that need to attach context. */
  notes?: string;
}

export interface Suggestion {
  id: string;
  accountId: string;
  type: SuggestionType;
  groupType: SuggestionGroupType;
  /** 1 (critical) → 5 (nice-to-have). */
  priority: 1 | 2 | 3 | 4 | 5;
  /** 0..1 — see CONFIDENCE SCORING in spec. */
  confidence: number;
  title: string;
  description: string;
  actionLabel: string;
  actionType: SuggestionActionType;
  actionPayload: SuggestionActionPayload;
  affectedCount: number;
  affectedSenders: string[];
  sizeBytes: number;
  createdAt: number;
  dismissedAt: number | null;
  appliedAt: number | null;
  /** Free-form analyzer name for debugging / staleness. */
  source: string;
}

export interface SuggestionGroup {
  id: string;
  accountId: string;
  groupType: SuggestionGroupType;
  title: string;
  totalAffected: number;
  totalSizeBytes: number;
  suggestionIds: string[];
  priority: 1 | 2 | 3 | 4 | 5;
}

export interface IntelligenceSummary {
  /** Total suggestions written (active only — excludes already-dismissed/applied). */
  total: number;
  /** Sum of `affected_count` across active suggestions — "emails to act on". */
  totalAffected: number;
  /** Sum of `size_bytes` across active suggestions — "storage to free". */
  totalSizeBytes: number;
  byGroup: Record<SuggestionGroupType, number>;
  byPriority: Record<1 | 2 | 3 | 4 | 5, number>;
  durationMs: number;
}

export interface IntelligenceProgress {
  accountId: string;
  runId: string;
  /** Currently-running analyzer name; null = pre-start or post-finish. */
  currentAnalyzer: string | null;
  /** Number of analyzers that have completed (0..8). */
  analyzersCompleted: number;
  totalAnalyzers: number;
  /** Cumulative # of suggestions produced so far. */
  suggestionsCreated: number;
  done: boolean;
  error?: string;
  summary?: IntelligenceSummary;
}

export interface SuggestionFilter {
  /** Default: only `dismissedAt === null && appliedAt === null`. */
  status?: 'active' | 'applied' | 'dismissed' | 'all';
  groupType?: SuggestionGroupType;
  /** Hide suggestions below this confidence (default 0.5). Override via Settings. */
  minConfidence?: number;
}

// ─── Onboarding ──────────────────────────────────────────────────────
export interface OnboardingState {
  completed: boolean;
  skipped: boolean;
  /** 1-indexed step the user is currently on (or last seen). */
  currentStep: number;
  lastSeenAt: number;
  completedAt: number | null;
}

export const DEFAULT_ONBOARDING: OnboardingState = {
  completed: false,
  skipped: false,
  currentStep: 1,
  lastSeenAt: 0,
  completedAt: null,
};

// ─── Dashboard ───────────────────────────────────────────────────────
export interface DashboardKpis {
  totalEmails: number;
  weekDelta: number;
  storageBytes: number;
  storageWeekDeltaBytes: number;
  cleanedCount: number;
  cleanedBytes: number;
  newEmails: number;
  newEmailsLabel: string;
  pendingActions: number;
  liveSyncActive: boolean;
}

export interface DashboardStorageHistoryPoint {
  date: string;
  timestamp: number;
  emailsDeleted: number;
  bytesFreed: number;
  topSender: string | null;
}

export interface DashboardCategorySlice {
  category: string;
  label: string;
  color: string;
  count: number;
  bytes: number;
}

export interface DashboardSpaceHog {
  email: string;
  name: string;
  count: number;
  bytes: number;
  category: string | null;
  categoryColor: string;
  pctOfTop: number;
}

export interface DashboardActivityItem {
  id: string;
  accountId: string;
  actionType: string;
  summary: string;
  appliedAt: number;
  undoableUntil: number;
  undoneAt: number | null;
}

export interface DashboardFolderRow {
  folderId: string;
  name: string;
  count: number;
  newSinceSync: number;
  isJunk: boolean;
  isTrash: boolean;
  isInbox: boolean;
  junkWarning: boolean;
}

export interface DashboardSyncTimelineRow {
  id: string;
  accountId: string;
  kind: 'full' | 'live' | 'warning';
  label: string;
  at: number;
  detail: string;
}

export interface DashboardLiveAccountRow {
  accountId: string;
  email: string;
  provider: Provider;
  status: LiveSyncAccountStatus;
  lastPollAt: number | null;
  nextPollAt: number | null;
  errorMessage: string | null;
}

export interface DashboardSnapshot {
  scope: 'all' | string;
  hasSyncData: boolean;
  kpis: DashboardKpis;
  storageHistory: DashboardStorageHistoryPoint[];
  storageHistoryTotal: { emails: number; bytes: number };
  newByCategory: DashboardCategorySlice[];
  categoryBreakdown: DashboardCategorySlice[];
  spaceHogs: DashboardSpaceHog[];
  spaceHogsFooter: { topBytes: number; pctOfTotal: number };
  activity: DashboardActivityItem[];
  folders: DashboardFolderRow[];
  cleanup: {
    deletableCount: number;
    deletableBytes: number;
    deletablePct: number;
    newsletterCount: number;
    folderSuggestions: number;
  };
  syncTimeline: DashboardSyncTimelineRow[];
  quickActions: {
    newsletterCount: number;
    organizeCount: number;
    lastSyncAt: number | null;
    ruleSuggestions: number;
  };
  liveAccounts: DashboardLiveAccountRow[];
  junkPendingCount: number;
}

// ─── IPC channels ────────────────────────────────────────────────────
export const IPC = {
  // User session
  UserRegister: 'user:register',
  UserLogin: 'user:login',
  UserLogout: 'user:logout',
  UserMe: 'user:me',
  UserHasAny: 'user:has-any',
  UserChangePassword: 'user:change-password',
  UserUpdateProfile: 'user:update-profile',
  UserChanged: 'user:changed',
  AuthUpdateAccount: 'auth:update-account',

  // OAuth credential setup helpers
  OAuthConfigStatus: 'oauth:config-status',
  OAuthOpenEnv: 'oauth:open-env',
  /** Main → renderer: emitted when an OAuth flow opens an auth URL. */
  OAuthAuthUrl: 'oauth:auth-url',
  /** Main → renderer: emitted when the OAuth flow finishes (success or fail). */
  OAuthAuthDone: 'oauth:auth-done',
  /** Renderer → main: re-open the URL in the system browser. */
  OAuthReopenUrl: 'oauth:reopen-url',

  // Onboarding
  OnboardingGet: 'onboarding:get',
  OnboardingSet: 'onboarding:set',
  /** Main process → renderer: triggered by Help menu / shortcut. */
  OnboardingTriggerRestart: 'onboarding:trigger-restart',
  OnboardingTriggerResume: 'onboarding:trigger-resume',
  /** Help menu items that open various UI panels. */
  HelpShowShortcuts: 'help:show-shortcuts',
  HelpShowWhatsNew: 'help:show-whats-new',

  // Email-provider auth
  AuthLogin: 'auth:login',
  AuthLogout: 'auth:logout',
  AuthListAccounts: 'auth:list-accounts',
  AuthReauth: 'auth:reauth',
  AuthChanged: 'auth:changed',
  // Sync engine
  SyncProbe: 'sync:probe',
  SyncStart: 'sync:start',
  SyncCancel: 'sync:cancel',
  SyncProgress: 'sync:progress',
  // Intelligence engine (post-sync analysis)
  IntelligenceRun: 'intelligence:run',
  IntelligenceCancel: 'intelligence:cancel',
  IntelligenceList: 'intelligence:list',
  IntelligenceGet: 'intelligence:get',
  IntelligenceDismiss: 'intelligence:dismiss',
  IntelligenceUndismiss: 'intelligence:undismiss',
  IntelligenceApply: 'intelligence:apply',
  IntelligenceProgress: 'intelligence:progress',
  IntelligenceComplete: 'intelligence:complete',
  // Email ops
  EmailDelete: 'email:delete',
  EmailDeleteProgress: 'email:delete-progress',
  EmailMove: 'email:move',
  EmailMoveProgress: 'email:move-progress',
  EmailRestore: 'email:restore',
  EmailsListByFolder: 'emails:list-by-folder',
  EmailsGetPreview: 'emails:get-preview',
  EmailsScanJobOffers: 'emails:scan-job-offers',
  EmailsOrganizeJobOffers: 'emails:organize-job-offers',
  // Rules
  RulesList: 'rules:list',
  RulesCreate: 'rules:create',
  RulesUpdate: 'rules:update',
  RulesDelete: 'rules:delete',
  // Blocking
  BlockSender: 'block:sender',
  UnblockSender: 'unblock:sender',
  ListBlocked: 'block:list',
  // Folders
  FoldersList: 'folders:list',
  FoldersCreate: 'folders:create',
  // Settings
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',
  // Personalization (theme + style + layout + panels)
  PrefsGet: 'prefs:get',
  PrefsSet: 'prefs:set',
  // Live sync + notifications
  LiveSyncStart: 'live-sync:start',
  LiveSyncStop: 'live-sync:stop',
  LiveSyncPause: 'live-sync:pause',
  LiveSyncResume: 'live-sync:resume',
  LiveSyncCheckNow: 'live-sync:check-now',
  LiveSyncStatus: 'live-sync:status',
  LiveSyncSetEnabled: 'live-sync:set-enabled',
  LiveNotification: 'live:notification',
  LivePending: 'live:pending',
  LiveBadge: 'live:badge',
  LiveAutoAction: 'live:auto-action',
  LivePollStatus: 'live:poll-status',
  NotificationsList: 'notifications:list',
  NotificationsMarkRead: 'notifications:mark-read',
  NotificationsDismiss: 'notifications:dismiss',
  PendingList: 'pending:list',
  PendingResolve: 'pending:resolve',
  ActionLogUndo: 'action-log:undo',
  DashboardGet: 'dashboard:get',
  SyncMessageIdsBySender: 'sync:message-ids-by-sender',
} as const;

// ───────────────────────────────────────────────────────────────────────
// Personalization System
// ───────────────────────────────────────────────────────────────────────

export type ThemeName = 'midnight' | 'arctic' | 'obsidian' | 'linen' | 'terminal' | 'fog';
export type StyleName = 'minimal' | 'focused' | 'detailed' | 'editorial' | 'warm';
export type DensityStop = 'compact' | 'normal' | 'spacious';
export type MotionStop = 'instant' | 'normal' | 'slow' | 'off';
export type SidebarPosition = 'left' | 'right' | 'compact';
export type ContentLayout =
  | 'single-pane'
  | 'master-detail'
  | 'dashboard-first'
  | 'compact-list'
  | 'three-column';

export type LayoutTemplate =
  | 'classic'
  | 'master-detail'
  | 'focused'
  | 'dashboard-first'
  | 'right-panel'
  | 'three-column';

export type ReadingPanePosition = 'off' | 'right' | 'bottom';
export type EmailListDensity = 'comfortable' | 'compact' | 'condensed';
export type SenderDisplayMode = 'name' | 'email' | 'both';
export type DateFormatMode = 'smart' | 'relative' | 'absolute';
export type UnreadStyleMode = 'bold-dot' | 'bold-only' | 'row-bg' | 'none';
export type EmailHeaderDisplay = 'full' | 'compact' | 'minimal';
export type LineSpacingMode = 'tight' | 'normal' | 'relaxed';
export type RemoteImagesMode = 'ask' | 'always' | 'never';
export type MarkAsReadMode = 'on-open' | '2s' | '5s' | 'manual';

export interface EmailViewPrefs {
  readingPane: ReadingPanePosition;
  listDensity: EmailListDensity;
  previewLines: 1 | 2 | 3;
  senderDisplay: SenderDisplayMode;
  dateFormat: DateFormatMode;
  showAvatars: boolean;
  unreadStyle: UnreadStyleMode;
  headerDisplay: EmailHeaderDisplay;
  fontSize: 13 | 14 | 16 | 18;
  lineSpacing: LineSpacingMode;
  showImages: RemoteImagesMode;
  markAsRead: MarkAsReadMode;
  groupByThread: boolean;
  showSortBar: boolean;
  showEmailCount: boolean;
  showCategoryBadge: boolean;
  splitPosition: number;
}

export interface CustomThemeTokens {
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
}

export interface AppearancePrefs {
  theme: ThemeName;
  style: StyleName;
  /** Hex string, e.g. '#00d4ff'. Overrides theme accent when set. */
  accent: string;
  density: DensityStop;
  motion: MotionStop;
  reduceMotion: boolean;
  /** User-supplied CSS injected via <style id="custom-css">. */
  customCss: string;
  customTheme: CustomThemeTokens | null;
}

export interface LayoutPrefs {
  template: LayoutTemplate;
  sidebarPosition: SidebarPosition;
  sidebarCollapsed: boolean;
  contentLayout: ContentLayout;
  splitPosition: number;
  sidebarItems: Array<{ id: string; visible: boolean; order: number }>;
}

export interface PanelsPrefs {
  accountTabs: boolean;
  storageBar: boolean;
  syncDrawer: boolean;
  suggestionFeed: boolean;
  keyboardHints: boolean;
  emailBadges: boolean;
  statsCards: boolean;
  welcomeGreeting: boolean;
}

export interface WizardPrefs {
  completed: boolean;
  skipped: boolean;
  completedAt: number | null;
}

export interface LiveSyncAutoActionPrefs {
  applyExistingRules: boolean;
  blockListedSenders: boolean;
  autoArchiveNewsletters: boolean;
  autoSortKnownSenders: boolean;
}

export interface LiveSyncNotificationPrefs {
  showNewEmailBadge: boolean;
  ringBellOnApprovals: boolean;
  notifyOnSyncComplete: boolean;
  autoShowModalOnFocus: boolean;
  autoShowModalDelay: number;
  silentAfterHours: string | null;
}

export interface LiveSyncPrefs {
  enabled: boolean;
  pollingIntervalActive: number;
  pollingIntervalBackground: number;
  adaptivePolling: boolean;
  autoActions: LiveSyncAutoActionPrefs;
  notifications: LiveSyncNotificationPrefs;
}

export interface Preferences {
  appearance: AppearancePrefs;
  layout: LayoutPrefs;
  emailView: EmailViewPrefs;
  panels: PanelsPrefs;
  wizard: WizardPrefs;
  liveSync: LiveSyncPrefs;
  updatedAt: number;
}

export const DEFAULT_EMAIL_VIEW: EmailViewPrefs = {
  readingPane: 'right',
  listDensity: 'comfortable',
  previewLines: 2,
  senderDisplay: 'name',
  dateFormat: 'smart',
  showAvatars: true,
  unreadStyle: 'bold-dot',
  headerDisplay: 'full',
  fontSize: 14,
  lineSpacing: 'normal',
  showImages: 'ask',
  markAsRead: 'on-open',
  groupByThread: false,
  showSortBar: true,
  showEmailCount: true,
  showCategoryBadge: true,
  splitPosition: 320,
};

// ─── Live sync + notifications ───────────────────────────────────────
export type NotificationType =
  | 'NEW_EMAIL'
  | 'AUTO_ACTION_APPLIED'
  | 'APPROVAL_NEEDED'
  | 'JUNK_RESCUE'
  | 'RULE_SUGGESTION'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETE'
  | 'SYNC_ERROR'
  | 'AUTH_REQUIRED';

export type NotificationIconType =
  | 'email'
  | 'rule'
  | 'folder'
  | 'block'
  | 'warning'
  | 'check'
  | 'sync'
  | 'auth';

export interface NotificationRecord {
  id: string;
  accountId: string;
  type: NotificationType;
  priority: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  iconType: NotificationIconType;
  actionUrl: string | null;
  pendingId: string | null;
  emailId: string | null;
  emailFrom: string | null;
  emailSubject: string | null;
  readAt: number | null;
  dismissedAt: number | null;
  createdAt: number;
  accountEmail: string;
  accountAvatar: string | null;
  actionLogId?: string | null;
}

export interface PendingActionRecord {
  id: string;
  accountId: string;
  emailId: string;
  emailSubject: string;
  emailFrom: string;
  emailFromName: string;
  emailReceived: number;
  emailFolder: string;
  triggerType: string;
  actionType: string;
  actionLabel: string;
  actionPayload: SuggestionActionPayload;
  priority: 1 | 2 | 3;
  explanation: string;
  confidence: number;
  createdAt: number;
  resolvedAt: number | null;
  resolution: 'approved' | 'rejected' | 'dismissed' | null;
  accountEmail: string;
}

export interface ActionLogRecord {
  id: string;
  accountId: string;
  emailId: string;
  actionType: string;
  beforeState: string;
  afterState: string;
  appliedAt: number;
  undoneAt: number | null;
  undoableUntil: number;
  ruleId: string | null;
  summary: string;
}

export type LiveSyncAccountStatus = 'active' | 'polling' | 'paused' | 'error' | 'offline';

export interface LiveSyncStateRow {
  accountId: string;
  status: LiveSyncAccountStatus;
  lastPollAt: number | null;
  nextPollAt: number | null;
  lastHistoryId: string | null;
  deltaLink: string | null;
  pollInterval: number;
  errorMessage: string | null;
  updatedAt: number;
}

export interface LiveSyncStatusPayload {
  enabled: boolean;
  windowFocused: boolean;
  accounts: LiveSyncStateRow[];
  pendingBadgeCount: number;
  unreadDot: boolean;
}

export const DEFAULT_LIVE_SYNC: LiveSyncPrefs = {
  enabled: true,
  pollingIntervalActive: 60,
  pollingIntervalBackground: 180,
  adaptivePolling: true,
  autoActions: {
    applyExistingRules: true,
    blockListedSenders: true,
    autoArchiveNewsletters: false,
    autoSortKnownSenders: false,
  },
  notifications: {
    showNewEmailBadge: true,
    ringBellOnApprovals: true,
    notifyOnSyncComplete: true,
    autoShowModalOnFocus: true,
    autoShowModalDelay: 2000,
    silentAfterHours: null,
  },
};

export const DEFAULT_PREFS: Preferences = {
  appearance: {
    theme: 'midnight',
    style: 'focused',
    accent: '#00d4ff',
    density: 'normal',
    motion: 'normal',
    reduceMotion: false,
    customCss: '',
    customTheme: null,
  },
  layout: {
    template: 'master-detail',
    sidebarPosition: 'left',
    sidebarCollapsed: false,
    contentLayout: 'master-detail',
    splitPosition: 320,
    sidebarItems: [
      { id: 'dashboard', visible: true, order: 0 },
      { id: 'suggestions', visible: true, order: 1 },
      { id: 'analyze', visible: true, order: 2 },
      { id: 'senders', visible: true, order: 3 },
      { id: 'folders', visible: true, order: 4 },
      { id: 'rules', visible: true, order: 5 },
      { id: 'blocked', visible: true, order: 6 },
      { id: 'settings', visible: true, order: 7 },
    ],
  },
  emailView: { ...DEFAULT_EMAIL_VIEW },
  panels: {
    accountTabs: true,
    storageBar: true,
    syncDrawer: true,
    suggestionFeed: true,
    keyboardHints: false,
    emailBadges: true,
    statsCards: true,
    welcomeGreeting: false,
  },
  wizard: {
    completed: false,
    skipped: false,
    completedAt: null,
  },
  liveSync: { ...DEFAULT_LIVE_SYNC },
  updatedAt: 0,
};

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
