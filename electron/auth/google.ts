import axios, { AxiosError } from 'axios';
import { generatePkce, generateState, startLoopbackServer, openAuthUrl } from './pkce.js';
import { AuthError, type OAuthTokens, type AccountProfile } from '../../shared/types.js';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
];

/**
 * Progress callback for the OAuth flow. CLI uses it to render a step-by-step trace;
 * the GUI ignores it.
 */
export type LoginProgress = (event: LoginEvent) => void;
export type LoginEvent =
  | { type: 'pkce'; verifierLength: number }
  | { type: 'server-bound'; port: number; redirectUri: string }
  | { type: 'auth-url'; url: string }
  | { type: 'awaiting-code'; redirectUri: string; timeoutMs: number }
  | { type: 'code-received'; codeLength: number }
  | { type: 'tokens-received'; tokens: OAuthTokens }
  | { type: 'profile-fetched'; profile: AccountProfile };

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
  id_token?: string;
}

/**
 * Google's "Desktop app" OAuth client requires BOTH PKCE *and* the client_secret in the token
 * exchange. The secret isn't truly secret in a desktop app (it's embedded in the binary) — Google
 * uses it only as an app-identifier; PKCE is what actually defends against code-interception.
 */
export async function loginGoogle(
  clientId: string,
  clientSecret: string,
  progress?: LoginProgress
): Promise<{ profile: AccountProfile; tokens: OAuthTokens }> {
  if (!clientId || !clientSecret) {
    throw new AuthError(
      'missing_credentials',
      'Missing Google credentials. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET in .env (from Google Cloud → Credentials → OAuth 2.0 Client ID, type "Desktop app").'
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
    scope: GOOGLE_SCOPES.join(' '),
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: pkce.method,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
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
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: pkce.verifier,
      }),
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
    );
    tokenData = tokenResp.data;
  } catch (e) {
    throw mapGoogleTokenError(e as AxiosError);
  }

  const tokens: OAuthTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 60_000,
    scope: tokenData.scope ?? GOOGLE_SCOPES.join(' '),
    tokenType: tokenData.token_type,
    idToken: tokenData.id_token,
  };
  progress?.({ type: 'tokens-received', tokens });

  if (!tokens.refreshToken) {
    throw new AuthError(
      'consent_required',
      'Google did not return a refresh_token. Revoke MailVault at https://myaccount.google.com/permissions and reconnect.'
    );
  }

  const me = await axios.get<{
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
  }>(GOOGLE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const email = me.data.emailAddress.toLowerCase();
  const profile: AccountProfile = {
    id: `google:${email}`,
    provider: 'google',
    email,
    name: email.split('@')[0],
    addedAt: Date.now(),
  };
  progress?.({ type: 'profile-fetched', profile });

  return { profile, tokens };
}

export async function refreshGoogle(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<OAuthTokens> {
  if (!refreshToken) {
    throw new AuthError('invalid_grant', 'No refresh token; user must re-authenticate.');
  }

  let resp;
  try {
    resp = await axios.post<TokenResponse>(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
    );
  } catch (e) {
    throw mapGoogleTokenError(e as AxiosError);
  }

  return {
    accessToken: resp.data.access_token,
    // Google does NOT return a new refresh_token on refresh; reuse the existing one.
    refreshToken: resp.data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + resp.data.expires_in * 1000 - 60_000,
    scope: resp.data.scope ?? GOOGLE_SCOPES.join(' '),
    tokenType: resp.data.token_type,
    idToken: resp.data.id_token,
  };
}

function mapGoogleTokenError(e: AxiosError): AuthError {
  const data = e.response?.data as { error?: string; error_description?: string } | undefined;
  const code = data?.error ?? '';
  const desc = data?.error_description ?? '';

  if (code === 'invalid_grant') {
    return new AuthError(
      'invalid_grant',
      'Refresh token is invalid (expired, revoked, or never issued). Reconnect this account.'
    );
  }
  if (code === 'unauthorized_client' || code === 'invalid_client') {
    return new AuthError(
      'unknown',
      'Google rejected the client credentials. Verify VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET match a Desktop OAuth client.'
    );
  }
  if (code === 'access_denied') {
    return new AuthError('access_denied', 'You cancelled the sign-in.');
  }
  if (desc.includes('Test User')) {
    return new AuthError(
      'consent_required',
      'Your account is not on the Test Users list. Add your email at Google Cloud Console → OAuth consent screen → Test users.'
    );
  }
  if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
    return new AuthError('network', 'Could not reach Google. Check your internet connection.');
  }
  return new AuthError('unknown', desc || code || e.message);
}
