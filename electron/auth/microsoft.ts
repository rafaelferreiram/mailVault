import axios, { AxiosError } from 'axios';
import { generatePkce, generateState, startLoopbackServer, openAuthUrl } from './pkce.js';
import {
  AuthError,
  type OAuthTokens,
  type AccountProfile,
} from '../../shared/types.js';
import type { LoginEvent, LoginProgress } from './google.js';

// IMPORTANT: /consumers/ tenant — see google.ts comment style. /common/ rejects personal MSA.
export const MS_TENANT = 'consumers';
export const MS_AUTH_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
export const MS_TOKEN_URL = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;

export const MS_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Mail.Read',
  'Mail.ReadWrite',
  'MailboxSettings.Read',
  'MailboxSettings.ReadWrite',
  'User.Read',
];

export type MicrosoftLoginProgress = LoginProgress;
export type MicrosoftLoginEvent = LoginEvent;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
  id_token?: string;
}

export async function loginMicrosoft(
  clientId: string,
  progress?: MicrosoftLoginProgress
): Promise<{ profile: AccountProfile; tokens: OAuthTokens }> {
  if (!clientId) {
    throw new AuthError(
      'missing_credentials',
      'Missing Microsoft client ID. Set VITE_MICROSOFT_CLIENT_ID in .env (Application (client) ID from Azure → App registrations).'
    );
  }

  const pkce = generatePkce();
  const state = generateState();
  progress?.({ type: 'pkce', verifierLength: pkce.verifier.length });

  const server = await startLoopbackServer({ expectedState: state });
  const redirectUri = server.redirectUri;
  progress?.({ type: 'server-bound', port: server.port, redirectUri });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
    prompt: 'select_account',
  });

  const authUrl = `${MS_AUTH_URL}?${params.toString()}`;
  progress?.({ type: 'auth-url', url: authUrl });
  openAuthUrl(authUrl);
  progress?.({ type: 'awaiting-code', redirectUri, timeoutMs: 5 * 60_000 });

  let code: string;
  try {
    code = await server.waitForCode();
  } catch (e) {
    server.close();
    const msg = (e as Error).message;
    if (msg.includes('access_denied')) {
      throw new AuthError('access_denied', 'You cancelled the sign-in.');
    }
    throw new AuthError('unknown', msg);
  }
  progress?.({ type: 'code-received', codeLength: code.length });

  let tokenData: TokenResponse;
  try {
    const tokenResp = await axios.post<TokenResponse>(
      MS_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: pkce.verifier,
        scope: MS_SCOPES.join(' '),
      }),
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
    );
    tokenData = tokenResp.data;
  } catch (e) {
    throw mapMsTokenError(e as AxiosError);
  }

  const tokens: OAuthTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 60_000,
    scope: tokenData.scope ?? MS_SCOPES.join(' '),
    tokenType: tokenData.token_type,
    idToken: tokenData.id_token,
  };
  progress?.({ type: 'tokens-received', tokens });

  if (!tokens.refreshToken) {
    throw new AuthError(
      'consent_required',
      'Microsoft did not return a refresh_token. Re-check that the `offline_access` scope is granted on the App Registration.'
    );
  }

  const me = await axios.get<{
    id: string;
    mail?: string;
    userPrincipalName: string;
    displayName: string;
  }>('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const email = (me.data.mail || me.data.userPrincipalName).toLowerCase();
  const profile: AccountProfile = {
    id: `microsoft:${email}`,
    provider: 'microsoft',
    email,
    name: me.data.displayName || email.split('@')[0],
    addedAt: Date.now(),
  };
  progress?.({ type: 'profile-fetched', profile });

  return { profile, tokens };
}

export async function refreshMicrosoft(
  clientId: string,
  refreshToken: string
): Promise<OAuthTokens> {
  if (!refreshToken) {
    throw new AuthError('invalid_grant', 'No refresh token; user must re-authenticate.');
  }

  let resp;
  try {
    resp = await axios.post<TokenResponse>(
      MS_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        scope: MS_SCOPES.join(' '),
      }),
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
    );
  } catch (e) {
    throw mapMsTokenError(e as AxiosError);
  }

  return {
    accessToken: resp.data.access_token,
    refreshToken: resp.data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + resp.data.expires_in * 1000 - 60_000,
    scope: resp.data.scope ?? MS_SCOPES.join(' '),
    tokenType: resp.data.token_type,
    idToken: resp.data.id_token,
  };
}

function mapMsTokenError(e: AxiosError): AuthError {
  const data = e.response?.data as
    | { error?: string; error_description?: string; error_codes?: number[] }
    | undefined;
  const desc = data?.error_description ?? '';
  const code = data?.error ?? '';

  if (desc.includes('AADSTS50020')) {
    return new AuthError(
      'tenant_mismatch',
      'Personal account rejected by /common/ endpoint. MailVault uses /consumers/ — if you still see this, your Azure App Registration must have "Accounts in any organizational directory and personal Microsoft accounts" selected.'
    );
  }
  if (desc.includes('AADSTS65001') || code === 'consent_required') {
    return new AuthError(
      'consent_required',
      'Consent required. Re-authorize and accept all requested permissions.'
    );
  }
  if (code === 'invalid_grant') {
    return new AuthError(
      'invalid_grant',
      'Refresh token is no longer valid. Please reconnect this account.'
    );
  }
  if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
    return new AuthError('network', 'Could not reach Microsoft. Check your internet connection.');
  }
  return new AuthError('unknown', desc || code || e.message);
}
