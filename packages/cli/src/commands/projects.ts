import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl } from '../lib/credentials.js';
import { printTable, jsonOk, jsonError, EXIT } from '../lib/format.js';

export function registerProjectsCommand(program: Command): void {
  const projects = program.command('projects').description('Manage projects');

  projects
    .command('list')
    .description('List all projects')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const data = await api.listProjects();

      if (opts.json) {
        jsonOk(data);
        return;
      }

      if (data.length === 0) {
        console.log(chalk.dim('No projects found.'));
        return;
      }

      printTable(
        ['Name', 'ID', 'Project Token'],
        data.map((p) => [p.name, p.id, p.project_token]),
      );
    });

  projects
    .command('create')
    .description('Create a new project')
    .argument('<name>', 'Project name')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (name, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const project = await api.createProject(name);

      if (opts.json) {
        jsonOk(project);
        return;
      }

      console.log(chalk.green(`Created project "${project.name}"`));
      console.log(`  ID:            ${project.id}`);
      console.log(`  Project Token: ${chalk.cyan(project.project_token)}`);
      console.log(`  API Key:       ${chalk.dim(project.api_key)}`);
    });

  projects
    .command('show')
    .description('Show project details')
    .argument('<id>', 'Project ID')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const creds = requireAuth();
      const apiUrl = opts.apiUrl ?? getApiUrl();
      const api = new VibariantAPI(apiUrl, creds.accessToken);

      const projects = await api.listProjects();
      const project = projects.find((p) => p.id === id);

      if (!project) {
        if (opts.json) {
          jsonError(`Project ${id} not found`, EXIT.NOT_FOUND);
        } else {
          process.stderr.write(chalk.red(`Project ${id} not found.\n`));
          process.exit(EXIT.NOT_FOUND);
        }
      }

      if (opts.json) {
        jsonOk(project);
        return;
      }

      console.log(chalk.bold(project.name));
      console.log(`  ID:            ${project.id}`);
      console.log(`  Project Token: ${chalk.cyan(project.project_token)}`);
      console.log(`  API Key:       ${chalk.dim(project.api_key)}`);
    });
}
