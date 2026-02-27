import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectEnvironment, getInstallCommand } from '../src/lib/detect.js';

const TEST_DIR = join(tmpdir(), 'vibariant-detect-test');

function setup(files: Record<string, string> = {}) {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const p = join(TEST_DIR, name);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content);
  }
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('detectEnvironment', () => {
  it('detects Next.js with TypeScript', () => {
    setup({
      'package.json': JSON.stringify({ dependencies: { next: '15.0.0', react: '19.0.0' } }),
      'next.config.ts': 'export default {}',
      'tsconfig.json': '{}',
    });
    mkdirSync(join(TEST_DIR, 'src'));

    const env = detectEnvironment(TEST_DIR);
    expect(env.framework).toBe('nextjs');
    expect(env.isTypeScript).toBe(true);
    expect(env.hasSrcDir).toBe(true);
    expect(env.hasPackageJson).toBe(true);
  });

  it('detects React (non-Next)', () => {
    setup({
      'package.json': JSON.stringify({ dependencies: { react: '18.0.0', 'react-dom': '18.0.0' } }),
      'vite.config.ts': 'export default {}',
      'tsconfig.json': '{}',
    });

    const env = detectEnvironment(TEST_DIR);
    expect(env.framework).toBe('react');
    expect(env.isTypeScript).toBe(true);
  });

  it('detects vanilla JS', () => {
    setup({
      'package.json': JSON.stringify({ dependencies: { express: '4.0.0' } }),
    });

    const env = detectEnvironment(TEST_DIR);
    expect(env.framework).toBe('vanilla');
    expect(env.isTypeScript).toBe(false);
  });

  it('detects no package.json', () => {
    setup({});
    const env = detectEnvironment(TEST_DIR);
    expect(env.hasPackageJson).toBe(false);
    expect(env.framework).toBe('vanilla');
  });

  it('detects @vibariant/sdk already installed', () => {
    setup({
      'package.json': JSON.stringify({ dependencies: { '@vibariant/sdk': '0.1.0' } }),
    });

    const env = detectEnvironment(TEST_DIR);
    expect(env.hasVibariantSdk).toBe(true);
  });

  it('detects npm as default package manager', () => {
    setup({ 'package.json': '{}' });
    const env = detectEnvironment(TEST_DIR);
    expect(env.packageManager).toBe('npm');
  });

  it('detects pnpm by lockfile', () => {
    setup({ 'package.json': '{}', 'pnpm-lock.yaml': '' });
    const env = detectEnvironment(TEST_DIR);
    expect(env.packageManager).toBe('pnpm');
  });

  it('detects yarn by lockfile', () => {
    setup({ 'package.json': '{}', 'yarn.lock': '' });
    const env = detectEnvironment(TEST_DIR);
    expect(env.packageManager).toBe('yarn');
  });

  it('detects bun by lockfile', () => {
    setup({ 'package.json': '{}', 'bun.lockb': '' });
    const env = detectEnvironment(TEST_DIR);
    expect(env.packageManager).toBe('bun');
  });
});

describe('getInstallCommand', () => {
  it('returns npm install command', () => {
    expect(getInstallCommand('npm', '@vibariant/sdk')).toEqual(['npm', 'install', '@vibariant/sdk']);
  });

  it('returns pnpm add command', () => {
    expect(getInstallCommand('pnpm', '@vibariant/sdk')).toEqual(['pnpm', 'add', '@vibariant/sdk']);
  });

  it('returns yarn add command', () => {
    expect(getInstallCommand('yarn', '@vibariant/sdk')).toEqual(['yarn', 'add', '@vibariant/sdk']);
  });

  it('returns bun add command', () => {
    expect(getInstallCommand('bun', '@vibariant/sdk')).toEqual(['bun', 'add', '@vibariant/sdk']);
  });
});
