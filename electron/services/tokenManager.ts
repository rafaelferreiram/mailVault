import { keychain } from './keychain.js';
import { storage } from '../store.js';
import { refreshGoogle } from '../auth/google.js';
import { refreshMicrosoft } from '../auth/microsoft.js';
import { AuthError, type Provider, type OAuthTokens } from '../../shared/types.js';

const inflight = new Map<string, Promise<string>>();

type ReauthListener = (accountId: string, error: AuthError) => void;
const reauthListeners = new Set<ReauthListener>();
export function onReauthNeeded(fn: ReauthListener) {
  reauthListeners.add(fn);
  return () => reauthListeners.delete(fn);
}

export function getClientId(provider: Provider): string {
  if (provider === 'google') return process.env.VITE_GOOGLE_CLIENT_ID ?? '';
  return process.env.VITE_MICROSOFT_CLIENT_ID ?? '';
}

export function getClientSecret(provider: Provider): string {
  if (provider === 'google') return process.env.VITE_GOOGLE_CLIENT_SECRET ?? '';
  return '';
}

function providerOf(accountId: string): Provider {
  return accountId.startsWith('google:') ? 'google' : 'microsoft';
}

async function performRefresh(accountId: string, tokens: OAuthTokens): Promise<OAuthTokens> {
  const provider = providerOf(accountId);
  if (provider === 'google') {
    return refreshGoogle(getClientId('google'), getClientSecret('google'), tokens.refreshToken);
  }
  return refreshMicrosoft(getClientId('microsoft'), tokens.refreshToken);
}

/**
 * Returns a valid access token, refreshing silently if expired.
 * On unrecoverable refresh failure, marks the account `needsReauth` and rethrows.
 */
export async function getAccessToken(accountId: string): Promise<string> {
  const tokens = await keychain.getTokens(accountId);
  if (!tokens) throw new AuthError('invalid_grant', `No tokens for account ${accountId}`);

  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;

  const existing = inflight.get(accountId);
  if (existing) return existing;

  const refresh = (async () => {
    try {
      const next = await performRefresh(accountId, tokens);
      await keychain.setTokens(accountId, next);
      storage.patchAccount(accountId, { needsReauth: false, lastSyncedAt: Date.now() });
      return next.accessToken;
    } catch (e) {
      if (e instanceof AuthError && (e.code === 'invalid_grant' || e.code === 'consent_required')) {
        storage.patchAccount(accountId, { needsReauth: true });
        for (const fn of reauthListeners) fn(accountId, e);
      }
      throw e;
    }
  })().finally(() => inflight.delete(accountId));

  inflight.set(accountId, refresh);
  return refresh;
}

/**
 * Force a refresh regardless of whether the cached token *thinks* it's still valid.
 * Called by the 401-retry interceptor when a server tells us the token is dead
 * (e.g. revoked from the provider's security panel).
 */
export async function forceRefresh(accountId: string): Promise<string> {
  const tokens = await keychain.getTokens(accountId);
  if (!tokens) throw new AuthError('invalid_grant', `No tokens for account ${accountId}`);

  const existing = inflight.get(accountId);
  if (existing) return existing;

  const refresh = (async () => {
    try {
      const next = await performRefresh(accountId, tokens);
      await keychain.setTokens(accountId, next);
      storage.patchAccount(accountId, { needsReauth: false, lastSyncedAt: Date.now() });
      return next.accessToken;
    } catch (e) {
      if (e instanceof AuthError && (e.code === 'invalid_grant' || e.code === 'consent_required')) {
        storage.patchAccount(accountId, { needsReauth: true });
        for (const fn of reauthListeners) fn(accountId, e);
      }
      throw e;
    }
  })().finally(() => inflight.delete(accountId));

  inflight.set(accountId, refresh);
  return refresh;
}

export async function setTokens(accountId: string, tokens: OAuthTokens): Promise<void> {
  await keychain.setTokens(accountId, tokens);
  storage.patchAccount(accountId, { needsReauth: false });
}

export async function deleteTokens(accountId: string): Promise<void> {
  await keychain.deleteTokens(accountId);
}
