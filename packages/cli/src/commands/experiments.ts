import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl, loadProject } from '../lib/credentials.js';
import { printTable, statusBadge, jsonOk, jsonError, EXIT } from '../lib/format.js';

function resolveProjectId(opts: { projectId?: string }): string {
  const id = opts.projectId ?? loadProject()?.id;
  if (!id) {
    process.stderr.write(chalk.red('No project selected. Use --project-id or run `vibariant init` first.\n'));
    process.exit(EXIT.ERROR);
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
        jsonOk(data);
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
    .option('--yes', 'Accept all defaults, skip prompts')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);
      const projectId = resolveProjectId(opts);

      if (!opts.key && (opts.yes || opts.json)) {
        const msg = 'Experiment key is required in non-interactive mode. Use --key <key>';
        if (opts.json) {
          jsonError(msg);
        } else {
          process.stderr.write(chalk.red(msg) + '\n');
          process.exit(EXIT.ERROR);
        }
      }

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
        jsonOk(exp);
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
        jsonOk(exp);
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
    .option('--json', 'Output as JSON')
    .option('--yes', 'Skip confirmation')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      if (!opts.yes && !opts.json) {
        const { confirm } = await import('@inquirer/prompts');
        const confirmed = await confirm({ message: `Delete experiment ${id}?`, default: false });
        if (!confirmed) {
          console.log(chalk.dim('Cancelled.'));
          return;
        }
      }

      await api.deleteExperiment(id);

      if (opts.json) {
        jsonOk({ deleted: true, id });
        return;
      }
      console.log(chalk.green('Experiment deleted.'));
    });

  experiments
    .command('show')
    .description('Show experiment details with current stats')
    .argument('<id>', 'Experiment ID or key')
    .option('--project-id <id>', 'Project ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);
      const projectId = resolveProjectId(opts);

      const experiments = await api.listExperiments(projectId);
      const exp = experiments.find((e) => e.id === id || e.key === id);

      if (!exp) {
        if (opts.json) {
          jsonError(`Experiment "${id}" not found`, EXIT.NOT_FOUND);
        } else {
          process.stderr.write(chalk.red(`Experiment "${id}" not found\n`));
          process.exit(EXIT.NOT_FOUND);
        }
      }

      let results: Record<string, any> | null = null;
      if (exp.status === 'running' || exp.status === 'completed') {
        try {
          results = await api.getResults(exp.id) as Record<string, any>;
        } catch {}
      }

      if (opts.json) {
        jsonOk({ experiment: exp, results });
        return;
      }

      console.log(chalk.bold(exp.name));
      console.log(`  ID:       ${exp.id}`);
      console.log(`  Key:      ${chalk.cyan(exp.key)}`);
      console.log(`  Status:   ${statusBadge(exp.status)}`);
      console.log(`  Variants: ${exp.variant_keys.join(', ')}`);
      console.log(`  Traffic:  ${Math.round(exp.traffic_percentage * 100)}%`);

      if (results?.variants) {
        console.log('');
        console.log(chalk.bold('Results:'));
        console.log(`  Decision: ${chalk.cyan(results.decision_status ?? 'unknown')}`);
        printTable(
          ['Variant', 'Visitors', 'Conversions', 'Rate', 'Posterior Mean'],
          (results.variants as any[]).map((v: any) => [
            v.variant_key,
            String(v.visitors ?? 0),
            String(v.conversions ?? 0),
            v.conversion_rate != null ? `${(v.conversion_rate * 100).toFixed(1)}%` : '-',
            v.posterior_mean != null ? v.posterior_mean.toFixed(4) : '-',
          ]),
        );
        if (results.recommendation) {
          console.log('');
          console.log(chalk.bold('Recommendation:'));
          console.log(`  ${results.recommendation}`);
        }
      }
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
        jsonOk(results);
        return;
      }

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
