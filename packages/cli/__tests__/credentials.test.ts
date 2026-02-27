import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We need to mock homedir before importing the module
const MOCK_HOME = join(tmpdir(), 'vibariant-creds-test');

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => MOCK_HOME,
  };
});

// Import after mocking
const {
  loadCredentials,
  saveCredentials,
  clearCredentials,
  loadProject,
  saveProject,
  getConfigValue,
  setConfigValue,
} = await import('../src/lib/credentials.js');

beforeEach(() => {
  rmSync(MOCK_HOME, { recursive: true, force: true });
  mkdirSync(MOCK_HOME, { recursive: true });
});

afterEach(() => {
  rmSync(MOCK_HOME, { recursive: true, force: true });
});

describe('credentials', () => {
  it('returns null when no credentials exist', () => {
    expect(loadCredentials()).toBeNull();
  });

  it('saves and loads credentials', () => {
    const creds = {
      apiUrl: 'http://localhost:8000',
      accessToken: 'test-token',
      userId: 'user-123',
      email: 'test@example.com',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    saveCredentials(creds);
    const loaded = loadCredentials();
    expect(loaded).toEqual(creds);
  });

  it('returns null for expired credentials', () => {
    saveCredentials({
      apiUrl: 'http://localhost:8000',
      accessToken: 'expired-token',
      userId: 'user-123',
      email: 'test@example.com',
      expiresAt: Date.now() - 1000, // Already expired
    });

    expect(loadCredentials()).toBeNull();
  });

  it('clears credentials', () => {
    saveCredentials({
      apiUrl: 'http://localhost:8000',
      accessToken: 'test-token',
      userId: 'user-123',
      email: 'test@example.com',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    clearCredentials();
    expect(loadCredentials()).toBeNull();
  });
});

describe('project', () => {
  it('returns null when no project stored', () => {
    expect(loadProject()).toBeNull();
  });

  it('saves and loads project', () => {
    const project = {
      id: 'proj-123',
      name: 'Test Project',
      projectToken: 'vv_proj_test',
      apiKey: 'vv_sk_test',
    };

    saveProject(project);
    expect(loadProject()).toEqual(project);
  });
});

describe('config values', () => {
  it('gets and sets api_url', () => {
    setConfigValue('api_url', 'https://api.vibariant.com');
    expect(getConfigValue('api_url')).toBe('https://api.vibariant.com');
  });

  it('returns project_token from stored project', () => {
    saveProject({
      id: 'proj-123',
      name: 'Test',
      projectToken: 'vv_proj_abc',
      apiKey: 'vv_sk_abc',
    });
    expect(getConfigValue('project_token')).toBe('vv_proj_abc');
  });
});
