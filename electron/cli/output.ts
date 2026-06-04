import chalk from 'chalk';

const HR = '─'.repeat(45);

export function banner(title: string) {
  console.log('');
  console.log(chalk.cyan.bold('  MailVault CLI Test Runner'));
  console.log('  ' + chalk.dim(HR));
  console.log('  ' + chalk.bold(title));
  console.log('');
}

export function section(title: string) {
  console.log('  ' + chalk.dim(HR));
  console.log('  ' + chalk.bold(title));
}

export function summary(passed: number, total: number) {
  const ok = passed === total;
  console.log('');
  console.log('  ' + chalk.dim(HR));
  if (ok) {
    console.log('  ' + chalk.green.bold(`ALL TESTS PASSED (${passed}/${total}) ✓`));
  } else {
    console.log('  ' + chalk.red.bold(`${total - passed} TEST${total - passed === 1 ? '' : 'S'} FAILED (${passed}/${total})`));
  }
  console.log('');
}

export function info(line: string) {
  console.log('  ' + chalk.dim(line));
}

export function indent(line: string) {
  console.log('        ' + chalk.dim('→ ') + line);
}

export function warn(line: string) {
  console.log('  ' + chalk.yellow('! ') + line);
}

export function error(line: string) {
  console.log('  ' + chalk.red('✗ ') + line);
}

/** Truncate a long string for display (preserves head, ellipsis, length). */
export function trunc(s: string, head = 14): string {
  if (s.length <= head + 3) return s;
  return s.slice(0, head) + '…';
}

/** Tracks "[i/N]" step counters and prints colored status icons. */
export class StepTracker {
  private current = 0;
  constructor(public readonly total: number) {}

  /**
   * Run a labeled async step. Prints success or failure automatically. Returns the
   * value the function returned, or rethrows on error after printing the failure.
   */
  async run<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
    this.current += 1;
    const idx = this.current;
    const prefix = chalk.dim(`[${idx}/${this.total}]`);
    process.stdout.write(`  ${prefix} ${chalk.yellow('⏳')} ${label}…`);
    try {
      const v = await fn();
      process.stdout.write('\r');
      console.log(`  ${prefix} ${chalk.green('✓')} ${label}`);
      return v;
    } catch (e) {
      process.stdout.write('\r');
      console.log(`  ${prefix} ${chalk.red('✗')} ${label}`);
      console.log('        ' + chalk.red('→ ') + (e as Error).message);
      throw e;
    }
  }

  /** Print a "static" successful step (used when we already know the outcome). */
  ok(label: string) {
    this.current += 1;
    const prefix = chalk.dim(`[${this.current}/${this.total}]`);
    console.log(`  ${prefix} ${chalk.green('✓')} ${label}`);
  }

  /** Print a "in progress" line that will be overwritten by the next ok/fail. */
  pending(label: string) {
    this.current += 1;
    const prefix = chalk.dim(`[${this.current}/${this.total}]`);
    console.log(`  ${prefix} ${chalk.yellow('⏳')} ${label}`);
    return prefix;
  }
}
