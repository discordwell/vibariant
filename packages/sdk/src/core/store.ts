/**
 * localStorage / sessionStorage abstraction with SSR safety.
 * All operations are wrapped in try/catch to handle:
 *   - SSR environments (no window/localStorage)
 *   - Private browsing restrictions
 *   - Storage quota exceeded
 */

const PREFIX = 'vv_';

function getStorage(session: boolean): Storage | null {
  try {
    const storage = session ? window.sessionStorage : window.localStorage;
    // Verify storage is actually usable (Safari private mode throws on setItem)
    const testKey = `${PREFIX}__test__`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

export function get(key: string, session = false): string | null {
  const storage = getStorage(session);
  if (!storage) return null;
  try {
    return storage.getItem(`${PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function set(key: string, value: string, session = false): void {
  const storage = getStorage(session);
  if (!storage) return;
  try {
    storage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // Storage full or restricted — silently fail
  }
}

export function remove(key: string, session = false): void {
  const storage = getStorage(session);
  if (!storage) return;
  try {
    storage.removeItem(`${PREFIX}${key}`);
  } catch {
    // Silently fail
  }
}

export function getJSON<T>(key: string, session = false): T | null {
  const raw = get(key, session);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJSON(key: string, value: unknown, session = false): void {
  try {
    set(key, JSON.stringify(value), session);
  } catch {
    // JSON serialization failed — silently fail
  }
}
