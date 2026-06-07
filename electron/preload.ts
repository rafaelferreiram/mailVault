import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types.js';

// ─── No-flash boot: read prefs synchronously before any page JS runs ────
// Preload runs in the renderer's isolated world *before* the page's <head>
// scripts execute. Doing a sendSync here means `window.__MAILVAULT_PREFS__`
// is populated by the time the React app starts, AND we can paint the
// correct theme onto <html> immediately so first frame is in-theme.
//
// The CSP on the page blocks inline <script> tags, so we don't add a boot
// script to index.html — applying attributes directly from the preload
// achieves the same outcome with stricter CSP.
let __initialPrefs: {
  appearance?: {
    theme?: string;
    style?: string;
    accent?: string;
    density?: string;
    motion?: string;
    reduceMotion?: boolean;
  };
  layout?: { sidebarPosition?: string; contentLayout?: string; template?: string };
  emailView?: {
    readingPane?: string;
    listDensity?: string;
    splitPosition?: number;
    fontSize?: number;
    lineSpacing?: string;
  };
} | null = null;
try {
  __initialPrefs = ipcRenderer.sendSync('prefs:get-sync');
} catch {
  __initialPrefs = null;
}

// Apply theme/style/accent/etc. to <html> as early as possible — this fires
// at preload time, before any page scripts or stylesheets have run, so the
// first paint is already themed.
//
// Preload runs in the renderer's isolated world and *does* have DOM access at
// runtime, but tsconfig.node.json doesn't include the DOM lib (it's an
// electron-side build). We use untyped `globalThis` access to avoid a hard
// dependency on the DOM type definitions in this build pipeline.
type DomLike = {
  readonly documentElement: {
    setAttribute(k: string, v: string): void;
    style: { setProperty(k: string, v: string): void };
  };
  addEventListener?: (ev: string, cb: () => void, opts?: { once?: boolean }) => void;
};
function getDoc(): DomLike | null {
  const g = globalThis as unknown as { document?: DomLike };
  return g.document ?? null;
}
function applyInitialPrefs() {
  try {
    const doc = getDoc();
    const r = doc?.documentElement;
    if (!r) return;
    const a = __initialPrefs?.appearance;
    const l = __initialPrefs?.layout;
    if (a?.theme) r.setAttribute('data-theme', a.theme);
    if (a?.style) r.setAttribute('data-style', a.style);
    if (a?.density) r.setAttribute('data-density', a.density);
    if (a?.motion) r.setAttribute('data-motion', a.reduceMotion ? 'off' : a.motion);
    if (a?.accent) {
      // Convert hex → "r g b" triplet so the CSS-var alpha pattern works:
      //   bg-accent/40 → rgb(var(--color-accent) / 0.4).
      const m = /^#([0-9a-f]{6})$/i.exec(a.accent);
      if (m) {
        const hex = m[1];
        const rr = parseInt(hex.slice(0, 2), 16);
        const gg = parseInt(hex.slice(2, 4), 16);
        const bb = parseInt(hex.slice(4, 6), 16);
        r.style.setProperty('--color-accent', `${rr} ${gg} ${bb}`);
      }
    }
    if (l?.sidebarPosition) r.setAttribute('data-sidebar', l.sidebarPosition);
    if (l?.contentLayout) r.setAttribute('data-layout', l.contentLayout);
    if (l?.template) r.setAttribute('data-layout-template', l.template);
    const ev = __initialPrefs?.emailView;
    if (ev?.readingPane) r.setAttribute('data-reading-pane', ev.readingPane);
    if (ev?.listDensity) r.setAttribute('data-email-density', ev.listDensity);
    if (ev?.lineSpacing) r.setAttribute('data-email-line-spacing', ev.lineSpacing);
    if (ev?.splitPosition) r.style.setProperty('--email-split-size', `${ev.splitPosition}px`);
    if (ev?.fontSize) r.style.setProperty('--email-reading-font-size', `${ev.fontSize}px`);
  } catch {
    // Best effort — store rehydration in App.tsx will re-apply on mount.
  }
}
const __doc = getDoc();
if (__doc?.documentElement) {
  applyInitialPrefs();
} else if (__doc?.addEventListener) {
  __doc.addEventListener('DOMContentLoaded', applyInitialPrefs, { once: true });
}

const api = {
  // User session (local MailVault account)
  userRegister: (payload: { username: string; email: string; password: string }) =>
    ipcRenderer.invoke(IPC.UserRegister, payload),
  userLogin: (payload: { identifier: string; password: string }) =>
    ipcRenderer.invoke(IPC.UserLogin, payload),
  userLogout: () => ipcRenderer.invoke(IPC.UserLogout),
  userMe: () => ipcRenderer.invoke(IPC.UserMe),
  userHasAny: () => ipcRenderer.invoke(IPC.UserHasAny),
  userChangePassword: (payload: { currentPassword: string; newPassword: string }) =>
    ipcRenderer.invoke(IPC.UserChangePassword, payload),
  userUpdateProfile: (payload: {
    displayName?: string;
    email?: string;
    avatarEmoji?: string | null;
    avatarImage?: string | null;
  }) => ipcRenderer.invoke(IPC.UserUpdateProfile, payload),
  onUserChanged: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.UserChanged, sub);
    return () => ipcRenderer.off(IPC.UserChanged, sub);
  },

  // Email-provider auth
  authLogin: (provider: 'google' | 'microsoft') => ipcRenderer.invoke(IPC.AuthLogin, provider),
  authReauth: (accountId: string) => ipcRenderer.invoke(IPC.AuthReauth, accountId),
  authLogout: (accountId: string) => ipcRenderer.invoke(IPC.AuthLogout, accountId),
  listAccounts: () => ipcRenderer.invoke(IPC.AuthListAccounts),
  authUpdateAccount: (accountId: string, patch: { name?: string }) =>
    ipcRenderer.invoke(IPC.AuthUpdateAccount, accountId, patch),
  onAuthChanged: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.AuthChanged, sub);
    return () => ipcRenderer.off(IPC.AuthChanged, sub);
  },

  // Sync engine
  probeRange: (accountId: string, range: unknown) =>
    ipcRenderer.invoke(IPC.SyncProbe, accountId, range),
  startSync: (accountId: string, opts: unknown) =>
    ipcRenderer.invoke(IPC.SyncStart, accountId, opts),
  cancelSync: (syncId: string) => ipcRenderer.invoke(IPC.SyncCancel, syncId),
  onSyncProgress: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.SyncProgress, sub);
    return () => ipcRenderer.off(IPC.SyncProgress, sub);
  },

  // Intelligence engine
  runIntelligence: (accountId: string) => ipcRenderer.invoke(IPC.IntelligenceRun, accountId),
  cancelIntelligence: (accountId: string) =>
    ipcRenderer.invoke(IPC.IntelligenceCancel, accountId),
  listSuggestions: (accountId: string, filter?: unknown) =>
    ipcRenderer.invoke(IPC.IntelligenceList, accountId, filter),
  getSuggestion: (accountId: string, suggestionId: string) =>
    ipcRenderer.invoke(IPC.IntelligenceGet, accountId, suggestionId),
  dismissSuggestion: (accountId: string, suggestionId: string) =>
    ipcRenderer.invoke(IPC.IntelligenceDismiss, accountId, suggestionId),
  undismissSuggestion: (accountId: string, suggestionId: string) =>
    ipcRenderer.invoke(IPC.IntelligenceUndismiss, accountId, suggestionId),
  applySuggestion: (accountId: string, suggestionId: string) =>
    ipcRenderer.invoke(IPC.IntelligenceApply, accountId, suggestionId),
  onIntelligenceProgress: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.IntelligenceProgress, sub);
    return () => ipcRenderer.off(IPC.IntelligenceProgress, sub);
  },
  onIntelligenceComplete: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.IntelligenceComplete, sub);
    return () => ipcRenderer.off(IPC.IntelligenceComplete, sub);
  },

  // Email
  deleteEmails: (accountId: string, payload: unknown) =>
    ipcRenderer.invoke(IPC.EmailDelete, accountId, payload),
  restoreEmails: (accountId: string, ids: string[]) =>
    ipcRenderer.invoke(IPC.EmailRestore, accountId, ids),
  moveEmails: (accountId: string, payload: unknown) =>
    ipcRenderer.invoke(IPC.EmailMove, accountId, payload),
  onDeleteProgress: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.EmailDeleteProgress, sub);
    return () => ipcRenderer.off(IPC.EmailDeleteProgress, sub);
  },
  onMoveProgress: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.EmailMoveProgress, sub);
    return () => ipcRenderer.off(IPC.EmailMoveProgress, sub);
  },

  // Folders
  listFolders: (accountId: string) => ipcRenderer.invoke(IPC.FoldersList, accountId),
  createFolder: (accountId: string, payload: unknown) =>
    ipcRenderer.invoke(IPC.FoldersCreate, accountId, payload),

  listEmailsByFolder: (
    accountId: string,
    payload: { folderId: string; limit?: number; offset?: number }
  ) => ipcRenderer.invoke(IPC.EmailsListByFolder, accountId, payload),
  getEmailPreview: (accountId: string, messageId: string) =>
    ipcRenderer.invoke(IPC.EmailsGetPreview, accountId, messageId),
  scanJobOffers: (accountId: string) => ipcRenderer.invoke(IPC.EmailsScanJobOffers, accountId),
  organizeJobOffers: (accountId: string, payload?: { messageIds?: string[] }) =>
    ipcRenderer.invoke(IPC.EmailsOrganizeJobOffers, accountId, payload),

  // Rules
  listRules: (accountId: string) => ipcRenderer.invoke(IPC.RulesList, accountId),
  createRule: (accountId: string, rule: unknown) => ipcRenderer.invoke(IPC.RulesCreate, accountId, rule),
  updateRule: (accountId: string, rule: unknown) => ipcRenderer.invoke(IPC.RulesUpdate, accountId, rule),
  deleteRule: (accountId: string, rule: unknown) => ipcRenderer.invoke(IPC.RulesDelete, accountId, rule),

  // Blocking
  blockSender: (accountId: string, payload: unknown) =>
    ipcRenderer.invoke(IPC.BlockSender, accountId, payload),
  unblockSender: (accountId: string, email: string) =>
    ipcRenderer.invoke(IPC.UnblockSender, accountId, email),
  listBlocked: (accountId: string) => ipcRenderer.invoke(IPC.ListBlocked, accountId),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
  setSettings: (partial: unknown) => ipcRenderer.invoke(IPC.SettingsSet, partial),

  // Personalization (theme + style + layout + panels)
  getPreferences: () => ipcRenderer.invoke(IPC.PrefsGet),
  setPreferences: (partial: unknown) => ipcRenderer.invoke(IPC.PrefsSet, partial),
  onOpenPersonalization: (cb: () => void) => {
    const sub = () => cb();
    ipcRenderer.on('prefs:open-panel', sub);
    return () => ipcRenderer.off('prefs:open-panel', sub);
  },

  // Live sync + notifications
  liveSyncStart: () => ipcRenderer.invoke(IPC.LiveSyncStart),
  liveSyncStop: () => ipcRenderer.invoke(IPC.LiveSyncStop),
  liveSyncSetEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC.LiveSyncSetEnabled, enabled),
  liveSyncPause: () => ipcRenderer.invoke(IPC.LiveSyncPause),
  liveSyncResume: () => ipcRenderer.invoke(IPC.LiveSyncResume),
  liveSyncCheckNow: () => ipcRenderer.invoke(IPC.LiveSyncCheckNow),
  liveSyncStatus: () => ipcRenderer.invoke(IPC.LiveSyncStatus),
  listNotifications: (opts?: unknown) => ipcRenderer.invoke(IPC.NotificationsList, opts),
  markNotificationsRead: (ids?: string[]) => ipcRenderer.invoke(IPC.NotificationsMarkRead, ids),
  dismissNotification: (id: string) => ipcRenderer.invoke(IPC.NotificationsDismiss, id),
  listPendingActions: () => ipcRenderer.invoke(IPC.PendingList),
  resolvePendingAction: (id: string, resolution: string) =>
    ipcRenderer.invoke(IPC.PendingResolve, id, resolution),
  undoLiveAction: (actionLogId: string) => ipcRenderer.invoke(IPC.ActionLogUndo, actionLogId),
  getDashboard: (scope: string | 'all') => ipcRenderer.invoke(IPC.DashboardGet, scope),
  listMessageIdsBySender: (accountId: string, senderEmail: string) =>
    ipcRenderer.invoke(IPC.SyncMessageIdsBySender, accountId, senderEmail),
  onLiveNotification: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LiveNotification, sub);
    return () => ipcRenderer.off(IPC.LiveNotification, sub);
  },
  onLivePending: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LivePending, sub);
    return () => ipcRenderer.off(IPC.LivePending, sub);
  },
  onLiveBadge: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LiveBadge, sub);
    return () => ipcRenderer.off(IPC.LiveBadge, sub);
  },
  onLiveStatus: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LiveSyncStatus, sub);
    return () => ipcRenderer.off(IPC.LiveSyncStatus, sub);
  },
  onLiveAutoAction: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LiveAutoAction, sub);
    return () => ipcRenderer.off(IPC.LiveAutoAction, sub);
  },
  onLivePollStatus: (cb: (p: unknown) => void) => {
    const sub = (_e: unknown, p: unknown) => cb(p);
    ipcRenderer.on(IPC.LivePollStatus, sub);
    return () => ipcRenderer.off(IPC.LivePollStatus, sub);
  },

  // OAuth setup
  oauthConfigStatus: () => ipcRenderer.invoke(IPC.OAuthConfigStatus),
  oauthOpenEnv: () => ipcRenderer.invoke(IPC.OAuthOpenEnv),
  oauthReopenUrl: (url: string) => ipcRenderer.invoke(IPC.OAuthReopenUrl, url),
  onOAuthAuthUrl: (cb: (payload: { provider: 'google' | 'microsoft'; url: string }) => void) => {
    const sub = (_e: unknown, payload: { provider: 'google' | 'microsoft'; url: string }) =>
      cb(payload);
    ipcRenderer.on(IPC.OAuthAuthUrl, sub);
    return () => ipcRenderer.off(IPC.OAuthAuthUrl, sub);
  },
  onOAuthAuthDone: (cb: (payload: { provider: 'google' | 'microsoft'; ok: boolean }) => void) => {
    const sub = (_e: unknown, payload: { provider: 'google' | 'microsoft'; ok: boolean }) =>
      cb(payload);
    ipcRenderer.on(IPC.OAuthAuthDone, sub);
    return () => ipcRenderer.off(IPC.OAuthAuthDone, sub);
  },

  // Onboarding
  onboardingGet: () => ipcRenderer.invoke(IPC.OnboardingGet),
  onboardingSet: (payload: unknown) => ipcRenderer.invoke(IPC.OnboardingSet, payload),
  onOnboardingRestart: (cb: () => void) => {
    const sub = () => cb();
    ipcRenderer.on(IPC.OnboardingTriggerRestart, sub);
    return () => ipcRenderer.off(IPC.OnboardingTriggerRestart, sub);
  },
  onShowShortcuts: (cb: () => void) => {
    const sub = () => cb();
    ipcRenderer.on(IPC.HelpShowShortcuts, sub);
    return () => ipcRenderer.off(IPC.HelpShowShortcuts, sub);
  },
  onShowWhatsNew: (cb: () => void) => {
    const sub = () => cb();
    ipcRenderer.on(IPC.HelpShowWhatsNew, sub);
    return () => ipcRenderer.off(IPC.HelpShowWhatsNew, sub);
  },
};

contextBridge.exposeInMainWorld('mailvault', api);
contextBridge.exposeInMainWorld('__MAILVAULT_PREFS__', __initialPrefs);

export type MailVaultAPI = typeof api;
