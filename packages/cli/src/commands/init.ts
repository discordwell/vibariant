import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { input, select, confirm } from '@inquirer/prompts';
import { execa } from 'execa';
import { VibariantAPI } from '../lib/api.js';
import { authenticate, requireAuth } from '../lib/auth.js';
import { loadCredentials, saveProject, getApiUrl } from '../lib/credentials.js';
import { detectEnvironment, getInstallCommand } from '../lib/detect.js';
import { isApiReachable, isDockerAvailable, startBackend } from '../lib/docker.js';
import { generateIntegrationCode, writeGeneratedFiles, printSetupInstructions } from '../lib/codegen.js';
import { printSummary } from '../lib/format.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('One-click setup: backend + auth + SDK + first experiment')
    .option('--api-url <url>', 'API URL (default: http://localhost:8000)')
    .option('--email <email>', 'Email for authentication')
    .option('--project-name <name>', 'Project name')
    .option('--experiment <key>', 'Create an experiment with this key')
    .option('--variants <variants>', 'Comma-separated variant keys (default: control,variant)')
    .option('--skip-docker', 'Skip Docker backend setup')
    .option('--skip-install', 'Skip SDK installation')
    .option('--skip-experiment', 'Skip experiment creation')
    .option('--force', 'Overwrite existing files')
    .option('--yes', 'Accept all defaults')
    .action(async (opts) => {
      console.log('');
      console.log(chalk.bold('Vibariant Setup'));
      console.log(chalk.dim('One-click AB testing for your app'));
      console.log('');

      let apiUrl = opts.apiUrl ?? 'http://localhost:8000';

      // ─────────────────────────────────────────────────
      // Step 1: Backend
      // ─────────────────────────────────────────────────
      if (!opts.skipDocker) {
        const spinner = ora('Checking API...').start();
        const reachable = await isApiReachable(apiUrl);

        if (reachable) {
          spinner.succeed(`API reachable at ${chalk.cyan(apiUrl)}`);
        } else {
          spinner.warn(`API not reachable at ${apiUrl}`);

          const hasDocker = await isDockerAvailable();
          if (hasDocker) {
            const shouldStart =
              opts.yes || (await confirm({ message: 'Start local backend with Docker?', default: true }));

            if (shouldStart) {
              await startBackend(apiUrl);
            } else {
              console.log(chalk.dim('Skipping backend setup.'));
            }
          } else {
            console.log(chalk.yellow('Docker not found. Options:'));
            console.log('  1. Install Docker: https://docs.docker.com/get-docker/');
            console.log('  2. Use hosted API: vibariant init --api-url https://api.vibariant.com');
            console.log('');

            if (!opts.yes) {
              apiUrl = await input({
                message: 'API URL:',
                default: 'https://api.vibariant.com',
              });
            }
          }
        }
      }

      // ─────────────────────────────────────────────────
      // Step 2: Authentication
      // ─────────────────────────────────────────────────
      let creds = loadCredentials();
      if (!creds) {
        const email = opts.email ?? (await input({ message: 'Email:' }));
        const api = new VibariantAPI(apiUrl);
        creds = await authenticate(api, email, apiUrl);
      } else {
        console.log(chalk.green(`Already authenticated as ${chalk.cyan(creds.email)}`));
      }

      const api = new VibariantAPI(apiUrl, creds.accessToken);

      // ─────────────────────────────────────────────────
      // Step 3: Project
      // ─────────────────────────────────────────────────
      const projects = await api.listProjects();
      let selectedProject: (typeof projects)[0];

      if (opts.projectName) {
        const existing = projects.find((p) => p.name === opts.projectName);
        if (existing) {
          selectedProject = existing;
        } else {
          selectedProject = await api.createProject(opts.projectName);
          console.log(chalk.green(`Created project "${selectedProject.name}"`));
        }
      } else if (projects.length === 1) {
        selectedProject = projects[0];
        console.log(chalk.green(`Using project "${selectedProject.name}"`));
      } else if (projects.length > 1) {
        if (opts.yes) {
          selectedProject = projects[0];
        } else {
          const choice = await select({
            message: 'Select a project:',
            choices: [
              ...projects.map((p) => ({ name: p.name, value: p.id })),
              { name: '+ Create new project', value: '__new__' },
            ],
          });

          if (choice === '__new__') {
            const name = await input({ message: 'Project name:' });
            selectedProject = await api.createProject(name);
            console.log(chalk.green(`Created project "${selectedProject.name}"`));
          } else {
            selectedProject = projects.find((p) => p.id === choice)!;
          }
        }
      } else {
        // No projects (shouldn't happen since signup auto-creates one)
        const name = opts.projectName ?? 'My Project';
        selectedProject = await api.createProject(name);
        console.log(chalk.green(`Created project "${selectedProject.name}"`));
      }

      saveProject({
        id: selectedProject.id,
        name: selectedProject.name,
        projectToken: selectedProject.project_token,
        apiKey: selectedProject.api_key,
      });

      // ─────────────────────────────────────────────────
      // Step 4: SDK Installation
      // ─────────────────────────────────────────────────
      const env = detectEnvironment();

      if (!opts.skipInstall && env.hasPackageJson) {
        if (env.hasVibariantSdk) {
          console.log(chalk.green('@vibariant/sdk already installed'));
        } else {
          const spinner = ora('Installing @vibariant/sdk...').start();
          const cmd = getInstallCommand(env.packageManager, '@vibariant/sdk');
          try {
            await execa(cmd[0], cmd.slice(1), { timeout: 60_000 });
            spinner.succeed('Installed @vibariant/sdk');
          } catch (err) {
            spinner.fail('Failed to install SDK');
            console.error(chalk.dim(String(err)));
          }
        }
      }

      // ─────────────────────────────────────────────────
      // Step 5: Generate Integration Code
      // ─────────────────────────────────────────────────
      if (env.hasPackageJson) {
        console.log('');
        console.log(chalk.bold('Generating integration code...'));

        const files = generateIntegrationCode({
          cwd: process.cwd(),
          framework: env.framework,
          isTypeScript: env.isTypeScript,
          hasSrcDir: env.hasSrcDir,
          projectToken: selectedProject.project_token,
          apiHost: apiUrl,
        });

        writeGeneratedFiles(files, opts.force);
        printSetupInstructions(env.framework);
      }

      // ─────────────────────────────────────────────────
      // Step 6: First Experiment
      // ─────────────────────────────────────────────────
      let experimentKey: string | undefined;
      let experimentVariants: string[] | undefined;

      if (!opts.skipExperiment) {
        const shouldCreate = opts.experiment
          ? true
          : opts.yes
            ? false
            : await confirm({ message: 'Create your first experiment?', default: true });

        if (shouldCreate) {
          const key =
            opts.experiment ??
            (await input({ message: 'Experiment key (e.g., hero-headline):', default: 'hero-headline' }));
          const name = key
            .split('-')
            .map((w: string) => w[0].toUpperCase() + w.slice(1))
            .join(' ');
          const variants = opts.variants?.split(',').map((v: string) => v.trim()) ?? ['control', 'variant'];

          try {
            const exp = await api.createExperiment({
              project_id: selectedProject.id,
              key,
              name,
              variant_keys: variants,
            });

            // Start it immediately
            await api.updateExperiment(exp.id, { status: 'running' });
            console.log(chalk.green(`Experiment "${key}" created and running`));

            experimentKey = key;
            experimentVariants = variants;

            // Regenerate code with experiment info
            if (env.hasPackageJson) {
              const files = generateIntegrationCode({
                cwd: process.cwd(),
                framework: env.framework,
                isTypeScript: env.isTypeScript,
                hasSrcDir: env.hasSrcDir,
                projectToken: selectedProject.project_token,
                apiHost: apiUrl,
                experimentKey: key,
                experimentVariants: variants,
              });
              // Only write the example experiment file
              const exampleFile = files.find((f) => f.path.includes('example-experiment'));
              if (exampleFile) {
                writeGeneratedFiles([exampleFile], opts.force);
              }
            }
          } catch (err: any) {
            if (err?.statusCode === 409 || err?.detail?.includes('already exists')) {
              console.log(chalk.yellow(`Experiment "${key}" already exists.`));
            } else {
              throw err;
            }
          }
        }
      }

      // ─────────────────────────────────────────────────
      // Step 7: Summary
      // ─────────────────────────────────────────────────
      const entries: Array<[string, string]> = [
        ['Backend', chalk.cyan(apiUrl)],
        ['Project', selectedProject.name],
        ['Token', chalk.dim(selectedProject.project_token)],
      ];

      if (experimentKey) {
        entries.push(['Experiment', `${experimentKey} (running)`]);
      }

      entries.push(['Framework', env.framework]);

      printSummary('Vibariant is ready!', entries);

      console.log(chalk.bold('Next steps:'));
      if (env.framework !== 'vanilla') {
        console.log('  1. Add VibariantWrapper to your root layout');
        console.log('  2. Use useVariant() in your components');
      }
      console.log(`  ${env.framework === 'vanilla' ? '1' : '3'}. Run your app and visit the dashboard`);
      console.log(`  ${env.framework === 'vanilla' ? '2' : '4'}. Check results: ${chalk.dim('vibariant status')}`);
      console.log('');
    });
}
