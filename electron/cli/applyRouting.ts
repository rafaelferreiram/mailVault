import chalk from 'chalk';
import { storage } from '../store.js';
import { keychain } from '../services/keychain.js';
import { GraphClient } from '../services/microsoft.js';
import { GmailClient } from '../services/gmail.js';
import { applyAccountRoutingRules } from '../services/routingRules.js';
import { loadOAuthEnv } from '../services/envConfig.js';
import { banner, section, summary, indent } from './output.js';

export async function runRoutingApply(email: string): Promise<{ ok: boolean }> {
  loadOAuthEnv();
  banner('Apply account routing rules');

  const normalized = email.trim().toLowerCase();
  const accountId =
    storage.listAccounts().find((a) => a.email.toLowerCase() === normalized)?.id ??
    (await keychain.listAccounts()).find((id) => id.split(':')[1]?.toLowerCase() === normalized);

  if (!accountId) {
    console.log(chalk.red(`  No linked account found for ${normalized}`));
    console.log(chalk.dim('  Connect the account in MailVault first.'));
    return { ok: false };
  }

  const tokens = await keychain.getTokens(accountId);
  if (!tokens) {
    console.log(chalk.red(`  No OAuth tokens for ${accountId} — re-authenticate in MailVault.`));
    return { ok: false };
  }

  section(`Account: ${accountId}`);
  const client =
    accountId.startsWith('google:')
      ? { kind: 'google' as const, gmail: new GmailClient(accountId) }
      : { kind: 'microsoft' as const, graph: new GraphClient(accountId) };

  const result = await applyAccountRoutingRules(accountId, normalized, client);

  console.log('');
  console.log(chalk.cyan('  Outlook/Gmail rules'));
  console.log(
    `    ${chalk.green('created')} ${result.rules.created}  ${chalk.dim('skipped')} ${result.rules.skipped}`
  );
  for (const err of result.rules.errors) {
    indent(chalk.red(err));
  }

  console.log('');
  console.log(chalk.cyan('  Historical mail moved'));
  console.log(
    `    ${chalk.green('moved')} ${result.moved}  ${chalk.yellow('already in folder')} ${result.skippedAlreadyInFolder}  ${chalk.red('failed')} ${result.failed}`
  );

  for (const row of result.byRule) {
    if (row.moved + row.failed + row.skipped === 0) continue;
    console.log(
      chalk.dim(
        `    · ${row.name}: moved ${row.moved}, skipped ${row.skipped}, failed ${row.failed}`
      )
    );
  }

  const ok = result.rules.errors.length === 0 || result.moved > 0 || result.rules.created > 0;
  summary(ok ? 1 : 0, 1);
  return { ok };
}
