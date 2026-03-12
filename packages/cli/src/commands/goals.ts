import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl, loadProject } from '../lib/credentials.js';
import { printTable, jsonOk, EXIT } from '../lib/format.js';

function resolveProjectId(opts: { projectId?: string }): string {
  const id = opts.projectId ?? loadProject()?.id;
  if (!id) {
    process.stderr.write(chalk.red('No project selected. Use --project-id or run `vibariant init` first.\n'));
    process.exit(EXIT.ERROR);
  }
  return id;
}

export function registerGoalsCommand(program: Command): void {
  const goals = program.command('goals').description('Manage goals');

  goals
    .command('list')
    .description('List detected goals')
    .option('--project-id <id>', 'Project ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);
      const projectId = resolveProjectId(opts);

      const data = await api.listGoals(projectId);

      if (opts.json) {
        jsonOk(data);
        return;
      }

      if (data.length === 0) {
        console.log(chalk.dim('No goals detected yet.'));
        return;
      }

      printTable(
        ['Type', 'Label', 'Confirmed', 'ID'],
        data.map((g) => [
          g.type,
          g.label,
          g.confirmed ? chalk.green('yes') : chalk.dim('no'),
          g.id,
        ]),
      );
    });

  goals
    .command('confirm')
    .description('Confirm a detected goal')
    .argument('<id>', 'Goal ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const goal = await api.confirmGoal(id);

      if (opts.json) {
        jsonOk(goal);
        return;
      }

      console.log(chalk.green(`Goal confirmed: ${goal.id}`));
    });
}
