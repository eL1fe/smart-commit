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
            const { filterType, viewMode } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'filterType',
                    message: 'Select search type:',
                    choices: [
                        { name: 'Search by keyword in commit message', value: 'keyword' },
                        { name: 'By author', value: 'author' },
                        { name: 'By date range', value: 'date' }
                    ],
                },
                {
                    type: 'list',
                    name: 'viewMode',
                    message: 'Select view mode:',
                    choices: [
                        { name: 'Only current branch commits', value: 'current' },
                        { name: 'Include merged commits', value: 'merged' }
                    ],
                }
            ]);

            let baseCommand = 'git log --pretty=oneline';

            if (viewMode === 'current') {
                const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
                baseCommand = `git log --pretty=oneline ${currentBranch} --not $(git for-each-ref --format='%(refname)' refs/heads/ | grep -v "refs/heads/${currentBranch}")`;
            }

            if (filterType === 'keyword') {
                const { keyword } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'keyword',
                        message: 'Enter keyword to search in commit messages:',
                    }
                ]);
                baseCommand += ` --grep="${keyword}"`;
            } else if (filterType === 'author') {
                const { author } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'author',
                        message: 'Enter author name or email:',
                    }
                ]);
                baseCommand += ` --author="${author}"`;
            } else if (filterType === 'date') {
                const { since, until } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'since',
                        message: 'Enter start date (YYYY-MM-DD):',
                        validate: (input: string) => /^\d{4}-\d{2}-\d{2}$/.test(input)
                            ? true
                            : 'Please enter date in YYYY-MM-DD format',
                    },
                    {
                        type: 'input',
                        name: 'until',
                        message: 'Enter end date (YYYY-MM-DD):',
                        validate: (input: string) => /^\d{4}-\d{2}-\d{2}$/.test(input)
                            ? true
                            : 'Please enter date in YYYY-MM-DD format',
                    }
                ]);
                baseCommand += ` --since="${since}" --until="${until}"`;
            }

            const { limit } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'limit',
                    message: 'Enter number of commits per page (default 20):',
                    default: '20',
                    validate: (input: string) =>
                        /^\d+$/.test(input) && parseInt(input, 10) > 0
                            ? true
                            : 'Please enter a positive integer',
                }
            ]);
            const perPage = parseInt(limit, 10);

            let skip = 0;
            while (true) {
                const paginatedCommand = `${baseCommand} --max-count=${perPage} --skip=${skip}`;
                let historyOutput = '';
                try {
                    historyOutput = execSync(paginatedCommand, { encoding: 'utf8' });
                } catch (err: any) {
                    console.error(chalk.red("Error retrieving history:"), err.message);
                    process.exit(1);
                }
                if (!historyOutput.trim()) {
                    console.log(chalk.yellow("No more commits to display."));
                    break;
                }
                console.log(chalk.blue("\nCommit History:\n"));
                console.log(chalk.green(historyOutput));

                const { showMore } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'showMore',
                        message: 'Show next page?',
                        default: true,
                    }
                ]);
                if (!showMore) {
                    break;
                }
                skip += perPage;
            }
        });
}