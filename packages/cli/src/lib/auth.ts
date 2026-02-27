import ora from 'ora';
import chalk from 'chalk';
import { VibariantAPI } from './api.js';
import { loadCredentials, saveCredentials, type StoredCredentials } from './credentials.js';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Run the device-code auth flow. Returns credentials on success.
 *
 * In dev mode (local backend with default SECRET_KEY), auto-completes instantly.
 * In prod mode, polls until the user clicks the magic link from email.
 */
export async function authenticate(
  api: VibariantAPI,
  email: string,
  apiUrl: string,
): Promise<StoredCredentials> {
  // Check existing credentials first
  const existing = loadCredentials();
  if (existing && existing.email === email && existing.apiUrl === apiUrl) {
    return existing;
  }

  const spinner = ora('Starting authentication...').start();

  const loginResp = await api.cliLogin(email);
  const { device_code, dev_token } = loginResp;

  // Dev mode: auto-complete with dev_token
  if (dev_token) {
    spinner.text = 'Dev mode detected, auto-verifying...';
    await api.cliComplete(device_code, dev_token);

    const pollResp = await api.cliPoll(device_code);
    if (pollResp.status !== 'authorized' || !pollResp.access_token) {
      spinner.fail('Auto-verification failed');
      throw new Error('CLI auth failed after dev-mode completion');
    }

    const creds: StoredCredentials = {
      apiUrl,
      accessToken: pollResp.access_token,
      userId: pollResp.user_id!,
      email: pollResp.email!,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    saveCredentials(creds);
    spinner.succeed(`Authenticated as ${chalk.cyan(email)}`);
    return creds;
  }

  // Prod mode: poll for magic link verification
  spinner.info('Check your email for a verification link.');
  const pollSpinner = ora('Waiting for email verification...').start();

  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const pollResp = await api.cliPoll(device_code);
    if (pollResp.status === 'authorized' && pollResp.access_token) {
      const creds: StoredCredentials = {
        apiUrl,
        accessToken: pollResp.access_token,
        userId: pollResp.user_id!,
        email: pollResp.email!,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      saveCredentials(creds);
      pollSpinner.succeed(`Authenticated as ${chalk.cyan(email)}`);
      return creds;
    }

    if (pollResp.status === 'expired') {
      pollSpinner.fail('Verification expired. Run `vibariant auth login` to try again.');
      throw new Error('CLI auth expired');
    }
  }

  pollSpinner.fail('Verification timed out (5 minutes). Run `vibariant auth login` to retry.');
  throw new Error('CLI auth timed out');
}

/**
 * Ensure we have valid credentials, or throw.
 */
export function requireAuth(): StoredCredentials {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not authenticated. Run `vibariant auth login` first.');
  }
  return creds;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
