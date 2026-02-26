const TOKEN_KEY = "vibevariant_token";
const USER_KEY = "vibevariant_user";
const PROJECT_KEY = "vibevariant_project";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PROJECT_KEY);
}

export interface StoredProject {
  id: string;
  name: string;
  project_token: string;
  api_key: string;
}

export function getProject(): StoredProject | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredProject;
  } catch {
    return null;
  }
}

export function setProject(project: StoredProject): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function getProjectId(): string | null {
  return getProject()?.id ?? null;
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  // Check if JWT is expired by decoding the payload
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // convert to ms
    return Date.now() < exp;
  } catch {
    // If we can't decode the token, assume it's valid
    // and let the API reject it if not
    return true;
  }
}

export function logout(): void {
  removeToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
