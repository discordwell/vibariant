import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';

const MCP_CONFIG = {
  vibariant: {
    command: 'npx',
    args: ['@vibariant/mcp'],
  },
};

export function registerMcpInstallCommand(program: Command): void {
  program
    .command('mcp')
    .description('Install Vibariant MCP server for Claude Code')
    .option('--global', 'Install globally in ~/.claude.json')
    .option('--project', 'Install in .claude/settings.json (default)')
    .action((opts) => {
      if (opts.global) {
        installGlobal();
      } else {
        installProject();
      }
    });
}

function installProject(): void {
  const settingsDir = join(process.cwd(), '.claude');
  const settingsFile = join(settingsDir, 'settings.json');

  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  let settings: Record<string, any> = {};
  if (existsSync(settingsFile)) {
    try {
      settings = JSON.parse(readFileSync(settingsFile, 'utf-8'));
    } catch {}
  }

  settings.mcpServers = settings.mcpServers ?? {};
  settings.mcpServers.vibariant = MCP_CONFIG.vibariant;

  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  console.log(chalk.green(`MCP server configured in ${settingsFile}`));
  console.log(chalk.dim('Restart Claude Code to pick up the new MCP server.'));
}

function installGlobal(): void {
  const claudeConfig = join(homedir(), '.claude.json');

  let settings: Record<string, any> = {};
  if (existsSync(claudeConfig)) {
    try {
      settings = JSON.parse(readFileSync(claudeConfig, 'utf-8'));
    } catch {}
  }

  settings.mcpServers = settings.mcpServers ?? {};
  settings.mcpServers.vibariant = MCP_CONFIG.vibariant;

  writeFileSync(claudeConfig, JSON.stringify(settings, null, 2) + '\n');
  console.log(chalk.green(`MCP server configured globally in ${claudeConfig}`));
  console.log(chalk.dim('Restart Claude Code to pick up the new MCP server.'));
}
