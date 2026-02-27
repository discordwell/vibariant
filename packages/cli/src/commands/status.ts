import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl, loadProject } from '../lib/credentials.js';
import { printTable, statusBadge } from '../lib/format.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show overview of running experiments')
    .option('--project-id <id>', 'Project ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const projectId = opts.projectId ?? loadProject()?.id;
      if (!projectId) {
        console.error(chalk.red('No project selected. Use --project-id or run `vibariant init` first.'));
        process.exit(1);
      }

      const experiments = await api.listExperiments(projectId);

      if (opts.json) {
        console.log(JSON.stringify(experiments, null, 2));
        return;
      }

      const running = experiments.filter((e) => e.status === 'running');
      const draft = experiments.filter((e) => e.status === 'draft');
      const completed = experiments.filter((e) => e.status === 'completed');

      console.log(chalk.bold('Vibariant Status'));
      console.log(`  Total experiments: ${experiments.length}`);
      console.log(`  Running: ${chalk.green(running.length.toString())}`);
      console.log(`  Draft: ${chalk.dim(draft.length.toString())}`);
      console.log(`  Completed: ${chalk.blue(completed.length.toString())}`);

      if (running.length > 0) {
        console.log('');
        console.log(chalk.bold('Running Experiments:'));
        printTable(
          ['Key', 'Name', 'Variants', 'Traffic'],
          running.map((e) => [
            e.key,
            e.name,
            e.variant_keys.join(', '),
            `${Math.round(e.traffic_percentage * 100)}%`,
          ]),
        );
      }

      if (experiments.length === 0) {
        console.log('');
        console.log(chalk.dim('No experiments yet. Create one with `vibariant experiments create`.'));
      }
    });
}
