import { ipcMain, BrowserWindow, shell, app, clipboard } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { storage } from './store.js';
import { keychain } from './services/keychain.js';
import { loginGoogle } from './auth/google.js';
import { loginMicrosoft } from './auth/microsoft.js';
import {
  getClientId,
  getClientSecret,
  setTokens,
  deleteTokens,
  onReauthNeeded,
} from './services/tokenManager.js';
import { GmailClient } from './services/gmail.js';
import { GraphClient } from './services/microsoft.js';
import { ensureAccountRoutingRules } from './services/routingRules.js';
import { startSync, cancelSync } from './services/syncEngine.js';
import { runIntelligence, cancelIntelligence } from './services/intelligenceEngine.js';
import { getDashboardSnapshot } from './services/dashboardData.js';
import {
  checkNowAll,
  getLiveSyncStatus,
  initLiveSyncEngine,
  listAllNotifications,
  onPreferencesChanged,
  pauseLiveSync,
  resolvePending,
  resumeLiveSync,
  setLiveSyncEnabled,
  startLiveSyncForAccounts,
  undoLiveAction,
} from './services/liveSyncEngine.js';
import {
  dismissNotification,
  listPendingActions,
  markNotificationsRead,
} from './services/liveSyncDb.js';
import { openSyncDb } from './services/syncDb.js';
import { suggestionFromRow } from './workers/analyzers/types.js';
import {
  init as initUserDb,
  register as registerUser,
  login as loginUser,
  userCount,
  upsertLinkedAccount,
  removeLinkedAccount,
  setLinkedAccountFlag,
  changePassword,
  listLinkedAccounts,
  ValidationError,
  type UserRow,
} from './services/userDb.js';
import {
  getCurrentUser,
  setCurrentUser,
  onSessionChanged,
} from './services/userSession.js';
import {
  IPC,
  AuthError,
  type Provider,
  type FetchOptions,
  type MailRule,
  type BlockedSender,
  type Folder,
  type TimeRange,
  type User,
  type EmailMessage,
  type EmailPreview,
  type Suggestion,
  type SuggestionGroup,
  type SuggestionFilter,
} from '../shared/types.js';

function safeJsonStrArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function clampPriority(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return Math.round(n) as 1 | 2 | 3 | 4 | 5;
}

/**
 * Dispatch an applied suggestion to the right provider operation. The result
 * tracks how many emails were affected and which IDs are reversible — those
 * IDs flow into the renderer's pending-undo state.
 */
async function applySuggestion(
  accountId: string,
  s: Suggestion
): Promise<{ affected: number; undoableIds?: string[] }> {
  const c = clientFor(accountId);
  const payload = s.actionPayload;

  switch (s.actionType) {
    case 'delete': {
      const ids = await resolveTargetEmailIds(accountId, c, s);
      if (ids.length === 0) return { affected: 0 };
      // Honor user's deletionMode preference. Trash mode keeps an undo
      // window; permanent skips Trash entirely (no recovery). Closes P0-3c.
      const mode = storage.getSettings().deletionMode;
      if (c.kind === 'google') {
        if (mode === 'permanent') await c.gmail.batchPermanentDelete(ids);
        else await c.gmail.batchTrash(ids);
      } else {
        for (const id of ids) {
          try {
            await c.graph.deleteMessage(id, mode);
          } catch {
            // continue past individual failures so the partial result is still useful
          }
        }
      }
      // Only return undoableIds when the deletion is recoverable.
      return mode === 'permanent'
        ? { affected: ids.length }
        : { affected: ids.length, undoableIds: ids };
    }

    case 'archive': {
      const ids = payload.emailIds ?? [];
      if (ids.length === 0) return { affected: 0 };
      if (c.kind === 'google') {
        // Gmail "archive" = remove INBOX label.
        await c.gmail.batchModifyLabels(ids, [], ['INBOX']);
      } else {
        // Graph: move to Archive folder if it exists, otherwise leave a note.
        const folders = await c.graph.listMailFolders();
        const archive = folders.find((f) => /^archive$/i.test(f.name));
        if (archive) {
          for (const id of ids) {
            try {
              await c.graph.moveMessage(id, archive.id);
            } catch {
              // continue
            }
          }
        }
      }
      return { affected: ids.length };
    }

    case 'move': {
      const ids = payload.emailIds ?? [];
      const dest = payload.destinationFolder;
      if (ids.length === 0 || !dest) return { affected: 0 };
      if (c.kind === 'google') {
        const labelId = await resolveGmailLabelId(c.gmail, dest);
        if (labelId) {
          await c.gmail.batchModifyLabels(ids, [labelId], ['SPAM', 'TRASH']);
        }
      } else {
        const targetId = await resolveGraphFolderId(c.graph, dest);
        if (targetId) {
          for (const id of ids) {
            try {
              await c.graph.moveMessage(id, targetId);
            } catch {
              // continue
            }
          }
        }
      }
      return { affected: ids.length };
    }

    case 'create_folder_and_move': {
      const folderName = payload.folderName;
      const ids = payload.emailIds ?? (await resolveTargetEmailIds(accountId, c, s));
      if (!folderName || ids.length === 0) return { affected: 0 };
      if (c.kind === 'google') {
        const label = await c.gmail.createLabel(folderName);
        await c.gmail.batchModifyLabels(ids, [label.id], ['INBOX']);
      } else {
        const created = await c.graph.createMailFolder(folderName);
        for (const id of ids) {
          try {
            await c.graph.moveMessage(id, created.id);
          } catch {
            // continue
          }
        }
      }
      return { affected: ids.length };
    }

    case 'create_folder': {
      const folderName = payload.folderName;
      if (!folderName) return { affected: 0 };
      if (c.kind === 'google') {
        await c.gmail.createLabel(folderName);
      } else {
        await c.graph.createMailFolder(folderName);
      }
      return { affected: 0 };
    }

    case 'block': {
      const target = payload.blockSenderEmail ?? s.affectedSenders[0];
      if (!target) return { affected: 0 };
      const list = storage.getBlocked(accountId);
      if (!list.find((b) => b.email === target)) {
        list.push({
          email: target,
          blockedAt: Date.now(),
          deletedHistorical: !!payload.deleteHistory,
          unsubscribeAttempted: false,
        });
        storage.setBlocked(accountId, list);
      }
      let affected = 0;
      if (payload.deleteHistory) {
        const ids = await resolveTargetEmailIds(accountId, c, s);
        affected = ids.length;
        const mode = storage.getSettings().deletionMode;
        if (c.kind === 'google') {
          if (mode === 'permanent') await c.gmail.batchPermanentDelete(ids);
          else await c.gmail.batchTrash(ids);
        } else {
          for (const id of ids) {
            try {
              await c.graph.deleteMessage(id, mode);
            } catch {
              // continue past individual failures
            }
          }
        }
      }
      return { affected };
    }

    case 'create_rule': {
      if (!payload.ruleSpec) return { affected: 0 };
      const rule = ruleSpecToMailRule(payload.ruleSpec);
      const list = storage.getRules(accountId);
      list.push(rule);
      storage.setRules(accountId, list);
      return { affected: 0 };
    }

    case 'unsubscribe': {
      // Phase 1: open the unsubscribe link if we have one; otherwise treat as
      // a "soft" action and just mark the suggestion applied. Future work:
      // call mailto: List-Unsubscribe headers automatically.
      if (payload.unsubscribeUrl) {
        await shell.openExternal(payload.unsubscribeUrl);
      }
      return { affected: 0 };
    }

    case 'label': {
      const ids = payload.emailIds ?? (await resolveTargetEmailIds(accountId, c, s));
      if (!ids.length) return { affected: 0 };
      const label = payload.folderName ?? 'Auto-labeled';
      if (c.kind === 'google') {
        const lid = await resolveGmailLabelId(c.gmail, label);
        if (lid) await c.gmail.batchModifyLabels(ids, [lid], []);
      }
      // Graph: categories are on the message itself; skipping in Phase 1.
      return { affected: ids.length };
    }
  }
}

/**
 * Resolve the email IDs targeted by a suggestion. Most "delete by sender"
 * suggestions don't ship explicit IDs (the sync DB moves on after every
 * pass, and the suggestion only stores sender emails), so we read the
 * current snapshot from `emails` to find them.
 */
async function resolveTargetEmailIds(
  accountId: string,
  _c: ReturnType<typeof clientFor>,
  s: Suggestion
): Promise<string[]> {
  if (s.actionPayload.emailIds && s.actionPayload.emailIds.length > 0) {
    return s.actionPayload.emailIds;
  }
  const senders = s.affectedSenders.length
    ? s.affectedSenders
    : s.actionPayload.senderEmails ?? [];
  if (senders.length === 0) return [];
  const db = openSyncDb(accountId);
  try {
    const placeholders = senders.map(() => '?').join(',');
    const rows = (
      db as unknown as {
        db: {
          prepare(sql: string): { all(...args: unknown[]): Array<{ id: string }> };
        };
      }
    ).db
      .prepare(
        `SELECT id FROM emails WHERE account_id = ? AND sender_email IN (${placeholders})`
      )
      .all(accountId, ...senders);
    return rows.map((r) => r.id);
  } finally {
    db.close();
  }
}

/**
 * Map a RuleSpec (analyzer output) to MailRule (existing storage shape). The
 * analyzer model is more expressive — we collapse the shape to the flat fields
 * MailRule already understands (`fromContains`, `archive`, etc.).
 */
function ruleSpecToMailRule(spec: import('../shared/types.js').RuleSpec): MailRule {
  const fromCond = spec.conditions.find((c) => c.field === 'from');
  const subjectCond = spec.conditions.find((c) => c.field === 'subject');
  const fromContains =
    typeof fromCond?.value === 'string' ? fromCond.value : undefined;
  const subjectContains =
    typeof subjectCond?.value === 'string' ? subjectCond.value : undefined;
  const moveAction = spec.actions.find((a) => a.type === 'move');
  const labelAction = spec.actions.find((a) => a.type === 'label');
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'suggested',
    name: spec.name,
    fromContains,
    subjectContains,
    addLabel: labelAction?.target ?? moveAction?.target,
    archive: spec.actions.some((a) => a.type === 'archive'),
    delete: spec.actions.some((a) => a.type === 'delete' || a.type === 'block'),
    markRead: spec.actions.some((a) => a.type === 'mark_read'),
    enabled: true,
    createdAt: Date.now(),
  };
}

async function resolveGmailLabelId(client: GmailClient, name: string): Promise<string | null> {
  const labels = await client.listLabels();
  const found = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await client.createLabel(name);
    return created.id;
  } catch {
    return null;
  }
}

async function resolveGraphFolderId(client: GraphClient, name: string): Promise<string | null> {
  if (name.toUpperCase() === 'INBOX') {
    const id = await client.getWellKnownFolderId('inbox');
    if (id) return id;
  }
  if (/^(junk|spam)$/i.test(name)) {
    const id = await client.getWellKnownFolderId('junkemail');
    if (id) return id;
  }
  const folders = await client.listMailFolders();
  if (name.toUpperCase() === 'INBOX') {
    const inbox = folders.find((f) => /inbox/i.test(f.name));
    return inbox?.id ?? null;
  }
  const found = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await client.createMailFolder(name);
    return created.id;
  } catch {
    return null;
  }
}

function clientFor(accountId: string) {
  if (accountId.startsWith('google:'))
    return { kind: 'google' as const, gmail: new GmailClient(accountId) };
  return { kind: 'microsoft' as const, graph: new GraphClient(accountId) };
}

function resolveFolderApiKey(folderId: string, provider: Provider): string {
  const id = folderId.trim();
  const upper = id.toUpperCase();
  if (upper === 'INBOX' || id.toLowerCase() === 'inbox') return 'INBOX';
  if (upper === 'SPAM' || upper === 'JUNK' || id.toLowerCase() === 'junkemail') {
    return provider === 'google' ? 'SPAM' : 'junkemail';
  }
  return id;
}

async function fetchFolderMessagesLive(
  accountId: string,
  folderId: string,
  limit: number
): Promise<EmailMessage[]> {
  const c = clientFor(accountId);
  const provider: Provider = c.kind === 'google' ? 'google' : 'microsoft';
  const key = resolveFolderApiKey(folderId, provider);
  const opts: FetchOptions = { maxMessages: limit, labelOrFolder: key };
  if (c.kind === 'google') {
    const ids = await c.gmail.listMessageIds(opts);
    if (ids.length === 0) return [];
    return c.gmail.getMessagesBatch(ids.slice(0, limit));
  }
  return c.graph.listMessages(opts);
}

function emit(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function unwrapAuthError(e: unknown): { code?: string; message: string } {
  if (e instanceof AuthError) return { code: e.code, message: e.message };
  if (e instanceof ValidationError)
    return { code: `validation:${e.field}`, message: e.message };
  if (e instanceof Error) return { message: e.message };
  return { message: String(e) };
}

function toUser(u: UserRow): User {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin ?? null,
  };
}

function requireUser() {
  const u = getCurrentUser();
  if (!u) {
    throw new AuthError('unknown', 'Not signed in. Please sign in to MailVault first.');
  }
  return u;
}

/**
 * Audit P1-10: every handler that accepts a renderer-supplied `accountId`
 * must verify (a) someone is signed in and (b) that account is linked to
 * THIS user. Otherwise a compromised renderer can issue sync / delete /
 * apply against any keychain key on the device. Read AND write ops go
 * through this — read paths can leak just as much as writes.
 */
function requireOwnedAccount(accountId: string) {
  const u = requireUser();
  const linked = listLinkedAccounts(u.id);
  if (!linked.some((l) => l.keychainKey === accountId)) {
    throw new AuthError(
      'unknown',
      'This account is not linked to the signed-in MailVault user.'
    );
  }
  return u;
}

export function registerIpc() {
  initUserDb();

  // Surface refresh-failure → renderer can show "Reconnect" banner.
  onReauthNeeded((accountId, err) => {
    const user = getCurrentUser();
    if (user) setLinkedAccountFlag(user.id, accountId, { needsReauth: true });
    emit(IPC.AuthChanged, {
      type: 'needs-reauth',
      accountId,
      code: err.code,
      message: err.message,
    });
  });

  onSessionChanged((u) => {
    emit(IPC.UserChanged, { user: u ? toUser(u) : null });
  });

  // ─── User session (local MailVault auth) ──────────────────────────
  ipcMain.handle(
    IPC.UserRegister,
    async (
      _evt,
      payload: { username: string; email: string; password: string }
    ) => {
      try {
        const u = await registerUser(payload);
        setCurrentUser(u);
        return { ok: true as const, user: toUser(u) };
      } catch (e) {
        return { ok: false as const, error: unwrapAuthError(e) };
      }
    }
  );

  ipcMain.handle(
    IPC.UserLogin,
    async (_evt, payload: { identifier: string; password: string }) => {
      try {
        const u = await loginUser(payload.identifier, payload.password);
        if (!u) {
          return {
            ok: false as const,
            error: { code: 'invalid_credentials', message: 'Wrong username or password.' },
          };
        }
        setCurrentUser(u);
        return { ok: true as const, user: toUser(u) };
      } catch (e) {
        return { ok: false as const, error: unwrapAuthError(e) };
      }
    }
  );

  ipcMain.handle(IPC.UserLogout, async () => {
    setCurrentUser(null);
    return true;
  });

  ipcMain.handle(IPC.UserMe, async () => {
    const u = getCurrentUser();
    return u ? toUser(u) : null;
  });

  ipcMain.handle(IPC.UserHasAny, async () => userCount() > 0);

  ipcMain.handle(
    IPC.UserChangePassword,
    async (_evt, payload: { currentPassword: string; newPassword: string }) => {
      try {
        const u = requireUser();
        await changePassword(u.id, payload.currentPassword, payload.newPassword);
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: unwrapAuthError(e) };
      }
    }
  );

  // ─── OAuth setup helpers ──────────────────────────────────────────
  ipcMain.handle(IPC.OAuthConfigStatus, async () => {
    const envPath = path.resolve(app.getAppPath(), '.env');
    const envExists = fs.existsSync(envPath);
    // Re-read .env from disk on every call so the user can hit "Re-check"
    // after editing the file without a full app restart.
    if (envExists) {
      try {
        const text = fs.readFileSync(envPath, 'utf8');
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.trim();
          if (!line || line.startsWith('#')) continue;
          const eq = line.indexOf('=');
          if (eq < 0) continue;
          const key = line.slice(0, eq).trim();
          let val = line.slice(eq + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          // Always overwrite so values get cleared if the user removes them.
          process.env[key] = val;
        }
      } catch (err) {
        console.warn('[oauth] failed to re-read .env:', (err as Error).message);
      }
    }
    const googleId = (process.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
    const googleSecret = (process.env.VITE_GOOGLE_CLIENT_SECRET ?? '').trim();
    const msId = (process.env.VITE_MICROSOFT_CLIENT_ID ?? '').trim();
    return {
      google: {
        configured: !!googleId && !!googleSecret,
        clientId: !!googleId,
        clientSecret: !!googleSecret,
      },
      microsoft: {
        configured: !!msId,
        clientId: !!msId,
      },
      envPath,
      envExists,
    };
  });

  ipcMain.handle(IPC.OAuthOpenEnv, async () => {
    const envPath = path.resolve(app.getAppPath(), '.env');
    const examplePath = path.resolve(app.getAppPath(), '.env.example');
    // If the user hasn't created .env yet, seed it from the example so they
    // have something to fill in instead of staring at a missing-file error.
    try {
      if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
      }
    } catch (err) {
      console.warn('[oauth] could not seed .env:', (err as Error).message);
    }
    if (fs.existsSync(envPath)) {
      // Show the file in Finder + open in default editor.
      shell.showItemInFolder(envPath);
      try {
        await shell.openPath(envPath);
      } catch {
        /* noop — Finder reveal is enough */
      }
      return { ok: true as const, path: envPath };
    }
    return { ok: false as const, path: envPath };
  });

  // ─── Onboarding ───────────────────────────────────────────────────
  ipcMain.handle(IPC.OnboardingGet, async () => storage.getOnboarding());
  ipcMain.handle(
    IPC.OnboardingSet,
    async (
      _evt,
      payload:
        | { reset: true }
        | { patch: Partial<import('../shared/types.js').OnboardingState> }
    ) => {
      if ('reset' in payload && payload.reset) return storage.resetOnboarding();
      if ('patch' in payload) return storage.setOnboarding(payload.patch);
      return storage.getOnboarding();
    }
  );

  // ─── Email-provider auth (gated on a logged-in MailVault user) ────

  /**
   * Build a LoginProgress callback that:
   *   - copies the auth URL to the clipboard the moment the browser is opened
   *     (so the user can paste it into a different browser if their default
   *     opened the wrong profile / fails),
   *   - broadcasts the URL to all renderer windows so the UI can show a
   *     "Authorizing…" panel with copy + reopen buttons.
   */
  function makeAuthProgress(provider: Provider) {
    return (event: { type: string; url?: string; redirectUri?: string }) => {
      if (event.type === 'auth-url' && event.url) {
        try {
          clipboard.writeText(event.url);
        } catch (err) {
          console.warn('[auth] clipboard write failed:', (err as Error).message);
        }
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.OAuthAuthUrl, { provider, url: event.url });
        }
      }
    };
  }

  function broadcastAuthDone(provider: Provider, ok: boolean) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.OAuthAuthDone, { provider, ok });
    }
  }

  ipcMain.handle(IPC.OAuthReopenUrl, async (_evt, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      await shell.openExternal(url);
      return { ok: true as const };
    }
    return { ok: false as const };
  });

  ipcMain.handle(IPC.AuthLogin, async (_evt, provider: Provider) => {
    try {
      const me = requireUser();
      const progress = makeAuthProgress(provider);
      const result =
        provider === 'google'
          ? await loginGoogle(getClientId('google'), getClientSecret('google'), progress)
          : await loginMicrosoft(getClientId('microsoft'), progress);
      broadcastAuthDone(provider, true);
      await setTokens(result.profile.id, result.tokens);
      const linked = upsertLinkedAccount({
        userId: me.id,
        provider: result.profile.provider,
        email: result.profile.email,
        displayName: result.profile.name,
        avatarUrl: result.profile.avatarUrl,
        keychainKey: result.profile.id,
      });
      // Mirror into electron-store for stores that still read from there (back-compat).
      storage.upsertAccount({
        ...result.profile,
        needsReauth: false,
        lastSyncedAt: linked.lastSyncedAt ?? Date.now(),
      });
      return { ok: true as const, profile: result.profile };
    } catch (e) {
      console.error('[auth:login]', e);
      broadcastAuthDone(provider, false);
      return { ok: false as const, error: unwrapAuthError(e) };
    }
  });

  ipcMain.handle(IPC.AuthReauth, async (_evt, accountId: string) => {
    try {
      const me = requireUser();
      const provider: Provider = accountId.startsWith('google:') ? 'google' : 'microsoft';
      const progress = makeAuthProgress(provider);
      const result =
        provider === 'google'
          ? await loginGoogle(getClientId('google'), getClientSecret('google'), progress)
          : await loginMicrosoft(getClientId('microsoft'), progress);
      broadcastAuthDone(provider, true);
      if (result.profile.id !== accountId) {
        return {
          ok: false as const,
          error: {
            code: 'account_mismatch',
            message: `Expected ${accountId.split(':')[1]}, got ${result.profile.email}.`,
          },
        };
      }
      await setTokens(accountId, result.tokens);
      setLinkedAccountFlag(me.id, accountId, {
        needsReauth: false,
        lastSyncedAt: Date.now(),
      });
      storage.patchAccount(accountId, { needsReauth: false, lastSyncedAt: Date.now() });
      return { ok: true as const, profile: result.profile };
    } catch (e) {
      console.error('[auth:reauth]', e);
      const provider: Provider = accountId.startsWith('google:') ? 'google' : 'microsoft';
      broadcastAuthDone(provider, false);
      return { ok: false as const, error: unwrapAuthError(e) };
    }
  });

  ipcMain.handle(IPC.AuthLogout, async (_evt, accountId: string) => {
    const me = getCurrentUser();
    await deleteTokens(accountId);
    if (me) removeLinkedAccount(me.id, accountId);
    storage.removeAccount(accountId);
    emit(IPC.AuthChanged, { type: 'removed', accountId });
    return true;
  });

  ipcMain.handle(IPC.AuthListAccounts, async () => {
    const me = getCurrentUser();
    if (!me) return [];

    const accountsWithTokens = new Set(await keychain.listAccounts());
    const profiles = storage.listAccounts();
    const linkedKeys = new Set(listLinkedAccounts(me.id).map((l) => l.keychainKey));
    const userProfiles = profiles.filter((p) => linkedKeys.has(p.id));

    // Self-heal: missing tokens → flag for reconnect, both in metadata and SQLite.
    for (const p of userProfiles) {
      if (!accountsWithTokens.has(p.id) && !p.needsReauth) {
        storage.patchAccount(p.id, { needsReauth: true });
        setLinkedAccountFlag(me.id, p.id, { needsReauth: true });
      }
    }
    return storage.listAccounts().filter((p) => linkedKeys.has(p.id));
  });

  // ─── Sync engine ───────────────────────────────────────────────────
  ipcMain.handle(
    IPC.SyncProbe,
    async (_evt, accountId: string, range: TimeRange): Promise<number> => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      try {
        return c.kind === 'google'
          ? await c.gmail.probeRange(range)
          : await c.graph.probeRange(range);
      } catch (e) {
        console.warn('probe failed', (e as Error).message);
        return 0;
      }
    }
  );

  ipcMain.handle(
    IPC.SyncStart,
    async (_evt, accountId: string, opts: FetchOptions): Promise<string> => {
      requireOwnedAccount(accountId);
      return startSync(accountId, opts);
    }
  );

  ipcMain.handle(IPC.SyncCancel, async (_evt, syncId: string): Promise<boolean> => {
    // syncId is opaque to the user model; just gate on a session existing.
    requireUser();
    cancelSync(syncId);
    return true;
  });

  // ─── Intelligence engine ────────────────────────────────────────────
  ipcMain.handle(IPC.IntelligenceRun, async (_evt, accountId: string): Promise<string> => {
    requireOwnedAccount(accountId);
    return runIntelligence(accountId);
  });

  ipcMain.handle(IPC.IntelligenceCancel, async (_evt, accountId: string): Promise<boolean> => {
    requireOwnedAccount(accountId);
    cancelIntelligence(accountId);
    return true;
  });

  ipcMain.handle(
    IPC.IntelligenceList,
    async (
      _evt,
      accountId: string,
      filter?: SuggestionFilter
    ): Promise<{ suggestions: Suggestion[]; groups: SuggestionGroup[] }> => {
      requireOwnedAccount(accountId);
      const db = openSyncDb(accountId);
      try {
        const rows = db.listSuggestions(accountId, {
          status: filter?.status ?? 'active',
          minConfidence: filter?.minConfidence ?? 0.5,
        });
        const suggestions = rows.map(suggestionFromRow);
        const groupRows = db.listSuggestionGroups(accountId);
        const groups: SuggestionGroup[] = groupRows.map((g) => ({
          id: g.id,
          accountId: g.accountId,
          groupType: g.groupType as SuggestionGroup['groupType'],
          title: g.title,
          totalAffected: g.totalAffected,
          totalSizeBytes: g.totalSizeBytes,
          suggestionIds: safeJsonStrArr(g.suggestionIds),
          priority: clampPriority(g.priority),
        }));
        return { suggestions, groups };
      } finally {
        db.close();
      }
    }
  );

  ipcMain.handle(
    IPC.IntelligenceGet,
    async (_evt, accountId: string, suggestionId: string): Promise<Suggestion | null> => {
      requireOwnedAccount(accountId);
      const db = openSyncDb(accountId);
      try {
        const row = db.getSuggestion(suggestionId);
        return row ? suggestionFromRow(row) : null;
      } finally {
        db.close();
      }
    }
  );

  ipcMain.handle(
    IPC.IntelligenceDismiss,
    async (_evt, accountId: string, suggestionId: string): Promise<boolean> => {
      requireOwnedAccount(accountId);
      const db = openSyncDb(accountId);
      try {
        db.dismissSuggestion(suggestionId);
        return true;
      } finally {
        db.close();
      }
    }
  );

  ipcMain.handle(
    IPC.IntelligenceUndismiss,
    async (_evt, accountId: string, suggestionId: string): Promise<boolean> => {
      requireOwnedAccount(accountId);
      const db = openSyncDb(accountId);
      try {
        db.undismissSuggestion(suggestionId);
        return true;
      } finally {
        db.close();
      }
    }
  );

  /**
   * Apply a suggestion: dispatches to the appropriate provider operation,
   * then marks the row applied. The renderer can subscribe to the existing
   * EmailDeleteProgress / EmailMoveProgress events for fine-grained progress.
   */
  ipcMain.handle(
    IPC.IntelligenceApply,
    async (
      _evt,
      accountId: string,
      suggestionId: string
    ): Promise<{ ok: boolean; error?: string; affected: number; undoableIds?: string[] }> => {
      requireOwnedAccount(accountId);
      const db = openSyncDb(accountId);
      let row;
      try {
        row = db.getSuggestion(suggestionId);
      } finally {
        db.close();
      }
      if (!row) return { ok: false, error: 'Suggestion not found', affected: 0 };
      const s = suggestionFromRow(row);

      try {
        const result = await applySuggestion(accountId, s);
        const db2 = openSyncDb(accountId);
        try {
          db2.markSuggestionApplied(suggestionId);
        } finally {
          db2.close();
        }
        return { ok: true, affected: result.affected, undoableIds: result.undoableIds };
      } catch (e) {
        return { ok: false, error: (e as Error).message, affected: 0 };
      }
    }
  );

  // ─── Email delete ──────────────────────────────────────────────────
  ipcMain.handle(
    IPC.EmailDelete,
    async (
      _evt,
      accountId: string,
      payload: {
        messages: Array<{ id: string; senderEmail: string }>;
        mode?: 'trash' | 'permanent';
      }
    ) => {
      requireOwnedAccount(accountId);
      const mode = payload.mode ?? storage.getSettings().deletionMode;
      const c = clientFor(accountId);
      const total = payload.messages.length;
      const perSender: Record<string, { ok: number; fail: number }> = {};
      const successfulIds: string[] = [];
      let deleted = 0;
      let failed = 0;

      // Initialize per-sender map so the UI sees zeroes in the right shape.
      for (const m of payload.messages) {
        perSender[m.senderEmail] ??= { ok: 0, fail: 0 };
      }

      const tickPayload = (done: boolean) => ({
        accountId,
        deleted,
        failed,
        total,
        perSender,
        done,
      });

      if (c.kind === 'google' && mode === 'trash') {
        // Single batchModify call (up to 1000 ids) — orders of magnitude faster.
        const ids = payload.messages.map((m) => m.id);
        try {
          await c.gmail.batchTrash(ids);
          for (const m of payload.messages) {
            perSender[m.senderEmail].ok += 1;
            successfulIds.push(m.id);
          }
          deleted = ids.length;
        } catch (e) {
          for (const m of payload.messages) perSender[m.senderEmail].fail += 1;
          failed = ids.length;
          console.error('[email:delete] batchTrash failed', e);
        }
        emit(IPC.EmailDeleteProgress, tickPayload(true));
      } else {
        // Per-id concurrent path (used for permanent deletes and Microsoft).
        const concurrency = 8;
        let i = 0;
        const tick = () => {
          if (deleted + failed === total || (deleted + failed) % 10 === 0) {
            emit(IPC.EmailDeleteProgress, tickPayload(deleted + failed === total));
          }
        };

        const workers = Array.from({ length: concurrency }, async () => {
          while (true) {
            const idx = i++;
            if (idx >= total) return;
            const { id, senderEmail } = payload.messages[idx];
            try {
              if (c.kind === 'google') {
                await c.gmail.deleteMessage(id);
              } else {
                await c.graph.deleteMessage(id, mode);
              }
              perSender[senderEmail].ok += 1;
              if (mode === 'trash') successfulIds.push(id);
              deleted += 1;
            } catch {
              perSender[senderEmail].fail += 1;
              failed += 1;
            }
            tick();
          }
        });
        await Promise.all(workers);
        emit(IPC.EmailDeleteProgress, tickPayload(true));
      }

      return { deleted, failed, perSender, undoableIds: successfulIds, mode };
    }
  );

  ipcMain.handle(
    IPC.EmailRestore,
    async (
      _evt,
      accountId: string,
      ids: string[]
    ): Promise<{ restored: number; failed: number }> => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      let restored = 0;
      let failed = 0;
      if (c.kind === 'google') {
        try {
          await c.gmail.batchUntrash(ids);
          restored = ids.length;
        } catch {
          failed = ids.length;
        }
      } else {
        for (const id of ids) {
          try {
            await c.graph.restoreFromTrash(id);
            restored += 1;
          } catch {
            failed += 1;
          }
        }
      }
      return { restored, failed };
    }
  );

  // ─── Email move (folders/labels) ───────────────────────────────────
  ipcMain.handle(
    IPC.EmailMove,
    async (
      _evt,
      accountId: string,
      payload: {
        messageIds: string[];
        destinationFolderId: string;
        markNotJunk?: boolean;
      }
    ) => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      const total = payload.messageIds.length;
      let moved = 0;
      let failed = 0;

      if (c.kind === 'google') {
        try {
          const remove: string[] = ['INBOX'];
          if (payload.markNotJunk) remove.push('SPAM');
          await c.gmail.batchModifyLabels(
            payload.messageIds,
            [payload.destinationFolderId],
            remove
          );
          moved = total;
        } catch {
          failed = total;
        }
        emit(IPC.EmailMoveProgress, { accountId, moved, failed, total, done: true });
        return { moved, failed };
      }

      // Microsoft Graph: per-message /move.
      const concurrency = 8;
      let i = 0;
      const tick = () => {
        if (moved + failed === total || (moved + failed) % 10 === 0) {
          emit(IPC.EmailMoveProgress, {
            accountId,
            moved,
            failed,
            total,
            done: moved + failed === total,
          });
        }
      };
      const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
          const idx = i++;
          if (idx >= total) return;
          const id = payload.messageIds[idx];
          try {
            await c.graph.moveMessage(id, payload.destinationFolderId);
            moved += 1;
          } catch {
            failed += 1;
          }
          tick();
        }
      });
      await Promise.all(workers);
      emit(IPC.EmailMoveProgress, { accountId, moved, failed, total, done: true });
      return { moved, failed };
    }
  );

  // ─── Folders ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.FoldersList, async (_evt, accountId: string): Promise<Folder[]> => {
    requireOwnedAccount(accountId);
    const c = clientFor(accountId);
    return c.kind === 'google' ? await c.gmail.listLabels() : await c.graph.listMailFolders();
  });

  ipcMain.handle(
    IPC.FoldersCreate,
    async (
      _evt,
      accountId: string,
      payload: { name: string; color?: string }
    ): Promise<Folder> => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      return c.kind === 'google'
        ? await c.gmail.createLabel(payload.name, payload.color)
        : await c.graph.createMailFolder(payload.name);
    }
  );

  ipcMain.handle(
    IPC.EmailsListByFolder,
    async (
      _evt,
      accountId: string,
      payload: { folderId: string; limit?: number; offset?: number }
    ): Promise<{ messages: EmailMessage[]; source: 'cache' | 'live' }> => {
      requireOwnedAccount(accountId);
      const limit = Math.min(payload.limit ?? 200, 500);
      const offset = payload.offset ?? 0;

      const db = openSyncDb(accountId);
      try {
        const cached = db.listEmailsByFolder(accountId, payload.folderId, limit, offset);
        if (cached.length > 0) {
          return {
            source: 'cache',
            messages: cached.map((r) => ({
              id: r.id,
              fromEmail: r.fromEmail,
              fromName: r.fromName,
              subject: r.subject,
              snippet: '',
              receivedAt: r.receivedAt,
              sizeBytes: r.sizeBytes,
              isUnread: r.isUnread,
              hasListUnsubscribe: r.hasListUnsubscribe,
              folder: r.folder,
            })),
          };
        }
      } finally {
        db.close();
      }

      const messages = await fetchFolderMessagesLive(accountId, payload.folderId, limit);
      return { messages, source: 'live' };
    }
  );

  ipcMain.handle(
    IPC.EmailsGetPreview,
    async (_evt, accountId: string, messageId: string): Promise<EmailPreview | null> => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      return c.kind === 'google'
        ? await c.gmail.getMessagePreview(messageId)
        : await c.graph.getMessagePreview(messageId);
    }
  );

  // ─── Rules ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.RulesList, async (_evt, accountId: string): Promise<MailRule[]> => {
    requireOwnedAccount(accountId);
    const c = clientFor(accountId);
    const profile = storage.listAccounts().find((a) => a.id === accountId);
    if (profile) {
      try {
        await ensureAccountRoutingRules(accountId, profile.email, c);
      } catch {
        // Presets are best-effort; still return whatever rules exist.
      }
    }
    const remote = c.kind === 'google' ? await c.gmail.listFilters() : await c.graph.listRules();
    const local = storage.getRules(accountId).filter((r) => r.source !== 'remote');
    const merged = [...remote, ...local];
    storage.setRules(accountId, merged);
    return merged;
  });

  ipcMain.handle(IPC.RulesCreate, async (_evt, accountId: string, rule: MailRule) => {
    requireOwnedAccount(accountId);
    const c = clientFor(accountId);
    const created =
      c.kind === 'google' ? await c.gmail.createFilter(rule) : await c.graph.createRule(rule);
    const list = storage.getRules(accountId);
    list.push(created);
    storage.setRules(accountId, list);
    return created;
  });

  ipcMain.handle(IPC.RulesDelete, async (_evt, accountId: string, rule: MailRule) => {
    requireOwnedAccount(accountId);
    const c = clientFor(accountId);
    if (rule.providerRuleId) {
      if (c.kind === 'google') await c.gmail.deleteFilter(rule.providerRuleId);
      else await c.graph.deleteRule(rule.providerRuleId);
    }
    const list = storage.getRules(accountId).filter((r) => r.id !== rule.id);
    storage.setRules(accountId, list);
    return true;
  });

  ipcMain.handle(IPC.RulesUpdate, async (_evt, accountId: string, rule: MailRule) => {
    requireOwnedAccount(accountId);
    const c = clientFor(accountId);
    if (rule.providerRuleId) {
      if (c.kind === 'google') await c.gmail.deleteFilter(rule.providerRuleId);
      else await c.graph.deleteRule(rule.providerRuleId);
    }
    const created = rule.enabled
      ? c.kind === 'google'
        ? await c.gmail.createFilter(rule)
        : await c.graph.createRule(rule)
      : { ...rule, providerRuleId: undefined };
    const list = storage.getRules(accountId).map((r) => (r.id === rule.id ? created : r));
    storage.setRules(accountId, list);
    return created;
  });

  // ─── Block / unblock ───────────────────────────────────────────────
  ipcMain.handle(
    IPC.BlockSender,
    async (
      _evt,
      accountId: string,
      payload: { email: string; name?: string; deleteHistorical: boolean; messageIds: string[] }
    ) => {
      requireOwnedAccount(accountId);
      const c = clientFor(accountId);
      const rule: MailRule = {
        id: `blocked-${payload.email}-${Date.now()}`,
        source: 'local',
        name: `Blocked: ${payload.email}`,
        fromContains: payload.email,
        delete: true,
        markRead: true,
        enabled: true,
        createdAt: Date.now(),
      };
      const created =
        c.kind === 'google' ? await c.gmail.createFilter(rule) : await c.graph.createRule(rule);

      const rules = storage.getRules(accountId);
      rules.push(created);
      storage.setRules(accountId, rules);

      let deletedCount = 0;
      if (payload.deleteHistorical && payload.messageIds.length) {
        const mode = storage.getSettings().deletionMode;
        if (c.kind === 'google' && mode === 'trash') {
          try {
            await c.gmail.batchTrash(payload.messageIds);
            deletedCount = payload.messageIds.length;
          } catch {
            // continue
          }
        } else {
          for (const id of payload.messageIds) {
            try {
              if (c.kind === 'google') {
                if (mode === 'permanent') await c.gmail.deleteMessage(id);
                else await c.gmail.trashMessage(id);
              } else {
                await c.graph.deleteMessage(id, mode);
              }
              deletedCount += 1;
            } catch {
              // continue
            }
          }
        }
      }

      const blocked: BlockedSender = {
        email: payload.email,
        name: payload.name,
        blockedAt: Date.now(),
        ruleId: created.providerRuleId,
        deletedHistorical: payload.deleteHistorical,
        unsubscribeAttempted: false,
      };
      const list = storage.getBlocked(accountId);
      const idx = list.findIndex((b) => b.email === blocked.email);
      if (idx >= 0) list[idx] = blocked;
      else list.push(blocked);
      storage.setBlocked(accountId, list);
      return { blocked, deletedCount };
    }
  );

  ipcMain.handle(IPC.UnblockSender, async (_evt, accountId: string, email: string) => {
    requireOwnedAccount(accountId);
    const list = storage.getBlocked(accountId);
    const entry = list.find((b) => b.email === email);
    if (entry?.ruleId) {
      const c = clientFor(accountId);
      try {
        if (c.kind === 'google') await c.gmail.deleteFilter(entry.ruleId);
        else await c.graph.deleteRule(entry.ruleId);
      } catch {
        // best effort
      }
    }
    storage.setBlocked(
      accountId,
      list.filter((b) => b.email !== email)
    );
    return true;
  });

  ipcMain.handle(IPC.ListBlocked, async (_evt, accountId: string) => {
    requireOwnedAccount(accountId);
    return storage.getBlocked(accountId);
  });

  // ─── Settings ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.SettingsGet, async () => {
    requireUser();
    return storage.getSettings();
  });
  ipcMain.handle(IPC.SettingsSet, async (_evt, partial) => {
    requireUser();
    storage.setSettings(partial);
    return storage.getSettings();
  });

  // ─── Personalization (theme/style/layout/panels) ──────────────────
  // No requireUser() gate: prefs apply to the renderer chrome and we want the
  // login screen itself themed too. Worst case: a hostile renderer can flip
  // the user's accent color — no privacy/data exposure.
  ipcMain.handle(IPC.PrefsGet, async () => storage.getPreferences());
  ipcMain.handle(IPC.PrefsSet, async (_evt, partial) => {
    const next = storage.setPreferences(partial);
    onPreferencesChanged();
    return next;
  });

  // ─── Live sync + notifications ───────────────────────────────────
  ipcMain.handle(IPC.LiveSyncStart, async () => {
    requireUser();
    initLiveSyncEngine();
    startLiveSyncForAccounts(storage.listAccounts());
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncStop, async () => {
    requireUser();
    setLiveSyncEnabled(false);
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncSetEnabled, async (_evt, enabled: boolean) => {
    requireUser();
    setLiveSyncEnabled(enabled);
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncPause, async () => {
    requireUser();
    pauseLiveSync();
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncResume, async () => {
    requireUser();
    resumeLiveSync();
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncCheckNow, async () => {
    requireUser();
    checkNowAll();
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.LiveSyncStatus, async () => {
    requireUser();
    return getLiveSyncStatus();
  });

  ipcMain.handle(IPC.NotificationsList, async (_evt, opts?: { limit?: number; accountId?: string }) => {
    requireUser();
    return listAllNotifications(opts?.limit ?? 100);
  });

  ipcMain.handle(IPC.NotificationsMarkRead, async (_evt, ids?: string[]) => {
    requireUser();
    markNotificationsRead(ids);
    return true;
  });

  ipcMain.handle(IPC.NotificationsDismiss, async (_evt, id: string) => {
    requireUser();
    dismissNotification(id);
    return true;
  });

  ipcMain.handle(IPC.PendingList, async () => {
    requireUser();
    return listPendingActions();
  });

  ipcMain.handle(
    IPC.PendingResolve,
    async (_evt, pendingId: string, resolution: 'approved' | 'rejected' | 'dismissed') => {
      requireUser();
      return resolvePending(pendingId, resolution);
    }
  );

  ipcMain.handle(IPC.ActionLogUndo, async (_evt, actionLogId: string) => {
    requireUser();
    return undoLiveAction(actionLogId);
  });

  ipcMain.handle(IPC.DashboardGet, async (_evt, scope: string | 'all') => {
    requireUser();
    const s = scope === 'all' || !scope ? 'all' : scope;
    return getDashboardSnapshot(s);
  });
}
