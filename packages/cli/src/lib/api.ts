import { loadCredentials } from './credentials.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public detail: string,
  ) {
    super(`API ${statusCode}: ${detail}`);
    this.name = 'ApiError';
  }
}

export class VibariantAPI {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token ?? loadCredentials()?.accessToken ?? null;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      let detail = resp.statusText;
      try {
        const err = await resp.json();
        detail = err.detail ?? JSON.stringify(err);
      } catch {}
      throw new ApiError(resp.status, detail);
    }

    return resp.json() as Promise<T>;
  }

  // Health
  async health(): Promise<{ status: string }> {
    return this.request('GET', '/health');
  }

  // Auth
  async cliLogin(email: string): Promise<{
    device_code: string;
    expires_in: number;
    poll_interval: number;
    dev_token: string | null;
  }> {
    return this.request('POST', '/api/v1/auth/cli-login', { email });
  }

  async cliPoll(deviceCode: string): Promise<{
    status: 'pending' | 'authorized' | 'expired';
    access_token?: string;
    user_id?: string;
    email?: string;
  }> {
    return this.request('POST', '/api/v1/auth/cli-poll', { device_code: deviceCode });
  }

  async cliComplete(deviceCode: string, token: string): Promise<{ message: string }> {
    return this.request('POST', '/api/v1/auth/cli-complete', {
      device_code: deviceCode,
      token,
    });
  }

  async verify(token: string): Promise<{
    access_token: string;
    user_id: string;
    email: string;
  }> {
    return this.request('POST', '/api/v1/auth/verify', { token });
  }

  async me(): Promise<{ user_id: string; email: string; name: string | null }> {
    return this.request('GET', '/api/v1/auth/me');
  }

  // Projects
  async listProjects(): Promise<
    Array<{ id: string; name: string; project_token: string; api_key: string }>
  > {
    return this.request('GET', '/api/v1/projects');
  }

  async createProject(name: string): Promise<{
    id: string;
    name: string;
    project_token: string;
    api_key: string;
  }> {
    return this.request('POST', '/api/v1/projects', { name });
  }

  // Experiments
  async listExperiments(
    projectId: string,
  ): Promise<
    Array<{
      id: string;
      key: string;
      name: string;
      status: string;
      variant_keys: string[];
      traffic_percentage: number;
    }>
  > {
    return this.request('GET', `/api/v1/experiments?project_id=${projectId}`);
  }

  async createExperiment(data: {
    project_id: string;
    key: string;
    name: string;
    variant_keys: string[];
    traffic_percentage?: number;
  }): Promise<{
    id: string;
    key: string;
    name: string;
    status: string;
    variant_keys: string[];
  }> {
    return this.request('POST', '/api/v1/experiments', data);
  }

  async updateExperiment(
    id: string,
    data: { status?: string; name?: string },
  ): Promise<{ id: string; status: string; name: string }> {
    return this.request('PATCH', `/api/v1/experiments/${id}`, data);
  }

  async deleteExperiment(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/experiments/${id}`);
  }

  async getResults(experimentId: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/experiments/${experimentId}/results`);
  }

  // Goals
  async listGoals(
    projectId: string,
  ): Promise<
    Array<{ id: string; type: string; label: string; confirmed: boolean }>
  > {
    return this.request('GET', `/api/v1/goals?project_id=${projectId}`);
  }

  async confirmGoal(goalId: string): Promise<{ id: string; confirmed: boolean }> {
    return this.request('PATCH', `/api/v1/goals/${goalId}`, { confirmed: true });
  }
}
