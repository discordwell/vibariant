import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl, loadProject } from '../lib/credentials.js';
import { printTable, statusBadge } from '../lib/format.js';

function resolveProjectId(opts: { projectId?: string }): string {
  const id = opts.projectId ?? loadProject()?.id;
  if (!id) {
    console.error(chalk.red('No project selected. Use --project-id or run `vibariant init` first.'));
    process.exit(1);
  }
  return id;
}

export function registerExperimentsCommand(program: Command): void {
  const experiments = program.command('experiments').description('Manage experiments');

  experiments
    .command('list')
    .description('List experiments')
    .option('--project-id <id>', 'Project ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);
      const projectId = resolveProjectId(opts);

      const data = await api.listExperiments(projectId);

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (data.length === 0) {
        console.log(chalk.dim('No experiments found.'));
        return;
      }

      printTable(
        ['Key', 'Name', 'Status', 'Variants', 'Traffic'],
        data.map((e) => [
          e.key,
          e.name,
          statusBadge(e.status),
          e.variant_keys.join(', '),
          `${Math.round(e.traffic_percentage * 100)}%`,
        ]),
      );
    });

  experiments
    .command('create')
    .description('Create a new experiment')
    .option('--project-id <id>', 'Project ID')
    .option('--key <key>', 'Experiment key (e.g., hero-headline)')
    .option('--name <name>', 'Display name')
    .option('--variants <variants>', 'Comma-separated variant keys (default: control,variant)')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);
      const projectId = resolveProjectId(opts);

      const key = opts.key ?? (await promptForKey());
      const name = opts.name ?? key;
      const variants = opts.variants?.split(',').map((v: string) => v.trim()) ?? ['control', 'variant'];

      const exp = await api.createExperiment({
        project_id: projectId,
        key,
        name,
        variant_keys: variants,
      });

      if (opts.json) {
        console.log(JSON.stringify(exp, null, 2));
        return;
      }

      console.log(chalk.green(`Created experiment "${exp.name}"`));
      console.log(`  ID:       ${exp.id}`);
      console.log(`  Key:      ${chalk.cyan(exp.key)}`);
      console.log(`  Variants: ${exp.variant_keys.join(', ')}`);
      console.log(`  Status:   ${statusBadge(exp.status)}`);
    });

  experiments
    .command('update')
    .description('Update an experiment')
    .argument('<id>', 'Experiment ID')
    .option('--status <status>', 'New status: draft|running|paused|completed')
    .option('--name <name>', 'New name')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const updates: Record<string, string> = {};
      if (opts.status) updates.status = opts.status;
      if (opts.name) updates.name = opts.name;

      const exp = await api.updateExperiment(id, updates);

      if (opts.json) {
        console.log(JSON.stringify(exp, null, 2));
        return;
      }

      console.log(chalk.green(`Updated experiment "${exp.name}"`));
      console.log(`  Status: ${statusBadge(exp.status)}`);
    });

  experiments
    .command('delete')
    .description('Delete an experiment')
    .argument('<id>', 'Experiment ID')
    .option('--api-url <url>', 'API URL')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      await api.deleteExperiment(id);
      console.log(chalk.green('Experiment deleted.'));
    });

  experiments
    .command('results')
    .description('Get experiment results')
    .argument('<id>', 'Experiment ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const results = await api.getResults(id);

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Pretty-print results
      const r = results as Record<string, any>;
      console.log(chalk.bold(`Results: ${r.experiment_name ?? id}`));
      console.log(`  Decision: ${chalk.cyan(r.decision_status ?? 'unknown')}`);

      if (r.variants) {
        console.log('');
        printTable(
          ['Variant', 'Visitors', 'Conversions', 'Rate', 'Posterior Mean'],
          (r.variants as any[]).map((v: any) => [
            v.variant_key,
            String(v.visitors ?? 0),
            String(v.conversions ?? 0),
            v.conversion_rate != null ? `${(v.conversion_rate * 100).toFixed(1)}%` : '-',
            v.posterior_mean != null ? v.posterior_mean.toFixed(4) : '-',
          ]),
        );
      }

      if (r.recommendation) {
        console.log('');
        console.log(chalk.bold('Recommendation:'));
        console.log(`  ${r.recommendation}`);
      }
    });
}

async function promptForKey(): Promise<string> {
  const { input } = await import('@inquirer/prompts');
  return input({ message: 'Experiment key (e.g., hero-headline):' });
}
