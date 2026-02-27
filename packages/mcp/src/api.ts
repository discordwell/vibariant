import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface StoredConfig {
  credentials?: {
    apiUrl: string;
    accessToken: string;
    userId: string;
    email: string;
    expiresAt: number;
  };
  project?: {
    id: string;
    name: string;
    projectToken: string;
    apiKey: string;
  };
  defaultApiUrl?: string;
}

function loadConfig(): StoredConfig {
  const configPath = join(homedir(), '.vibariant', 'config.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

export function getCredentials(): { apiUrl: string; token: string } | null {
  const config = loadConfig();
  if (!config.credentials) return null;
  // Match CLI behavior: reject if expires within 1 day
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (config.credentials.expiresAt < Date.now() + oneDayMs) return null;
  return {
    apiUrl: config.credentials.apiUrl,
    token: config.credentials.accessToken,
  };
}

export function getDefaultProject(): { id: string; name: string; projectToken: string } | null {
  const config = loadConfig();
  if (!config.project) return null;
  return config.project;
}

export class VibariantAPI {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      let detail = resp.statusText;
      try {
        const err = await resp.json();
        detail = err.detail ?? JSON.stringify(err);
      } catch {}
      throw new Error(`API ${resp.status}: ${detail}`);
    }

    return resp.json() as Promise<T>;
  }

  async me() {
    return this.request<{ user_id: string; email: string; name: string | null }>('GET', '/api/v1/auth/me');
  }

  async listProjects() {
    return this.request<Array<{ id: string; name: string; project_token: string; api_key: string }>>(
      'GET',
      '/api/v1/projects',
    );
  }

  async createProject(name: string) {
    return this.request<{ id: string; name: string; project_token: string; api_key: string }>(
      'POST',
      '/api/v1/projects',
      { name },
    );
  }

  async listExperiments(projectId: string) {
    return this.request<
      Array<{
        id: string;
        key: string;
        name: string;
        status: string;
        variant_keys: string[];
        traffic_percentage: number;
      }>
    >('GET', `/api/v1/experiments?project_id=${projectId}`);
  }

  async createExperiment(data: {
    project_id: string;
    key: string;
    name: string;
    variant_keys: string[];
    traffic_percentage?: number;
  }) {
    return this.request<{ id: string; key: string; name: string; status: string; variant_keys: string[] }>(
      'POST',
      '/api/v1/experiments',
      data,
    );
  }

  async updateExperiment(id: string, data: { status?: string; name?: string }) {
    return this.request<{ id: string; status: string; name: string }>('PATCH', `/api/v1/experiments/${id}`, data);
  }

  async getResults(experimentId: string) {
    return this.request<Record<string, unknown>>('GET', `/api/v1/experiments/${experimentId}/results`);
  }
}
