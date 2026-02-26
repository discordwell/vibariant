import { getToken, logout } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const API_PREFIX = "/api/v1";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

interface ApiError {
  detail: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private loggingOut = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (!skipAuth) {
      const token = getToken();
      if (token) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== "GET") {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (response.status === 401) {
      if (!this.loggingOut) {
        this.loggingOut = true;
        logout();
      }
      throw { detail: "Session expired", status: 401 } as ApiError;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "An unknown error occurred",
      }));
      throw { detail: error.detail || response.statusText, status: response.status } as ApiError;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Auth endpoints
  // ---------------------------------------------------------------------------

  async loginWithGithub(code: string) {
    return this.request<AuthResponse>(`${API_PREFIX}/auth/github`, {
      method: "POST",
      body: { code },
      skipAuth: true,
    });
  }

  async sendMagicLink(email: string) {
    return this.request<MessageResponse>(`${API_PREFIX}/auth/magic-link`, {
      method: "POST",
      body: { email },
      skipAuth: true,
    });
  }

  async verifyMagicLink(token: string) {
    return this.request<AuthResponse>(`${API_PREFIX}/auth/verify`, {
      method: "POST",
      body: { token },
      skipAuth: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Project endpoints (JWT auth)
  // ---------------------------------------------------------------------------

  async getProjects() {
    return this.request<Project[]>(`${API_PREFIX}/projects`);
  }

  // ---------------------------------------------------------------------------
  // Experiment endpoints (JWT auth)
  // ---------------------------------------------------------------------------

  async getExperiments(projectId: string) {
    return this.request<Experiment[]>(
      `${API_PREFIX}/experiments?project_id=${encodeURIComponent(projectId)}`
    );
  }

  async getExperiment(id: string) {
    return this.request<Experiment>(`${API_PREFIX}/experiments/${id}`);
  }

  async createExperiment(data: CreateExperimentPayload) {
    return this.request<Experiment>(`${API_PREFIX}/experiments`, {
      method: "POST",
      body: data,
    });
  }

  async updateExperiment(id: string, data: UpdateExperimentPayload) {
    return this.request<Experiment>(`${API_PREFIX}/experiments/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  async deleteExperiment(id: string) {
    return this.request(`${API_PREFIX}/experiments/${id}`, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // Stats endpoints (JWT auth)
  // ---------------------------------------------------------------------------

  async getExperimentResults(experimentId: string) {
    return this.request<ExperimentResults>(
      `${API_PREFIX}/experiments/${experimentId}/results`
    );
  }

  // ---------------------------------------------------------------------------
  // Goal endpoints
  // ---------------------------------------------------------------------------

  async getGoals(projectId: string) {
    return this.request<Goal[]>(
      `${API_PREFIX}/goals?project_id=${encodeURIComponent(projectId)}`
    );
  }

  async updateGoal(id: string, data: GoalUpdate) {
    return this.request<Goal>(`${API_PREFIX}/goals/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  /** Confirm a detected goal (convenience wrapper around updateGoal). */
  async confirmGoal(id: string) {
    return this.updateGoal(id, { confirmed: true });
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async healthCheck() {
    return this.request<{ status: string }>("/health", { skipAuth: true });
  }

  // ---------------------------------------------------------------------------
  // TODO: Endpoints not yet implemented on the backend
  // ---------------------------------------------------------------------------

  // TODO: updateProject — PATCH /api/v1/projects/{id}
  // TODO: getApiKeys — GET /api/v1/api-keys
  // TODO: createApiKey — POST /api/v1/api-keys
  // TODO: revokeApiKey — DELETE /api/v1/api-keys/{id}
}

// ---------------------------------------------------------------------------
// Types — aligned with backend Pydantic response models
// ---------------------------------------------------------------------------

/** Matches AuthResponse in auth.py */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

/** Matches MessageResponse in auth.py */
export interface MessageResponse {
  message: string;
}

/** Matches ProjectOut in projects.py */
export interface Project {
  id: string;
  name: string;
  project_token: string;
  api_key: string;
}

/**
 * Matches ExperimentOut in experiments.py.
 *
 * API fields: id, project_id, key, name, status, variant_keys,
 * traffic_percentage. Fields new to the API are marked optional so
 * existing dashboard mock data (which predates the API) still compiles.
 * They will be made required once pages are updated.
 */
export interface Experiment {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  // --- API fields (optional until pages are migrated) ---
  project_id?: string;
  key?: string;
  variant_keys?: string[];
  traffic_percentage?: number;
  // --- Legacy fields used by dashboard mock data (not in API response) ---
  /** @deprecated Not in API — dashboard mock data only */
  variants?: { id: string; name: string; weight: number; visitor_count: number; conversion_rate?: number }[];
  /** @deprecated Not in API — dashboard mock data only */
  visitor_count?: number;
  /** @deprecated Not in API — dashboard mock data only */
  created_at?: string;
  /** @deprecated Not in API — dashboard mock data only */
  updated_at?: string;
}

/** Payload for POST /api/v1/experiments — matches ExperimentCreate in experiments.py */
export interface CreateExperimentPayload {
  project_id: string;
  key: string;
  name: string;
  variant_keys?: string[];
  traffic_percentage?: number;
}

/** Payload for PATCH /api/v1/experiments/{id} — matches ExperimentUpdate in experiments.py */
export interface UpdateExperimentPayload {
  name?: string;
  status?: "draft" | "running" | "paused" | "completed";
  variant_keys?: string[];
  traffic_percentage?: number;
}

/**
 * Matches GoalOut in goals.py.
 *
 * API fields: id, project_id, type, label, trigger, confidence, confirmed.
 * Fields new to the API are marked optional so existing dashboard mock data
 * still compiles. They will be made required once pages are updated.
 */
export interface Goal {
  id: string;
  type: string;
  confirmed: boolean;
  // --- API fields (optional until pages are migrated) ---
  project_id?: string;
  label?: string;
  trigger?: Record<string, unknown> | null;
  confidence?: number | null;
  // --- Legacy fields used by dashboard mock data (not in API response) ---
  /** @deprecated Use `label` — dashboard mock data only */
  name?: string;
  /** @deprecated Use `trigger` — dashboard mock data only */
  selector?: string;
  /** @deprecated Use `trigger` — dashboard mock data only */
  url_pattern?: string;
  /** @deprecated Not in API — dashboard mock data only */
  auto_detected?: boolean;
  /** @deprecated Not in API — dashboard mock data only */
  event_count?: number;
  /** @deprecated Not in API — dashboard mock data only */
  created_at?: string;
}

/** Payload for PATCH /api/v1/goals/{id} — matches GoalUpdate in goals.py */
export interface GoalUpdate {
  label?: string;
  confirmed?: boolean;
  trigger?: Record<string, unknown> | null;
}

/**
 * Matches VariantResult in stats.py.
 *
 * API fields: variant_key, visitors, conversions, conversion_rate,
 * posterior_mean, credible_interval, engagement_score.
 *
 * Legacy fields (variant_id, variant_name, improvement_over_control,
 * probability_of_being_best) are kept temporarily so dashboard mock data
 * compiles. They will be removed when pages are updated.
 */
export interface VariantResult {
  // --- API fields (from stats.py VariantResult) ---
  variant_key?: string;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  posterior_mean?: number;
  credible_interval: [number, number];
  engagement_score?: number | null;
  // --- Legacy fields used by dashboard mock data (not in API response) ---
  /** @deprecated Use `variant_key` — dashboard mock data only */
  variant_id?: string;
  /** @deprecated Not in API — dashboard mock data only */
  variant_name?: string;
  /** @deprecated Not in API — dashboard mock data only */
  improvement_over_control?: number | null;
  /** @deprecated Not in API — dashboard mock data only */
  probability_of_being_best?: number;
}

/** Matches ExperimentResults in stats.py */
export interface ExperimentResults {
  experiment_id: string;
  experiment_key: string;
  total_visitors: number;
  variants: VariantResult[];
  probability_b_beats_a: number | null;
  probability_best: number[] | null;
  expected_loss: Record<string, number> | null;
  recommendation: string | null;
  suggested_allocation: Record<string, number> | null;
  engagement_comparison: {
    means: Record<string, number> | null;
    differences: Record<string, number> | null;
    summary: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Legacy type aliases — kept for backward compatibility with dashboard pages
// that import these types for mock data. These do NOT correspond to real API
// endpoints and will be removed once the dashboard pages are updated.
// ---------------------------------------------------------------------------

/** @deprecated Use Experiment + ExperimentResults separately */
export interface ExperimentDetail extends Experiment {
  /** @deprecated Legacy mock field */
  visitor_count: number;
  /** @deprecated Legacy mock field */
  variants: { id: string; name: string; weight: number; visitor_count: number; conversion_rate?: number }[];
  goal_id?: string;
  goal_name?: string;
  results?: VariantResult[];
  recommendation?: string;
  confidence?: number;
  days_running?: number;
  created_at: string;
  updated_at: string;
}

/** @deprecated No backend endpoint exists yet */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

/** @deprecated No backend endpoint exists yet */
export interface DashboardOverview {
  active_experiments: number;
  total_visitors: number;
  total_events: number;
  recent_events: RecentEvent[];
  top_experiments: Experiment[];
}

/** @deprecated No backend endpoint exists yet */
export interface RecentEvent {
  id: string;
  type: string;
  experiment_name: string;
  variant_name: string;
  timestamp: string;
}

export const api = new ApiClient(API_BASE_URL);
