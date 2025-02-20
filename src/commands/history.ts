import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../utils';

export function registerHistoryCommand(program: Command): void {
    program
        .command('history')
        .description('Show commit history with search options')
        .action(async () => {
            ensureGitRepo();
            const { filterType } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'filterType',
                    message: 'Select search type:',
                    choices: [
                        { name: 'Search by keyword in commit message', value: 'keyword' },
                        { name: 'By author', value: 'author' },
                        { name: 'By date range', value: 'date' }
                    ],
                }
            ]);
            let command = 'git log --pretty=oneline';
            if (filterType === 'keyword') {
                const { keyword } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'keyword',
                        message: 'Enter keyword to search in commit messages:',
                    }
                ]);
                command += ` --grep="${keyword}"`;
            } else if (filterType === 'author') {
                const { author } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'author',
                        message: 'Enter author name or email:',
                    }
                ]);
                command += ` --author="${author}"`;
            } else if (filterType === 'date') {
                const { since, until } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'since',
                        message: 'Enter start date (YYYY-MM-DD):',
                    },
                    {
                        type: 'input',
                        name: 'until',
                        message: 'Enter end date (YYYY-MM-DD):',
                    }
                ]);
                command += ` --since="${since}" --until="${until}"`;
            }
            try {
                const history = execSync(command, { encoding: 'utf8' });
                console.log(chalk.blue("\nCommit History:\n"));
                console.log(chalk.green(history));
            } catch (err: any) {
                console.error(chalk.red("Error retrieving history:"), err.message);
                process.exit(1);
            }
        });
}