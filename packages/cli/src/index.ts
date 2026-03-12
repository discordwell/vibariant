import { Command } from 'commander';
import chalk from 'chalk';
import { registerInitCommand } from './commands/init.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerExperimentsCommand } from './commands/experiments.js';
import { registerGoalsCommand } from './commands/goals.js';
import { registerStatusCommand } from './commands/status.js';
import { registerConfigCommand } from './commands/config.js';
import { registerCodegenCommand } from './commands/codegen.js';

const program = new Command();

program
  .name('vibariant')
  .description('CLI for Vibariant AB testing')
  .version('0.1.0');

registerInitCommand(program);
registerAuthCommand(program);
registerProjectsCommand(program);
registerExperimentsCommand(program);
registerGoalsCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);
registerCodegenCommand(program);

// Detect --json anywhere in argv for error formatting
const isJsonMode = process.argv.includes('--json');

program.parseAsync(process.argv).catch((err) => {
  if (err.name === 'ExitPromptError') {
    process.exit(0);
  }
  const message = err.message ?? String(err);
  if (isJsonMode) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(chalk.red(message));
  }
  process.exit(1);
});
