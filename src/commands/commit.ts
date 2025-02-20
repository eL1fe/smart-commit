import { Command } from 'commander';
import inquirer, { ConfirmQuestion, EditorQuestion, InputQuestion, ListQuestion, CheckboxQuestion as InquirerCheckboxQuestion } from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import {
    loadConfig,
    getUnstagedFiles,
    loadGitignorePatterns,
    stageSelectedFiles,
    computeAutoSummary,
    suggestCommitType,
    previewCommitMessage,
    ensureGitRepo,
    showDiffPreview
} from '../utils';
import micromatch from 'micromatch';

export function registerCommitCommand(program: Command): void {
    program
        .command('commit')
        .alias('c')
        .description('Create a commit with interactive prompts')
        .option('--push', 'Push commit to remote after creation', false)
        .option('--sign', 'Sign commit with GPG', false)
        .option('--lint', 'Enable commit message linting')
        .action(async (cmdObj: { lint?: boolean; sign: any; push: any; }) => {
            ensureGitRepo();
            const config = loadConfig();
            const suggestedType = suggestCommitType();

            const commitTypeChoices = config.commitTypes.map(ct => ({
                name: config.useEmoji
                    ? `${ct.emoji} ${ct.value} (${ct.description})`
                    : `${ct.value} (${ct.description})`,
                value: ct.value,
            }));

            let filesToStage: string[] = [];

            if (!config.autoAdd) {
                const unstagedFiles = getUnstagedFiles();
                const ignorePatterns = loadGitignorePatterns();
                const filtered = unstagedFiles.filter(file => !micromatch.isMatch(file, ignorePatterns));

                if (filtered.length > 0) {
                    const checkboxQuestion: InquirerCheckboxQuestion = {
                        type: 'checkbox',
                        name: 'files',
                        message: 'Select files to stage:',
                        choices: filtered,
                    };
                    const { files } = await inquirer.prompt([checkboxQuestion]);
                    filesToStage = files;
                    stageSelectedFiles(filesToStage);
                } else {
                    console.log(chalk.yellow("No unstaged files to add (that aren’t ignored)."));
                }
            } else {
                const unstagedFiles = getUnstagedFiles();
                const ignorePatterns = loadGitignorePatterns();
                const filtered = unstagedFiles.filter(file => !micromatch.isMatch(file, ignorePatterns));

                if (filtered.length > 0) {
                    console.log(chalk.blue("Auto-adding non-ignored files:"));
                    filtered.forEach(f => console.log("  " + f));
                    stageSelectedFiles(filtered);
                } else {
                    console.log(chalk.yellow("No files to auto-add (all ignored or none changed)."));
                }
            }

            const actuallyStaged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
                .split('\n')
                .filter(f => f.trim() !== '');

            if (actuallyStaged.length === 0) {
                console.log(chalk.yellow("No changes staged. Aborting commit."));
                return;
            }

            const autoSummary = computeAutoSummary();
            const questions: (ListQuestion | InputQuestion | ConfirmQuestion | EditorQuestion)[] = [];

            questions.push({
                type: 'list',
                name: 'type',
                message: 'Select commit type:',
                choices: commitTypeChoices,
                default: suggestedType || undefined,
            } as ListQuestion);

            if (config.steps.scope) {
                questions.push({
                    type: 'input',
                    name: 'scope',
                    message: 'Enter scope (optional):',
                } as InputQuestion);
            }

            questions.push({
                type: 'input',
                name: 'summary',
                message: 'Enter commit summary:',
                default: autoSummary,
                validate: (input: string) => input ? true : 'Summary cannot be empty',
            } as InputQuestion);

            if (config.steps.body) {
                questions.push({
                    type: 'editor',
                    name: 'body',
                    message: 'Enter commit body (your default editor will open, leave empty to skip):',
                } as EditorQuestion);
            }
            if (config.steps.footer) {
                questions.push({
                    type: 'input',
                    name: 'footer',
                    message: 'Enter commit footer (optional):',
                } as InputQuestion);
            }
            if (config.steps.ticket) {
                questions.push({
                    type: 'input',
                    name: 'ticket',
                    message: 'Enter ticket ID (optional):',
                } as InputQuestion);
            }
            if (config.steps.runCI) {
                questions.push({
                    type: 'confirm',
                    name: 'runCI',
                    message: 'Run CI tests before commit?',
                    default: false,
                } as ConfirmQuestion);
            }

            questions.push({
                type: 'confirm',
                name: 'pushCommit',
                message: 'Push commit after creation?',
                default: cmdObj.push || false,
            } as ConfirmQuestion);

            const answers = await inquirer.prompt(questions) as {
                type: string; scope: string; summary: string; body: string;
                footer: string; ticket: string; runCI: boolean; pushCommit: boolean;
            };

            if (!answers.scope) answers.scope = "";
            if (!answers.body) answers.body = "";
            if (!answers.footer) answers.footer = "";
            if (!answers.ticket) answers.ticket = "";
            if (!answers.runCI) answers.runCI = false;

            if (config.steps.ticket && !answers.ticket && config.ticketRegex) {
                try {
                    const branchName = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
                    const re = new RegExp(config.ticketRegex);
                    const match = branchName.match(re);
                    if (match && match[0]) {
                        answers.ticket = match[0];
                        console.log(chalk.cyan(`Extracted ticket from branch: ${answers.ticket}`));
                    }
                } catch { }
            }

            if (answers.runCI) {
                try {
                    console.log(chalk.blue('Running CI tests...'));
                    execSync(config.ciCommand, { stdio: 'inherit' });
                    console.log(chalk.green('CI tests passed!'));
                } catch (err: any) {
                    console.error(chalk.red('CI tests failed:'), err.message);
                    process.exit(1);
                }
            }

            const stagedFilesStill = execSync('git diff --cached --name-only', { encoding: 'utf8' })
                .split('\n')
                .filter(f => f.trim() !== '');
            if (stagedFilesStill.length === 0) {
                console.log(chalk.yellow("No changes staged (anymore). Aborting commit."));
                return;
            }

            const { diffPreview } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'diffPreview',
                    message: 'Would you like to view the staged diff preview?',
                    default: false,
                }
            ]);
            if (diffPreview) {
                ensureGitRepo();
                showDiffPreview();
                const { diffConfirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'diffConfirm',
                        message: 'Does the staged diff look OK?',
                        default: true,
                    }
                ]);
                if (!diffConfirm) {
                    console.log(chalk.yellow("Commit cancelled due to diff review."));
                    return;
                }
            }

            const scopeFormatted = answers.scope.trim() !== '' ? `(${answers.scope.trim()})` : '';
            const ticketSeparator = answers.ticket.trim() !== '' ? ": " : "";

            let commitMsg = config.templates.defaultTemplate
                .replace('{ticket}', answers.ticket.trim())
                .replace('{ticketSeparator}', ticketSeparator)
                .replace('{type}', answers.type)
                .replace('{scope}', scopeFormatted)
                .replace('{summary}', answers.summary.trim())
                .replace('{body}', answers.body.trim())
                .replace('{footer}', answers.footer.trim());

            const lintEnabled = cmdObj.lint !== undefined ? cmdObj.lint : config.enableLint;

            if (lintEnabled) {
                commitMsg = await previewCommitMessage(commitMsg, config.lintRules);
            } else {
                const { previewChoice } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'previewChoice',
                        message: 'Preview commit message?',
                        default: true,
                    }
                ]);
                if (previewChoice) {
                    console.log(chalk.blue("\nPreview commit message:\n"));
                    console.log(commitMsg);
                }
                const { finalConfirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'finalConfirm',
                        message: 'Proceed with commit?',
                        default: true,
                    }
                ]);
                if (!finalConfirm) {
                    console.log(chalk.yellow('Commit cancelled after preview.'));
                    return;
                }
            }

            try {
                const commitCommand = cmdObj.sign
                    ? `git commit -S -m "${commitMsg.replace(/"/g, '\\"')}"`
                    : `git commit -m "${commitMsg.replace(/"/g, '\\"')}"`;
                execSync(commitCommand, { stdio: 'inherit' });
                console.log(chalk.green('Commit successful!'));
            } catch (err: any) {
                console.error(chalk.red('Error during commit:'), err.message);
                process.exit(1);
            }

            if (answers.pushCommit) {
                try {
                    execSync('git push', { stdio: 'inherit' });
                    console.log(chalk.green('Pushed successfully!'));
                } catch (err: any) {
                    console.error(chalk.red('Push failed:'), err.message);
                }
            }
        });
}