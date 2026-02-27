import { Command } from 'commander';
import chalk from 'chalk';
import { getConfigValue, setConfigValue } from '../lib/credentials.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Manage CLI configuration');

  config
    .command('get')
    .description('Get a config value')
    .argument('<key>', 'Config key (api_url, project_id, project_token, email)')
    .action((key) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.dim('(not set)'));
      } else {
        console.log(value);
      }
    });

  config
    .command('set')
    .description('Set a config value')
    .argument('<key>', 'Config key (api_url)')
    .argument('<value>', 'Config value')
    .action((key, value) => {
      setConfigValue(key, value);
      console.log(chalk.green(`Set ${key} = ${value}`));
    });
}
