import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../utils';

export function registerRollbackCommand(program: Command): void {
    program
        .command('rollback')
        .description('Rollback a commit with options. Soft reset keeps changes staged.')
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

            let targetCommit = 'HEAD~1';
            if (resetType === 'soft') {
                const { chooseSpecific } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'chooseSpecific',
                        message: 'Would you like to choose a specific commit for rollback? (Soft reset keeps changes staged)',
                        default: false,
                    }
                ]);
                if (chooseSpecific) {
                    let commitLog = '';
                    try {
                        commitLog = execSync('git log --oneline -n 10', { encoding: 'utf8' });
                    } catch (err: any) {
                        console.error(chalk.red("Error retrieving commit log:"), err.message);
                        process.exit(1);
                    }
                    const commits = commitLog.split('\n').filter(line => line.trim() !== '');
                    const commitChoices = commits.map(line => {
                        const tokens = line.split(' ');
                        const hash = tokens[0];
                        return { name: line, value: hash };
                    });
                    const { selectedCommit } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'selectedCommit',
                            message: 'Select the commit to rollback to:',
                            choices: commitChoices,
                        }
                    ]);
                    targetCommit = selectedCommit;
                } else {
                    console.log(chalk.yellow("Soft reset selected. Changes will remain staged."));
                }
            }

            const { confirmRollback } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmRollback',
                    message: `This will perform a ${resetType} reset to ${targetCommit}. Continue?`,
                    default: false,
                }
            ]);
            if (!confirmRollback) {
                console.log(chalk.yellow("Rollback cancelled."));
                process.exit(0);
            }
            try {
                if (resetType === 'soft') {
                    execSync(`git reset --soft ${targetCommit}`, { stdio: 'inherit' });
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