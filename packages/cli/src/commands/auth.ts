import { Command } from 'commander';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { VibariantAPI } from '../lib/api.js';
import { authenticate } from '../lib/auth.js';
import { loadCredentials, clearCredentials, getApiUrl } from '../lib/credentials.js';

export function registerAuthCommand(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Vibariant via magic link')
    .option('--email <email>', 'Email address')
    .option('--token <jwt>', 'Use an existing JWT token directly')
    .option('--api-url <url>', 'API URL')
    .action(async (opts) => {
      const apiUrl = opts.apiUrl ?? getApiUrl();

      if (opts.token) {
        // Direct token mode
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
        console.log(chalk.green(`Authenticated as ${chalk.cyan(me.email)}`));
        return;
      }

      const email = opts.email ?? (await input({ message: 'Email:' }));
      const api = new VibariantAPI(apiUrl);
      await authenticate(api, email, apiUrl);
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      clearCredentials();
      console.log(chalk.green('Logged out.'));
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .option('--api-url <url>', 'API URL')
    .action(async (opts) => {
      const creds = loadCredentials();
      if (!creds) {
        console.log(chalk.yellow('Not authenticated. Run `vibariant auth login` to sign in.'));
        return;
      }

      console.log(chalk.bold('Authenticated'));
      console.log(`  Email:   ${chalk.cyan(creds.email)}`);
      console.log(`  API:     ${creds.apiUrl}`);
      console.log(`  Expires: ${new Date(creds.expiresAt).toLocaleDateString()}`);

      // Verify token is still valid
      try {
        const apiUrl = opts.apiUrl ?? creds.apiUrl;
        const api = new VibariantAPI(apiUrl, creds.accessToken);
        await api.me();
        console.log(`  Status:  ${chalk.green('valid')}`);
      } catch {
        console.log(`  Status:  ${chalk.red('expired — run `vibariant auth login`')}`);
      }
    });
}
