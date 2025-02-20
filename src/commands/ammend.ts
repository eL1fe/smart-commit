import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { loadConfig, ensureGitRepo, lintCommitMessage } from '../utils';

export function registerAmendCommand(program: Command): void {
    program
        .command('amend')
        .description('Amend the last commit interactively')
        .action(async () => {
            ensureGitRepo();
            const config = loadConfig();
            try {
                const currentMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
                console.log(chalk.blue("Current commit message:\n") + currentMsg);
                const { amendConfirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'amendConfirm',
                        message: 'Do you want to amend the last commit?',
                        default: true,
                    }
                ]);
                if (!amendConfirm) {
                    console.log(chalk.yellow("Amend cancelled."));
                    return;
                }
                const { newMessage } = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'newMessage',
                        message: 'Edit the commit message:',
                        default: currentMsg,
                    }
                ]);
                const errors = config.enableLint ? lintCommitMessage(newMessage, config.lintRules) : [];
                if (errors.length > 0) {
                    console.log(chalk.red("Linting errors:"));
                    errors.forEach(err => console.log(chalk.red("- " + err)));
                    console.log(chalk.red("Amend aborted due to linting errors."));
                    process.exit(1);
                }
                execSync(`git commit --amend -m "${newMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
                console.log(chalk.green("Commit amended successfully!"));
            } catch (err: any) {
                console.error(chalk.red("Error during amend:"), err.message);
                process.exit(1);
            }
        });
}