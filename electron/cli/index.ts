import chalk from 'chalk';
import { runAuthTest } from './testAuth.js';
import { runUserTest } from './testUser.js';
import { runStandaloneApiTest } from './testApi.js';

type TestKey =
  | 'auth:google'
  | 'auth:microsoft'
  | 'api:gmail'
  | 'api:microsoft'
  | 'user'
  | 'all';

const VALID_TESTS: ReadonlyArray<TestKey> = [
  'auth:google',
  'auth:microsoft',
  'api:gmail',
  'api:microsoft',
  'user',
  'all',
];

function parseArgs(argv: string[]): { test: TestKey | null; help: boolean } {
  const cliArgs = argv.slice(argv.indexOf('--cli') + 1).filter((a) => !a.startsWith('--cli'));
  const help = cliArgs.includes('--help') || cliArgs.includes('-h');
  const testFlag = cliArgs.find((a) => a.startsWith('--test='));
  const test = testFlag ? (testFlag.slice('--test='.length) as TestKey) : null;
  return { test, help };
}

function printHelp() {
  console.log('');
  console.log(chalk.cyan.bold('  MailVault CLI Test Runner'));
  console.log('  ' + chalk.dim('─'.repeat(45)));
  console.log('');
  console.log('  Usage: ' + chalk.bold('npm run cli -- --test=<test>'));
  console.log('');
  console.log('  Tests:');
  console.log(`    ${chalk.green('auth:google')}      Full Google/Gmail OAuth flow + 4 API smoke tests`);
  console.log(`    ${chalk.green('auth:microsoft')}   Full Microsoft Graph OAuth flow + 4 API smoke tests`);
  console.log(`    ${chalk.green('api:gmail')}        4 Gmail API tests against the most-recently-stored Google account`);
  console.log(`    ${chalk.green('api:microsoft')}    4 Graph API tests against the most-recently-stored Microsoft account`);
  console.log(`    ${chalk.green('user')}             Local SQLite + bcrypt user system smoke test`);
  console.log(`    ${chalk.green('all')}              Run user, then auth:google, then auth:microsoft (skips on missing creds)`);
  console.log('');
  console.log(`  Examples:`);
  console.log(`    npm run cli -- --test=user`);
  console.log(`    npm run cli -- --test=auth:google`);
  console.log(`    npm run cli -- --test=all`);
  console.log('');
}

function hasGoogleCreds() {
  return !!(
    (process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.VITE_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)
  );
}

function hasMicrosoftCreds() {
  return !!(process.env.VITE_MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID);
}

export async function runCli(argv: string[]): Promise<number> {
  const { test, help } = parseArgs(argv);

  if (help || !test) {
    printHelp();
    if (!test) {
      console.log(chalk.red('  Missing --test=<test>'));
      console.log('');
      return 2;
    }
    return 0;
  }

  if (!VALID_TESTS.includes(test)) {
    console.log('');
    console.log(chalk.red(`  Unknown test: ${test}`));
    console.log(chalk.dim('  Valid tests: ' + VALID_TESTS.join(', ')));
    console.log('');
    return 2;
  }

  let exitCode = 0;
  try {
    switch (test) {
      case 'user': {
        const r = await runUserTest();
        exitCode = r.passed === r.total ? 0 : 1;
        break;
      }
      case 'auth:google': {
        if (!hasGoogleCreds()) {
          missing('Google');
          return 2;
        }
        const r = await runAuthTest('google');
        exitCode = r.passed ? 0 : 1;
        break;
      }
      case 'auth:microsoft': {
        if (!hasMicrosoftCreds()) {
          missing('Microsoft');
          return 2;
        }
        const r = await runAuthTest('microsoft');
        exitCode = r.passed ? 0 : 1;
        break;
      }
      case 'api:gmail': {
        const r = await runStandaloneApiTest('google');
        exitCode = r.passed === r.total ? 0 : 1;
        break;
      }
      case 'api:microsoft': {
        const r = await runStandaloneApiTest('microsoft');
        exitCode = r.passed === r.total ? 0 : 1;
        break;
      }
      case 'all': {
        let totalPassed = 0;
        let totalRun = 0;
        const u = await runUserTest();
        totalPassed += u.passed;
        totalRun += u.total;

        if (hasGoogleCreds()) {
          const g = await runAuthTest('google');
          totalPassed += g.passedAuth + g.passedApi;
          totalRun += g.totalAuth + g.totalApi;
        } else {
          console.log('');
          console.log(chalk.yellow('  ⚠ Skipping Google: VITE_GOOGLE_CLIENT_ID/SECRET not set'));
        }

        if (hasMicrosoftCreds()) {
          const m = await runAuthTest('microsoft');
          totalPassed += m.passedAuth + m.passedApi;
          totalRun += m.totalAuth + m.totalApi;
        } else {
          console.log('');
          console.log(chalk.yellow('  ⚠ Skipping Microsoft: VITE_MICROSOFT_CLIENT_ID not set'));
        }

        console.log('');
        console.log('  ' + chalk.dim('━'.repeat(45)));
        if (totalPassed === totalRun) {
          console.log(
            '  ' + chalk.green.bold(`OVERALL: ALL ${totalPassed}/${totalRun} TESTS PASSED ✓`)
          );
        } else {
          console.log(
            '  ' +
              chalk.red.bold(
                `OVERALL: ${totalPassed}/${totalRun} TESTS PASSED, ${totalRun - totalPassed} FAILED`
              )
          );
        }
        console.log('');
        exitCode = totalPassed === totalRun ? 0 : 1;
        break;
      }
    }
  } catch (e) {
    console.log('');
    console.log(chalk.red(`  Fatal: ${(e as Error).message}`));
    console.log('');
    exitCode = 1;
  }

  return exitCode;
}

function missing(provider: string) {
  console.log('');
  console.log(chalk.red(`  Missing ${provider} credentials in .env`));
  console.log(chalk.dim(`  Copy .env.example to .env and fill in:`));
  if (provider === 'Google') {
    console.log(chalk.dim('    VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_SECRET'));
  } else {
    console.log(chalk.dim('    VITE_MICROSOFT_CLIENT_ID'));
  }
  console.log(chalk.dim(`  See README.md for full step-by-step setup.`));
  console.log('');
}
