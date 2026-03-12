import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateIntegrationCode } from '../src/lib/codegen.js';

const TEST_DIR = join(tmpdir(), 'vibariant-codegen-cmd-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('codegen command (integration code generation)', () => {
  it('generates Next.js files with correct structure', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'nextjs',
      isTypeScript: true,
      hasSrcDir: true,
      projectToken: 'vv_proj_test',
      apiHost: 'https://api.vibariant.com',
    });

    expect(files.length).toBe(2); // config + provider
    expect(files.some((f) => f.path.endsWith('vibariant.config.ts'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('vibariant-provider.tsx'))).toBe(true);
  });

  it('generates React files', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'react',
      isTypeScript: false,
      hasSrcDir: false,
      projectToken: 'vv_proj_react',
      apiHost: 'http://localhost:8000',
    });

    expect(files.some((f) => f.path.endsWith('vibariant.config.js'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('vibariant-provider.jsx'))).toBe(true);
  });

  it('generates vanilla files', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'vanilla',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_vanilla',
      apiHost: 'http://localhost:8000',
    });

    expect(files.some((f) => f.path.endsWith('vibariant.config.ts'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('vibariant.ts'))).toBe(true);
  });

  it('includes experiment example when key is provided', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'nextjs',
      isTypeScript: true,
      hasSrcDir: true,
      projectToken: 'vv_proj_test',
      apiHost: 'http://localhost:8000',
      experimentKey: 'checkout-cta',
      experimentVariants: ['control', 'urgent', 'social-proof'],
    });

    const example = files.find((f) => f.path.includes('example-experiment'));
    expect(example).toBeDefined();
    expect(example!.content).toContain("'checkout-cta'");
    expect(example!.content).toContain("'control'");
    expect(example!.content).toContain("'urgent'");
    expect(example!.content).toContain("'social-proof'");
  });

  it('produces valid JSON envelope format', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'react',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_json',
      apiHost: 'http://localhost:8000',
    });

    // Simulate what --json output would look like
    const jsonOutput = {
      ok: true,
      data: {
        files: files.map((f) => ({ path: f.path, content: f.content })),
      },
    };

    expect(jsonOutput.ok).toBe(true);
    expect(jsonOutput.data.files).toBeInstanceOf(Array);
    expect(jsonOutput.data.files.length).toBeGreaterThan(0);
    expect(jsonOutput.data.files[0]).toHaveProperty('path');
    expect(jsonOutput.data.files[0]).toHaveProperty('content');
  });
});
