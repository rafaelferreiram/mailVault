import chalk from 'chalk';
import { loginGoogle } from '../auth/google.js';
import { loginMicrosoft } from '../auth/microsoft.js';
import type { LoginEvent } from '../auth/google.js';
import { keychain } from '../services/keychain.js';
import { setTokens } from '../services/tokenManager.js';
import { banner, section, summary, indent, trunc, error } from './output.js';
import { runApiTests } from './testApi.js';
import {
  AuthError,
  type AccountProfile,
  type OAuthTokens,
} from '../../shared/types.js';
import { getCurrentUser } from '../services/userSession.js';
import { upsertLinkedAccount } from '../services/userDb.js';

interface AuthTestResult {
  passed: boolean;
  totalAuth: number;
  passedAuth: number;
  totalApi: number;
  passedApi: number;
  accountId?: string;
}

export async function runAuthTest(provider: 'google' | 'microsoft'): Promise<AuthTestResult> {
  banner(`Provider: ${provider === 'google' ? 'Google (Gmail)' : 'Microsoft (Outlook / Hotmail)'}`);

  const TOTAL = 6;
  let n = 0;
  const stepNum = () => chalk.dim(`[${++n}/${TOTAL}]`);
  const printOk = (label: string) => console.log(`  ${stepNum()} ${chalk.green('✓')} ${label}`);

  const handler = (e: LoginEvent) => {
    switch (e.type) {
      case 'pkce':
        printOk(`PKCE code_verifier generated (${e.verifierLength} chars)`);
        break;
      case 'server-bound':
        // Combined with the auth-url line below.
        break;
      case 'auth-url':
        printOk('Auth URL constructed — opening browser…');
        indent(chalk.blue.underline(trunc(e.url, 80)));
        break;
      case 'awaiting-code': {
        const port = new URL(e.redirectUri).port;
        // Render this as a "pending" line that we'll replace when the code lands.
        process.stdout.write(
          `  ${chalk.dim(`[3/${TOTAL}]`)} ${chalk.yellow('⏳')} Waiting for OAuth callback on localhost:${port}…\r`
        );
        // We deliberately don't bump n here; the "[3/6]" success replaces this.
        n -= 1; // we already counted '2' for the auth-url; cancel the pre-increment of 'awaiting'
        break;
      }
      case 'code-received':
        process.stdout.write('\r');
        printOk('Authorization code received');
        break;
      case 'tokens-received': {
        const expSec = Math.round((e.tokens.expiresAt - Date.now()) / 1000);
        printOk('Token exchange successful');
        indent(`access_token:  ${trunc(e.tokens.accessToken, 16)}… (truncated)`);
        if (e.tokens.refreshToken)
          indent(`refresh_token: ${trunc(e.tokens.refreshToken, 12)}…       (truncated)`);
        indent(`expires_in:    ${expSec}s`);
        break;
      }
      case 'profile-fetched':
        // Step 5 (keychain) prints separately AFTER the function returns; defer step 6 too.
        break;
    }
  };

  let result: { profile: AccountProfile; tokens: OAuthTokens } | null = null;
  let authPassed = 0;

  try {
    if (provider === 'google') {
      const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret =
        process.env.VITE_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
      result = await loginGoogle(clientId, clientSecret, handler);
    } else {
      const clientId =
        process.env.VITE_MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '';
      result = await loginMicrosoft(clientId, handler);
    }
    authPassed = 4; // pkce, auth-url, code-received, tokens-received

    await setTokens(result.profile.id, result.tokens);
    const backend = await keychain.backendInfo();
    printOk(`Tokens stored in OS keychain (${backend.backend})`);
    authPassed += 1;

    // If we're inside a signed-in MailVault session, persist this as a linked account.
    const me = getCurrentUser();
    if (me) {
      upsertLinkedAccount({
        userId: me.id,
        provider: result.profile.provider,
        email: result.profile.email,
        displayName: result.profile.name,
        keychainKey: result.profile.id,
      });
      indent(chalk.dim(`Linked to MailVault user @${me.username}`));
    }

    printOk(
      `Profile fetched: ${result.profile.name} <${chalk.cyan(result.profile.email)}>`
    );
    authPassed += 1;
  } catch (e) {
    process.stdout.write('\r');
    error(`Auth flow failed: ${(e as Error).message}`);
    if (e instanceof AuthError && e.code === 'tenant_mismatch') {
      indent(chalk.yellow('Hint: Azure → App Registration → Authentication: select'));
      indent(
        chalk.yellow(
          '"Accounts in any organizational directory and personal Microsoft accounts".'
        )
      );
    }
    summary(authPassed, TOTAL);
    return {
      passed: false,
      totalAuth: TOTAL,
      passedAuth: authPassed,
      totalApi: 4,
      passedApi: 0,
    };
  }

  // ─── API smoke tests on the just-authenticated account ─────────────────
  section('API Smoke Tests:');
  const api = await runApiTests(result.profile.id);

  console.log('');
  console.log('  ' + chalk.dim('─'.repeat(45)));
  const allPassed = authPassed === TOTAL && api.passed === api.total;
  if (allPassed) {
    console.log(
      '  ' +
        chalk.green.bold(
          `ALL TESTS PASSED (${authPassed}/${TOTAL} auth, ${api.passed}/${api.total} api) ✓`
        )
    );
  } else {
    console.log(
      '  ' +
        chalk.red.bold(
          `FAILED (${authPassed}/${TOTAL} auth, ${api.passed}/${api.total} api)`
        )
    );
  }
  console.log('');

  return {
    passed: allPassed,
    totalAuth: TOTAL,
    passedAuth: authPassed,
    totalApi: api.total,
    passedApi: api.passed,
    accountId: result.profile.id,
  };
}
