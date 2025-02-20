import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../utils';

export function registerStatsCommand(program: Command): void {
    program
        .command('stats')
        .description('Show enhanced commit statistics with ASCII graphs')
        .action(async () => {
            ensureGitRepo();
            const { period } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'period',
                    message: 'Select period for statistics:',
                    choices: [
                        { name: 'Day', value: '1 day ago' },
                        { name: 'Week', value: '1 week ago' },
                        { name: 'Month', value: '1 month ago' }
                    ],
                }
            ]);
            const { statsType } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'statsType',
                    message: 'Select type of statistics:',
                    choices: [
                        { name: 'Shortlog by author', value: 'shortlog' },
                        { name: 'Activity by date', value: 'activity' }
                    ],
                }
            ]);
            try {
                if (statsType === 'shortlog') {
                    execSync(`git --no-pager shortlog -s -n --since="${period}"`, { stdio: 'inherit' });
                } else if (statsType === 'activity') {
                    const datesOutput = execSync(`git log --since="${period}" --pretty=format:"%ad" --date=short`, { encoding: 'utf8' });
                    const dates = datesOutput.split('\n').filter(Boolean);
                    if (dates.length === 0) {
                        console.log(chalk.yellow("No commits found for the selected period."));
                    } else {
                        const counts: { [date: string]: number } = {};
                        dates.forEach(date => { counts[date] = (counts[date] || 0) + 1; });
                        const sortedDates = Object.keys(counts).sort();
                        console.log(chalk.blue("\nCommit Activity:"));
                        sortedDates.forEach(date => {
                            const count = counts[date];
                            const bar = "#".repeat(count);
                            console.log(chalk.green(`${date}: ${bar} (${count})`));
                        });
                    }
                }
            } catch (err: any) {
                console.error(chalk.red("Error retrieving statistics:"), err.message);
                process.exit(1);
            }
        });
}