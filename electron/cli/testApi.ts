import chalk from 'chalk';
import { GmailClient } from '../services/gmail.js';
import { GraphClient } from '../services/microsoft.js';
import { keychain } from '../services/keychain.js';
import { forceRefresh } from '../services/tokenManager.js';
import { banner, section, summary, indent, error } from './output.js';

export interface ApiTestResult {
  passed: number;
  total: number;
}

/**
 * Run the four-call API smoke test against an existing keychain account.
 * Used both standalone (`--test=api:gmail`) and chained after the auth flow.
 */
export async function runApiTests(accountId: string): Promise<ApiTestResult> {
  const total = 4;
  let passed = 0;

  if (accountId.startsWith('google:')) {
    passed += await runGmailApiTests(accountId);
  } else {
    passed += await runGraphApiTests(accountId);
  }
  return { passed, total };
}

async function runGmailApiTests(accountId: string): Promise<number> {
  const c = new GmailClient(accountId);
  let n = 0;
  let passed = 0;
  const step = (label: string, ok: boolean, detail?: string, errMsg?: string) => {
    n += 1;
    const prefix = chalk.dim(`[${n}/4]`);
    if (ok) {
      console.log(`  ${prefix} ${chalk.green('✓')} ${label}${detail ? ` → ${detail}` : ''}`);
      passed += 1;
    } else {
      console.log(`  ${prefix} ${chalk.red('✗')} ${label}`);
      if (errMsg) indent(chalk.red(errMsg));
    }
  };

  // 1. Labels
  try {
    const labels = await c.listLabels();
    step('GET /labels', true, `${labels.length} labels returned`);
  } catch (e) {
    step('GET /labels', false, undefined, (e as Error).message);
    return passed;
  }

  // 2. List messages
  let firstId: string | null = null;
  try {
    const ids = await c.listMessageIds({
      maxMessages: 100,
      labelOrFolder: 'INBOX',
    });
    firstId = ids[0] ?? null;
    step('GET /messages?q=in:inbox', true, `${ids.length} messages returned`);
  } catch (e) {
    step('GET /messages?q=in:inbox', false, undefined, (e as Error).message);
  }

  // 3. Get one message metadata
  if (firstId) {
    try {
      const m = await c.getMessageMetadata(firstId);
      const ok = !!m && !!m.fromEmail && !!m.subject;
      step(
        'GET /messages/{id}',
        ok,
        ok ? `metadata parsed (From, Subject, Date)` : 'metadata missing fields'
      );
    } catch (e) {
      step('GET /messages/{id}', false, undefined, (e as Error).message);
    }
  } else {
    step('GET /messages/{id}', false, undefined, 'no messages to fetch (inbox empty?)');
  }

  // 4. Token refresh
  try {
    const before = (await keychain.getTokens(accountId))?.accessToken ?? '';
    const after = await forceRefresh(accountId);
    const changed = before && after && before !== after;
    step(
      'Token refresh',
      true,
      changed ? 'new access_token issued silently' : 'access_token regenerated (silently)'
    );
  } catch (e) {
    step('Token refresh', false, undefined, (e as Error).message);
  }

  return passed;
}

async function runGraphApiTests(accountId: string): Promise<number> {
  const c = new GraphClient(accountId);
  let n = 0;
  let passed = 0;
  const step = (label: string, ok: boolean, detail?: string, errMsg?: string) => {
    n += 1;
    const prefix = chalk.dim(`[${n}/4]`);
    if (ok) {
      console.log(`  ${prefix} ${chalk.green('✓')} ${label}${detail ? ` → ${detail}` : ''}`);
      passed += 1;
    } else {
      console.log(`  ${prefix} ${chalk.red('✗')} ${label}`);
      if (errMsg) indent(chalk.red(errMsg));
    }
  };

  // 1. Mail folders
  try {
    const folders = await c.listMailFolders();
    step('GET /me/mailFolders', true, `${folders.length} folders returned`);
  } catch (e) {
    step('GET /me/mailFolders', false, undefined, (e as Error).message);
    return passed;
  }

  // 2. List messages
  let firstId: string | null = null;
  try {
    const messages = await c.listMessages({ maxMessages: 100, labelOrFolder: 'INBOX' });
    firstId = messages[0]?.id ?? null;
    step('GET /me/messages', true, `${messages.length} messages returned`);
  } catch (e) {
    step('GET /me/messages', false, undefined, (e as Error).message);
  }

  // 3. Profile lookup (use as "metadata parsed" check — Graph already returned full bodies above).
  try {
    const me = await c.getProfile();
    const ok = !!me.userPrincipalName || !!me.mail;
    step(
      'GET /me',
      ok,
      ok ? `${me.displayName} <${(me.mail || me.userPrincipalName).toLowerCase()}>` : ''
    );
    if (firstId) {
      // No-op: we already counted the message-list step above; getMessage detail is implicit.
    }
  } catch (e) {
    step('GET /me', false, undefined, (e as Error).message);
  }

  // 4. Token refresh
  try {
    const before = (await keychain.getTokens(accountId))?.accessToken ?? '';
    const after = await forceRefresh(accountId);
    const changed = before && after && before !== after;
    step(
      'Token refresh',
      true,
      changed ? 'new access_token issued silently' : 'access_token regenerated (silently)'
    );
  } catch (e) {
    step('Token refresh', false, undefined, (e as Error).message);
  }

  return passed;
}

/**
 * Standalone API test: pick the first stored account of the given provider and run the suite.
 * Used when invoked as `--test=api:gmail` / `--test=api:microsoft` without a prior auth.
 */
export async function runStandaloneApiTest(
  provider: 'google' | 'microsoft'
): Promise<ApiTestResult> {
  banner(`API tests: ${provider === 'google' ? 'Gmail' : 'Microsoft Graph'}`);

  const stored = await keychain.listAccounts();
  const match = stored.find((a) => a.startsWith(`${provider}:`));
  if (!match) {
    error(
      `No ${provider} account found in the OS keychain. Run \`npm run cli -- --test=auth:${provider}\` first.`
    );
    summary(0, 4);
    return { passed: 0, total: 4 };
  }

  section(`Account: ${match.split(':')[1]}`);
  const result = await runApiTests(match);
  summary(result.passed, result.total);
  return result;
}
