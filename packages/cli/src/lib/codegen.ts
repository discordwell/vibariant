import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import type { Framework } from './detect.js';

interface CodegenOptions {
  cwd: string;
  framework: Framework;
  isTypeScript: boolean;
  hasSrcDir: boolean;
  projectToken: string;
  apiHost: string;
  experimentKey?: string;
  experimentVariants?: string[];
}

interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export function generateIntegrationCode(opts: CodegenOptions): GeneratedFile[] {
  const ext = opts.isTypeScript ? 'ts' : 'js';
  const tsx = opts.isTypeScript ? 'tsx' : 'jsx';
  const files: GeneratedFile[] = [];

  // Config file (all frameworks)
  files.push({
    path: join(opts.cwd, `vibariant.config.${ext}`),
    content: configTemplate(opts.projectToken, opts.apiHost),
    description: 'Vibariant configuration',
  });

  // Framework-specific provider
  switch (opts.framework) {
    case 'nextjs':
      files.push({
        path: join(opts.cwd, opts.hasSrcDir ? 'src' : '', 'components', `vibariant-provider.${tsx}`),
        content: nextjsProviderTemplate(ext),
        description: 'Vibariant provider (Next.js)',
      });
      break;
    case 'react':
      files.push({
        path: join(opts.cwd, opts.hasSrcDir ? 'src' : '', `vibariant-provider.${tsx}`),
        content: reactProviderTemplate(ext),
        description: 'Vibariant provider (React)',
      });
      break;
    case 'vanilla':
      files.push({
        path: join(opts.cwd, `vibariant.${ext}`),
        content: vanillaTemplate(ext),
        description: 'Vibariant initialization',
      });
      break;
  }

  // Example usage if experiment was created
  if (opts.experimentKey && opts.experimentVariants && opts.framework !== 'vanilla') {
    files.push({
      path: join(
        opts.cwd,
        opts.hasSrcDir ? 'src' : '',
        opts.framework === 'nextjs' ? 'components' : '',
        `example-experiment.${tsx}`,
      ),
      content: experimentExampleTemplate(opts.experimentKey, opts.experimentVariants, opts.isTypeScript),
      description: 'Example experiment component',
    });
  }

  return files;
}

export function writeGeneratedFiles(files: GeneratedFile[], force: boolean = false): string[] {
  const written: string[] = [];
  for (const file of files) {
    if (existsSync(file.path) && !force) {
      console.log(chalk.yellow(`  skip: ${file.path} (already exists, use --force to overwrite)`));
      continue;
    }
    // Ensure parent dir exists
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content);
    console.log(chalk.green(`  created: ${file.path}`));
    written.push(file.path);
  }
  return written;
}

export function printSetupInstructions(framework: Framework): void {
  console.log('');
  switch (framework) {
    case 'nextjs':
      console.log(chalk.bold('Add to your root layout:'));
      console.log('');
      console.log(chalk.dim("  import { VibariantWrapper } from '@/components/vibariant-provider';"));
      console.log('');
      console.log(chalk.dim('  // Wrap your {children} with:'));
      console.log(chalk.dim('  <VibariantWrapper>{children}</VibariantWrapper>'));
      break;
    case 'react':
      console.log(chalk.bold('Add to your entry file (main.tsx or App.tsx):'));
      console.log('');
      console.log(chalk.dim("  import { VibariantWrapper } from './vibariant-provider';"));
      console.log('');
      console.log(chalk.dim('  // Wrap your app:'));
      console.log(chalk.dim('  <VibariantWrapper><App /></VibariantWrapper>'));
      break;
    case 'vanilla':
      console.log(chalk.bold('Import in your entry file:'));
      console.log('');
      console.log(chalk.dim("  import './vibariant';"));
      break;
  }
  console.log('');
}

// Templates

function configTemplate(projectToken: string, apiHost: string): string {
  return `export const vibariantConfig = {
  projectToken: '${projectToken}',
  apiHost: '${apiHost}',
};
`;
}

function nextjsProviderTemplate(ext: string): string {
  const typing = ext === 'ts' ? ': { children: React.ReactNode }' : '';
  return `'use client';

import { VibariantProvider } from '@vibariant/sdk/react';
import { vibariantConfig } from '${ext === 'ts' ? '@/' : '../'}vibariant.config';

export function VibariantWrapper({ children }${typing}) {
  return (
    <VibariantProvider config={vibariantConfig}>
      {children}
    </VibariantProvider>
  );
}
`;
}

function reactProviderTemplate(ext: string): string {
  const typing = ext === 'ts' ? ': { children: React.ReactNode }' : '';
  return `import { VibariantProvider } from '@vibariant/sdk/react';
import { vibariantConfig } from './vibariant.config';

export function VibariantWrapper({ children }${typing}) {
  return (
    <VibariantProvider config={vibariantConfig}>
      {children}
    </VibariantProvider>
  );
}
`;
}

function vanillaTemplate(ext: string): string {
  return `import { Vibariant } from '@vibariant/sdk';
import { vibariantConfig } from './vibariant.config';

export const vibariant = new Vibariant(vibariantConfig);

vibariant.init().then(() => {
  console.log('Vibariant initialized');
});
`;
}

function experimentExampleTemplate(key: string, variants: string[], isTs: boolean): string {
  const v0 = variants[0] ?? 'control';
  const v1 = variants[1] ?? 'variant';
  return `'use client';

import { useVariant } from '@vibariant/sdk/react';

export function ExampleExperiment() {
  const { variant } = useVariant('${key}', [${variants.map((v) => `'${v}'`).join(', ')}]);

  if (variant === '${v0}') {
    return <div>Control version</div>;
  }

  return <div>Variant: {variant}</div>;
}
`;
}
