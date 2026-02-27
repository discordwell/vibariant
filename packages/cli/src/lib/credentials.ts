import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface StoredCredentials {
  apiUrl: string;
  accessToken: string;
  userId: string;
  email: string;
  expiresAt: number; // Unix timestamp (ms)
}

export interface StoredProject {
  id: string;
  name: string;
  projectToken: string;
  apiKey: string;
}

export interface VibariantConfig {
  credentials?: StoredCredentials;
  project?: StoredProject;
  defaultApiUrl?: string;
}

const CONFIG_DIR = join(homedir(), '.vibariant');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig(): VibariantConfig {
  ensureDir();
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(config: VibariantConfig): void {
  ensureDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function loadCredentials(): StoredCredentials | null {
  const config = readConfig();
  if (!config.credentials) return null;
  // Check if token is expired (with 1-day buffer)
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (config.credentials.expiresAt < Date.now() + oneDayMs) {
    return null; // Expired or about to expire
  }
  return config.credentials;
}

export function saveCredentials(creds: StoredCredentials): void {
  const config = readConfig();
  config.credentials = creds;
  writeConfig(config);
}

export function clearCredentials(): void {
  const config = readConfig();
  delete config.credentials;
  writeConfig(config);
}

export function loadProject(): StoredProject | null {
  const config = readConfig();
  return config.project ?? null;
}

export function saveProject(project: StoredProject): void {
  const config = readConfig();
  config.project = project;
  writeConfig(config);
}

export function getApiUrl(): string {
  const config = readConfig();
  return config.credentials?.apiUrl ?? config.defaultApiUrl ?? 'http://localhost:8000';
}

export function setConfigValue(key: string, value: string): void {
  const config = readConfig();
  if (key === 'api_url') {
    config.defaultApiUrl = value;
  }
  writeConfig(config);
}

export function getConfigValue(key: string): string | undefined {
  const config = readConfig();
  if (key === 'api_url') return config.defaultApiUrl;
  if (key === 'project_id') return config.project?.id;
  if (key === 'project_token') return config.project?.projectToken;
  if (key === 'email') return config.credentials?.email;
  return undefined;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
