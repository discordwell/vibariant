import { Command } from 'commander';
import chalk from 'chalk';
import { requireAuth } from '../lib/auth.js';
import { getApiUrl, loadProject } from '../lib/credentials.js';
import { detectEnvironment } from '../lib/detect.js';
import { generateIntegrationCode, writeGeneratedFiles } from '../lib/codegen.js';
import { jsonOk, jsonError, EXIT } from '../lib/format.js';
import type { Framework } from '../lib/detect.js';

function resolveProjectToken(): string {
  const token = loadProject()?.projectToken;
  if (!token) {
    process.stderr.write(chalk.red('No project selected. Run `vibariant init` first.\n'));
    process.exit(EXIT.ERROR);
  }
  return token;
}

export function registerCodegenCommand(program: Command): void {
  program
    .command('codegen')
    .description('Generate SDK integration code for your framework')
    .option('--framework <framework>', 'Framework: next, react, or vanilla')
    .option('--experiment-key <key>', 'Include example experiment component')
    .option('--variants <variants>', 'Comma-separated variant keys for example (default: control,variant)')
    .option('--output-dir <dir>', 'Output directory (default: cwd)')
    .option('--force', 'Overwrite existing files')
    .option('--json', 'Output as JSON instead of writing files')
    .option('--yes', 'Accept all defaults, skip prompts')
    .action(async (opts) => {
      requireAuth();
      const apiUrl = getApiUrl();
      const projectToken = resolveProjectToken();
      const env = detectEnvironment();

      // Determine framework
      let framework: Framework;
      if (opts.framework) {
        const map: Record<string, Framework> = { next: 'nextjs', nextjs: 'nextjs', react: 'react', vanilla: 'vanilla' };
        framework = map[opts.framework];
        if (!framework) {
          const msg = `Unknown framework "${opts.framework}". Use: next, react, or vanilla`;
          if (opts.json) {
            jsonError(msg);
          } else {
            process.stderr.write(chalk.red(msg) + '\n');
            process.exit(EXIT.ERROR);
          }
        }
      } else {
        framework = env.framework;
      }

      const cwd = opts.outputDir ?? process.cwd();
      const variants = opts.variants?.split(',').map((v: string) => v.trim());

      const files = generateIntegrationCode({
        cwd,
        framework,
        isTypeScript: env.isTypeScript,
        hasSrcDir: env.hasSrcDir,
        projectToken,
        apiHost: apiUrl,
        experimentKey: opts.experimentKey,
        experimentVariants: variants,
      });

      if (opts.json) {
        jsonOk({ files: files.map((f) => ({ path: f.path, content: f.content })) });
        return;
      }

      const written = writeGeneratedFiles(files, opts.force ?? false);

      if (written.length === 0) {
        console.log(chalk.yellow('No files written (all exist already). Use --force to overwrite.'));
      } else {
        console.log(chalk.green(`\nGenerated ${written.length} file(s)`));
      }
    });
}
