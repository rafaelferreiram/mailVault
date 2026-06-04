import chalk from 'chalk';
import path from 'node:path';
import os from 'node:os';
import {
  defaultDbPath,
  init,
  register,
  login,
  listLinkedAccounts,
  deleteUser,
  MAX_LINKED,
  ValidationError,
} from '../services/userDb.js';
import { setCurrentUser } from '../services/userSession.js';
import { banner, summary, indent, error } from './output.js';

interface UserTestResult {
  passed: number;
  total: number;
}

function homeify(p: string): string {
  return p.replace(os.homedir(), '~');
}

/**
 * Exercises the local SQLite + bcrypt user system end-to-end.
 * Creates a unique throw-away test user, exercises login + linked-accounts inspection,
 * then cleans up so re-running the test stays idempotent.
 */
export async function runUserTest(opts: { keepUser?: boolean } = {}): Promise<UserTestResult> {
  banner('Local User System (SQLite + bcrypt)');

  const total = 4;
  let passed = 0;
  let n = 0;
  const step = (label: string, ok: boolean, detail?: string, errMsg?: string) => {
    n += 1;
    const prefix = chalk.dim(`[${n}/${total}]`);
    if (ok) {
      console.log(`  ${prefix} ${chalk.green('✓')} ${label}`);
      if (detail) indent(detail);
      passed += 1;
    } else {
      console.log(`  ${prefix} ${chalk.red('✗')} ${label}`);
      if (errMsg) indent(chalk.red(errMsg));
    }
  };

  // 1. DB init
  let createdUserId: string | null = null;
  try {
    const dbPath = defaultDbPath();
    init(dbPath);
    step('SQLite DB initialized', true, homeify(dbPath));
  } catch (e) {
    step('SQLite DB initialized', false, undefined, (e as Error).message);
    summary(passed, total);
    return { passed, total };
  }

  // Pick a unique username so re-running doesn't collide.
  const tag = Date.now().toString(36).slice(-6);
  const username = `testuser_${tag}`;
  const email = `test_${tag}@example.com`;
  const password = 'TestPassword123!';

  // 2. Register
  try {
    const u = await register({ username, email, password });
    createdUserId = u.id;
    step(
      'User created (password hashed with bcrypt cost 12)',
      true,
      `${chalk.cyan(username)} / ${chalk.cyan(email)}`
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      step('User created', false, undefined, `${e.field}: ${e.message}`);
    } else {
      step('User created', false, undefined, (e as Error).message);
    }
  }

  // 3. Login
  let loggedIn = false;
  if (createdUserId) {
    try {
      const u = await login(username, password);
      const wrongPw = await login(username, 'wrong-password');
      if (!u) throw new Error('login() returned null with valid credentials');
      if (wrongPw) throw new Error('login() succeeded with wrong password — bcrypt broken!');
      loggedIn = true;
      setCurrentUser(u);
      step(
        'Login successful: credentials verified, session created',
        true,
        `last_login = ${new Date(u.lastLogin ?? Date.now()).toISOString()}`
      );
    } catch (e) {
      step('Login successful', false, undefined, (e as Error).message);
    }
  }

  // 4. Linked accounts slot
  if (loggedIn && createdUserId) {
    try {
      const linked = listLinkedAccounts(createdUserId);
      step(
        `Linked accounts slot available (${linked.length}/${MAX_LINKED} used)`,
        true,
        linked.length === 0
          ? 'no email accounts linked yet — run --test=auth:google to link one'
          : linked.map((a) => `${a.provider}:${a.email}`).join(', ')
      );
    } catch (e) {
      step('Linked accounts slot available', false, undefined, (e as Error).message);
    }
  } else {
    step('Linked accounts slot available', false, undefined, 'login failed');
  }

  // Cleanup unless requested otherwise.
  if (!opts.keepUser && createdUserId) {
    try {
      deleteUser(createdUserId);
      indent(chalk.dim(`(test user ${username} cleaned up)`));
    } catch (e) {
      error(`Cleanup failed: ${(e as Error).message}`);
    }
  } else if (opts.keepUser && createdUserId) {
    indent(chalk.yellow(`Test user kept: ${username} / ${password}`));
  }

  summary(passed, total);
  return { passed, total };
}

export function showDbPath() {
  const p = defaultDbPath();
  console.log(`  ${chalk.dim('DB path:')} ${homeify(p)}`);
  console.log(
    `  ${chalk.dim('Resolved:')} ${path.dirname(p)}${path.sep}${chalk.bold(path.basename(p))}`
  );
}
