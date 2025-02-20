import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../utils';

export function registerRollbackCommand(program: Command): void {
    program
        .command('rollback')
        .description('Rollback the last commit while choosing between soft and hard reset')
        .action(async () => {
            ensureGitRepo();
            const { resetType } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'resetType',
                    message: 'Choose rollback type:',
                    choices: [
                        { name: 'Soft reset (keep changes staged)', value: 'soft' },
                        { name: 'Hard reset (discard changes)', value: 'hard' }
                    ],
                }
            ]);
            const { confirmRollback } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmRollback',
                    message: `This will perform a ${resetType} reset on the last commit. Continue?`,
                    default: false,
                }
            ]);
            if (!confirmRollback) {
                console.log(chalk.yellow("Rollback cancelled."));
                process.exit(0);
            }
            try {
                if (resetType === 'soft') {
                    execSync('git reset --soft HEAD~1', { stdio: 'inherit' });
                } else {
                    execSync('git reset --hard HEAD~1', { stdio: 'inherit' });
                }
                console.log(chalk.green("Rollback successful!"));
            } catch (err: any) {
                console.error(chalk.red("Error during rollback:"), err.message);
                process.exit(1);
            }
        });
}