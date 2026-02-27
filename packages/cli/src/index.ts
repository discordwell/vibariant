import { Command } from 'commander';
import chalk from 'chalk';
import { registerInitCommand } from './commands/init.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerExperimentsCommand } from './commands/experiments.js';
import { registerGoalsCommand } from './commands/goals.js';
import { registerStatusCommand } from './commands/status.js';
import { registerConfigCommand } from './commands/config.js';
import { registerMcpInstallCommand } from './commands/mcp-install.js';

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
registerMcpInstallCommand(program);

program.parseAsync(process.argv).catch((err) => {
  if (err.name === 'ExitPromptError') {
    // User cancelled a prompt (Ctrl+C)
    process.exit(0);
  }
  console.error(chalk.red(err.message ?? err));
  process.exit(1);
});
