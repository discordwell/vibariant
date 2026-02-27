import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateIntegrationCode, writeGeneratedFiles } from '../src/lib/codegen.js';

const TEST_DIR = join(tmpdir(), 'vibariant-codegen-test');

function setup() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('generateIntegrationCode', () => {
  it('generates Next.js files', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'nextjs',
      isTypeScript: true,
      hasSrcDir: true,
      projectToken: 'vv_proj_test123',
      apiHost: 'http://localhost:8000',
    });

    expect(files.length).toBeGreaterThanOrEqual(2);
    const configFile = files.find((f) => f.path.includes('vibariant.config'));
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain('vv_proj_test123');
    expect(configFile!.content).toContain('http://localhost:8000');

    const providerFile = files.find((f) => f.path.includes('vibariant-provider'));
    expect(providerFile).toBeDefined();
    expect(providerFile!.content).toContain("'use client'");
    expect(providerFile!.content).toContain('VibariantProvider');
  });

  it('generates React files', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'react',
      isTypeScript: false,
      hasSrcDir: false,
      projectToken: 'vv_proj_abc',
      apiHost: 'https://api.vibariant.com',
    });

    const configFile = files.find((f) => f.path.includes('vibariant.config'));
    expect(configFile!.path).toMatch(/\.js$/);

    const providerFile = files.find((f) => f.path.includes('vibariant-provider'));
    expect(providerFile!.path).toMatch(/\.jsx$/);
  });

  it('generates vanilla JS files', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'vanilla',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_xyz',
      apiHost: 'http://localhost:8000',
    });

    const initFile = files.find((f) => f.path.includes('vibariant.ts'));
    expect(initFile).toBeDefined();
    expect(initFile!.content).toContain("from '@vibariant/sdk'");
  });

  it('generates example experiment component when key provided', () => {
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'nextjs',
      isTypeScript: true,
      hasSrcDir: true,
      projectToken: 'vv_proj_test',
      apiHost: 'http://localhost:8000',
      experimentKey: 'hero-headline',
      experimentVariants: ['control', 'bold', 'minimal'],
    });

    const example = files.find((f) => f.path.includes('example-experiment'));
    expect(example).toBeDefined();
    expect(example!.content).toContain("'hero-headline'");
    expect(example!.content).toContain("'control'");
    expect(example!.content).toContain("'bold'");
    expect(example!.content).toContain("'minimal'");
  });
});

describe('writeGeneratedFiles', () => {
  it('creates files on disk', () => {
    setup();
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'vanilla',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_test',
      apiHost: 'http://localhost:8000',
    });

    writeGeneratedFiles(files, true);

    for (const file of files) {
      expect(existsSync(file.path)).toBe(true);
      expect(readFileSync(file.path, 'utf-8')).toBe(file.content);
    }
  });

  it('skips existing files without --force', () => {
    setup();
    const files = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'vanilla',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_first',
      apiHost: 'http://localhost:8000',
    });

    // Write first time
    writeGeneratedFiles(files, true);

    // Regenerate with different token
    const files2 = generateIntegrationCode({
      cwd: TEST_DIR,
      framework: 'vanilla',
      isTypeScript: true,
      hasSrcDir: false,
      projectToken: 'vv_proj_second',
      apiHost: 'http://localhost:8000',
    });

    // Write without force — should skip
    writeGeneratedFiles(files2, false);

    // Should still have the first token
    const content = readFileSync(files[0].path, 'utf-8');
    expect(content).toContain('vv_proj_first');
  });
});
