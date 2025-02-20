import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../utils';

export function registerRebaseHelperCommand(program: Command): void {
    program
        .command('rebase-helper')
        .alias('rebase')
        .description('Launch interactive rebase helper with explanations')
        .action(async () => {
            ensureGitRepo();
            const { commitCount } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'commitCount',
                    message: 'Enter the number of commits to rebase (e.g., 3):',
                    validate: (input: string) => {
                        const num = parseInt(input, 10);
                        return (!isNaN(num) && num > 0) || 'Please enter a valid positive number';
                    }
                }
            ]);

            console.log(chalk.blue(`Launching interactive rebase for the last ${commitCount} commits.\n`));

            console.log(chalk.yellow("### Interactive Rebase Guide ###"));
            console.log(chalk.yellow("Git interactive rebase allows you to modify, reorder, and squash commits."));
            console.log(chalk.yellow("When the editor opens, you will see a list of commits. Each line starts with a command and a commit hash."));
            console.log(chalk.yellow("You can change the command to modify how the commit is handled.\n"));

            console.log(chalk.green("Basic Commands:"));
            console.log(chalk.cyan("  pick   ") + "Use the commit as-is.");
            console.log(chalk.cyan("  reword ") + "Use the commit, but edit the commit message.");
            console.log(chalk.cyan("  edit   ") + "Stop at the commit for amending.");
            console.log(chalk.cyan("  squash ") + "Merge the commit into the previous commit.");
            console.log(chalk.cyan("  fixup  ") + "Like squash, but discard this commit’s message.");
            console.log(chalk.cyan("  drop   ") + "Remove the commit.");
            console.log(chalk.cyan("  exec   ") + "Run a shell command.");
            console.log(chalk.cyan("  break  ") + "Pause the rebase (resume later with 'git rebase --continue').\n");

            console.log(chalk.magenta("### How to Use the Editor ###"));
            console.log(chalk.yellow("1. Use arrow keys to navigate up/down."));
            console.log(chalk.yellow("2. Press 'i' to enter insert mode and edit commands."));
            console.log(chalk.yellow("3. Modify 'pick' to another command (e.g., 'reword', 'squash')."));
            console.log(chalk.yellow("4. Press 'Esc' to exit insert mode."));
            console.log(chalk.yellow("5. Type ':wq' and press Enter to save and exit."));
            console.log(chalk.yellow("6. If you make a mistake, use ':q!' to quit without saving.\n"));

            // Ожидание подтверждения перед запуском rebase
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Did you read the instructions above? Ready to start the rebase?',
                    default: true
                }
            ]);

            if (!confirm) {
                console.log(chalk.red("Rebase aborted by user."));
                process.exit(0);
            }

            console.log(chalk.blue("Opening interactive rebase editor..."));

            try {
                execSync(`git rebase -i HEAD~${commitCount}`, { stdio: 'inherit' });
                console.log(chalk.green("Interactive rebase completed."));
            } catch (err: any) {
                console.error(chalk.red("Error during interactive rebase:"), err.message);
                process.exit(1);
            }
        });
}