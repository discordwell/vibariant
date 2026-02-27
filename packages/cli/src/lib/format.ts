import chalk from 'chalk';

/**
 * Print a data table to stdout.
 */
export function printTable(
  headers: string[],
  rows: string[][],
): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const separator = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerRow = headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│');

  console.log(chalk.bold(headerRow));
  console.log(separator);
  for (const row of rows) {
    const line = row.map((cell, i) => ` ${(cell ?? '').padEnd(widths[i])} `).join('│');
    console.log(line);
  }
}

/**
 * Print a boxed summary with key-value pairs.
 */
export function printSummary(title: string, entries: Array<[string, string]>): void {
  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
  const maxValLen = Math.max(...entries.map(([, v]) => v.length));
  const innerWidth = Math.max(title.length, maxKeyLen + maxValLen + 4) + 2;

  console.log('');
  console.log(chalk.green(`┌${'─'.repeat(innerWidth)}┐`));
  console.log(chalk.green(`│${chalk.bold(` ${title}`.padEnd(innerWidth))}│`));
  console.log(chalk.green(`├${'─'.repeat(innerWidth)}┤`));
  for (const [key, value] of entries) {
    const line = `  ${chalk.dim(key + ':')}  ${value}`;
    // Pad to inner width accounting for ANSI codes
    const plainLen = key.length + 3 + value.length + 2;
    const pad = Math.max(0, innerWidth - plainLen);
    console.log(chalk.green('│') + line + ' '.repeat(pad) + chalk.green('│'));
  }
  console.log(chalk.green(`└${'─'.repeat(innerWidth)}┘`));
  console.log('');
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'running':
      return chalk.green('● running');
    case 'draft':
      return chalk.dim('○ draft');
    case 'paused':
      return chalk.yellow('◐ paused');
    case 'completed':
      return chalk.blue('✓ completed');
    default:
      return status;
  }
}
