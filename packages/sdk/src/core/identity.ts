import * as store from './store.js';

const VISITOR_KEY = 'visitor_id';
const SESSION_KEY = 'session_id';
const SESSION_TS_KEY = 'session_ts';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a random ID using crypto.getRandomValues.
 * Falls back to Math.random if crypto is unavailable (SSR).
 */
function generateId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Format as hex string with dashes like a UUID v4
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  } catch {
    // Fallback for environments without crypto (SSR)
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16),
    );
  }
}

/**
 * Resolve the visitor ID:
 *   1. If an override is provided, use it and persist it.
 *   2. If one exists in localStorage, reuse it.
 *   3. Otherwise, generate a new one and persist.
 */
export function resolveVisitorId(override?: string): string {
  if (override) {
    store.set(VISITOR_KEY, override);
    return override;
  }

  const existing = store.get(VISITOR_KEY);
  if (existing) return existing;

  const id = generateId();
  store.set(VISITOR_KEY, id);
  return id;
}

/**
 * Resolve the session ID:
 *   - Sessions live in sessionStorage.
 *   - A session expires after 30 minutes of inactivity.
 *   - Each call refreshes the last-active timestamp.
 */
export function resolveSessionId(): string {
  const existingId = store.get(SESSION_KEY, true);
  const lastTsRaw = store.get(SESSION_TS_KEY, true);
  const now = Date.now();

  if (existingId && lastTsRaw) {
    const lastTs = parseInt(lastTsRaw, 10);
    if (now - lastTs < SESSION_TIMEOUT_MS) {
      // Session still active — refresh timestamp
      store.set(SESSION_TS_KEY, String(now), true);
      return existingId;
    }
  }

  // New session
  const id = generateId();
  store.set(SESSION_KEY, id, true);
  store.set(SESSION_TS_KEY, String(now), true);
  return id;
}
