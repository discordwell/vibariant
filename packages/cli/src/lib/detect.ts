import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Framework = 'nextjs' | 'react' | 'vanilla';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface EnvironmentInfo {
  hasPackageJson: boolean;
  packageManager: PackageManager;
  framework: Framework;
  isTypeScript: boolean;
  hasSrcDir: boolean;
  hasVibariantSdk: boolean;
}

export function detectEnvironment(cwd: string = process.cwd()): EnvironmentInfo {
  const hasPackageJson = existsSync(join(cwd, 'package.json'));
  const packageManager = detectPackageManager(cwd);
  const framework = detectFramework(cwd);
  const isTypeScript = existsSync(join(cwd, 'tsconfig.json'));
  const hasSrcDir = existsSync(join(cwd, 'src'));
  const hasVibariantSdk = hasPackageJson && hasDependency(cwd, '@vibariant/sdk');

  return { hasPackageJson, packageManager, framework, isTypeScript, hasSrcDir, hasVibariantSdk };
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectFramework(cwd: string): Framework {
  // Next.js
  const nextConfigs = ['next.config.ts', 'next.config.js', 'next.config.mjs'];
  if (nextConfigs.some((f) => existsSync(join(cwd, f)))) return 'nextjs';

  // React (with Vite or CRA)
  if (hasDependency(cwd, 'react') || hasDependency(cwd, 'react-dom')) return 'react';

  return 'vanilla';
}

function hasDependency(cwd: string, name: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
    return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
  } catch {
    return false;
  }
}

export function getInstallCommand(pm: PackageManager, pkg: string): string[] {
  switch (pm) {
    case 'bun':
      return ['bun', 'add', pkg];
    case 'pnpm':
      return ['pnpm', 'add', pkg];
    case 'yarn':
      return ['yarn', 'add', pkg];
    default:
      return ['npm', 'install', pkg];
  }
}
