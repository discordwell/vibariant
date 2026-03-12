import { Command } from 'commander';
import chalk from 'chalk';
import { VibariantAPI } from '../lib/api.js';
import { authenticate } from '../lib/auth.js';
import { loadCredentials, clearCredentials, getApiUrl } from '../lib/credentials.js';
import { jsonOk, jsonError, EXIT } from '../lib/format.js';

export function registerAuthCommand(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Vibariant via magic link')
    .option('--email <email>', 'Email address')
    .option('--token <jwt>', 'Use an existing JWT token directly')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .option('--yes', 'Accept all defaults, skip prompts')
    .action(async (opts) => {
      const apiUrl = opts.apiUrl ?? getApiUrl();

      if (opts.token) {
        const api = new VibariantAPI(apiUrl, opts.token);
        const me = await api.me();
        const { saveCredentials } = await import('../lib/credentials.js');
        saveCredentials({
          apiUrl,
          accessToken: opts.token,
          userId: me.user_id,
          email: me.email,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        if (opts.json) {
          jsonOk({ email: me.email, apiUrl });
          return;
        }
        console.log(chalk.green(`Authenticated as ${chalk.cyan(me.email)}`));
        return;
      }

      if (!opts.email && (opts.yes || opts.json)) {
        const msg = 'Email is required in non-interactive mode. Use --email <email>';
        if (opts.json) {
          jsonError(msg);
        } else {
          process.stderr.write(chalk.red(msg) + '\n');
          process.exit(EXIT.ERROR);
        }
      }

      const email = opts.email ?? (await (await import('@inquirer/prompts')).input({ message: 'Email:' }));
      const api = new VibariantAPI(apiUrl);
      const creds = await authenticate(api, email, apiUrl);

      if (opts.json) {
        jsonOk({ email: creds.email, apiUrl });
      }
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      clearCredentials();
      if (opts.json) {
        jsonOk({ message: 'Logged out' });
        return;
      }
      console.log(chalk.green('Logged out.'));
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .option('--api-url <url>', 'API URL')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const creds = loadCredentials();
      if (!creds) {
        if (opts.json) {
          jsonOk({ authenticated: false });
          return;
        }
        console.log(chalk.yellow('Not authenticated. Run `vibariant auth login` to sign in.'));
        return;
      }

      let valid = false;
      try {
        const apiUrl = opts.apiUrl ?? creds.apiUrl;
        const api = new VibariantAPI(apiUrl, creds.accessToken);
        await api.me();
        valid = true;
      } catch {}

      if (opts.json) {
        jsonOk({
          authenticated: true,
          email: creds.email,
          apiUrl: creds.apiUrl,
          expiresAt: creds.expiresAt,
          valid,
        });
        return;
      }

      console.log(chalk.bold('Authenticated'));
      console.log(`  Email:   ${chalk.cyan(creds.email)}`);
      console.log(`  API:     ${creds.apiUrl}`);
      console.log(`  Expires: ${new Date(creds.expiresAt).toLocaleDateString()}`);
      console.log(`  Status:  ${valid ? chalk.green('valid') : chalk.red('expired — run `vibariant auth login`')}`);
    });
}
