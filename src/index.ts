#!/usr/bin/env node

import { program } from 'commander';
import inquirer from 'inquirer';
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt';
import chalk from 'chalk';
import { registerSetupCommand } from './commands/setup';
import { registerConfigCommand } from './commands/config';
import { registerCommitCommand } from './commands/commit';
import { registerAmendCommand } from './commands/amend';
import { registerRollbackCommand } from './commands/rollback';
import { registerBranchCommand } from './commands/branch';
import { registerRebaseHelperCommand } from './commands/rebaseHelper';
import { registerHistoryCommand } from './commands/history';
import { registerStatsCommand } from './commands/stats';

inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

program
  .name('sc')
  .description('Smart Commit CLI Tool - Create customizable Git commits with ease.')
  .version('1.2.2');

program.addHelpText('beforeAll', chalk.blue(`
========================================
 Welcome to Smart Commit CLI!
========================================
`));

program.addHelpText('afterAll', chalk.blue(`
Examples:
  sc commit        # Start interactive commit prompt
  sc amend         # Amend the last commit interactively
  sc rollback      # Rollback the last commit (soft or hard reset)
  sc rebase-helper # Launch interactive rebase helper
  sc branch        # Create a branch from a base + name template (with autocomplete)
  sc stats         # Show enhanced commit statistics
  sc history       # Show commit history with filtering
  sc config        # Configure or view settings
  sc setup         # Run interactive setup wizard
`));

registerConfigCommand(program);
registerSetupCommand(program);
registerCommitCommand(program);
registerAmendCommand(program);
registerRollbackCommand(program);
registerRebaseHelperCommand(program);
registerStatsCommand(program);
registerHistoryCommand(program);
registerBranchCommand(program);

program.parse(process.argv);