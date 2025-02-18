#!/usr/bin/env node

import { program } from 'commander';
import inquirer, { Question } from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// These variables are required to get the current file's path and directory in ES modules.
// In CommonJS, these are available globally, but in ES modules we need to construct them.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Question type without using generic Answers<any>.
 */
type InputQuestion = Question & { type: 'input' };
type ListQuestion = Question & { type: 'list' };
type ConfirmQuestion = Question & { type: 'confirm' };
type EditorQuestion = Question & { type: 'editor' };

/**
 * Represents a commit type (with emoji, value, description).
 */
interface CommitType {
    emoji: string;
    value: string;
    description: string;
}

/**
 * Represents commit message templates.
 */
interface Templates {
    defaultTemplate: string;
}

/**
 * Represents linting rules for commit messages.
 */
interface LintRules {
    summaryMaxLength: number;
    typeCase: string; // e.g. 'lowercase'
    requiredTicket: boolean;
}

/**
 * Main configuration interface.
 */
interface Config {
    commitTypes: CommitType[];
    autoAdd: boolean;
    useEmoji: boolean;
    ciCommand: string;
    templates: Templates;
    steps: {
        scope: boolean;
        body: boolean;
        footer: boolean;
        ticket: boolean;
        runCI: boolean;
    };
    ticketRegex: string;
    enableLint: boolean;
    lintRules: LintRules;
    // enableHooks: boolean; // TODO: implement hooks
}

/**
 * Path to the global config file in the user's home directory.
 */
const CONFIG_PATH = path.join(os.homedir(), '.smart-commit-config.json');

/**
 * Default configuration values.
 */
const defaultConfig: Config = {
    commitTypes: [
        { emoji: "✨", value: "feat", description: "A new feature" },
        { emoji: "🐛", value: "fix", description: "A bug fix" },
        { emoji: "📝", value: "docs", description: "Documentation changes" },
        { emoji: "💄", value: "style", description: "Code style improvements" },
        { emoji: "♻️", value: "refactor", description: "Code refactoring" },
        { emoji: "🚀", value: "perf", description: "Performance improvements" },
        { emoji: "✅", value: "test", description: "Adding tests" },
        { emoji: "🔧", value: "chore", description: "Maintenance and chores" }
    ],
    autoAdd: false,
    useEmoji: true,
    ciCommand: "",
    templates: {
        defaultTemplate: "[{type}]{ticketSeparator}{ticket}: {summary}\n\nBody:\n{body}\n\nFooter:\n{footer}"
    },
    steps: {
        scope: false,
        body: false,
        footer: false,
        ticket: false,
        runCI: false,
    },
    ticketRegex: "",
    enableLint: false,
    lintRules: {
        summaryMaxLength: 72,
        typeCase: "lowercase",
        requiredTicket: false,
    },
    // enableHooks: false,
};

/**
 * Loads the global and local config, merging them if both exist.
 */
function loadConfig(): Config {
    let config: Config = defaultConfig;

    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            config = JSON.parse(data) as Config;
        } catch {
            console.error(chalk.red("Error reading global config, using default settings."));
        }
    }
    const localConfigPath = path.join(process.cwd(), '.smartcommitrc.json');
    if (fs.existsSync(localConfigPath)) {
        try {
            const localData = fs.readFileSync(localConfigPath, 'utf8');
            const localConfig = JSON.parse(localData) as Partial<Config>;
            config = { ...config, ...localConfig };
        } catch {
            console.error(chalk.red("Error reading local config, ignoring."));
        }
    }

    if (!config.lintRules) {
        config.lintRules = { ...defaultConfig.lintRules };
    }

    return config;
}

/**
 * Saves the config to disk (global config).
 */
function saveConfig(config: Config): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log(chalk.green("Global configuration saved at"), CONFIG_PATH);
}

/**
 * Answers interface for commit creation.
 */
interface CommitAnswers {
    type: string;
    scope: string;
    summary: string;
    body: string;
    footer: string;
    ticket: string;
    runCI: boolean;
    autoAdd: boolean;
    confirmCommit: boolean;
    pushCommit: boolean;
    signCommit: boolean;
}

/**
 * Generates a default summary by analyzing staged changes.
 */
function computeAutoSummary(): string {
    let summaries: string[] = [];
    try {
        const diffFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() !== '');
        if (diffFiles.length > 0) {
            if (diffFiles.includes('package.json')) summaries.push('Update dependencies');
            if (diffFiles.some(f => f.includes('Dockerfile'))) summaries.push('Update Docker configuration');
            if (diffFiles.some(f => f.endsWith('.md'))) summaries.push('Update documentation');
            if (diffFiles.some(f => f.startsWith('src/') || f.endsWith('.ts') || f.endsWith('.js'))) summaries.push('Update source code');
            return summaries.join(', ');
        }
    } catch { }
    return '';
}

/**
 * Suggests a commit type based on staged files.
 */
function suggestCommitType(): string | null {
    try {
        const diffFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() !== '');
        if (diffFiles.length > 0) {
            if (diffFiles.every(f => f.endsWith('.md'))) return 'docs';
            if (diffFiles.includes('package.json')) return 'chore';
            if (diffFiles.some(f => f.startsWith('src/'))) return 'feat';
        }
    } catch { }
    return null;
}

/**
 * Lints the commit message using specified rules.
 */
function lintCommitMessage(message: string, rules: LintRules): string[] {
    const errors: string[] = [];
    const lines = message.split('\n');
    const summary = lines[0].trim();
    if (summary.length > rules.summaryMaxLength) {
        errors.push(`Summary is too long (${summary.length} characters). Max allowed is ${rules.summaryMaxLength}.`);
    }
    if (rules.typeCase === 'lowercase' && summary && summary[0] !== summary[0].toLowerCase()) {
        errors.push("Summary should start with a lowercase letter.");
    }
    if (rules.requiredTicket && !message.includes('#')) {
        errors.push("A ticket ID is required in the commit message (e.g., '#DEV-123').");
    }
    return errors;
}

/**
 * Interactive preview of the commit message with optional linting fix.
 */
async function previewCommitMessage(message: string, lintRules: LintRules): Promise<string> {
    console.log(chalk.blue("\nPreview commit message:\n"));
    console.log(message);
    const { confirmPreview } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmPreview',
            message: 'Does the commit message look OK?',
            default: true,
        }
    ]);
    if (confirmPreview) {
        const errors = lintCommitMessage(message, lintRules);
        if (errors.length > 0) {
            console.log(chalk.red("Linting errors:"));
            errors.forEach(err => console.log(chalk.red("- " + err)));
            const { editedMessage } = await inquirer.prompt([
                {
                    type: 'editor',
                    name: 'editedMessage',
                    message: 'Edit the commit message to fix these issues:',
                    default: message,
                }
            ]);
            return previewCommitMessage(editedMessage, lintRules);
        } else {
            return message;
        }
    } else {
        const { editedMessage } = await inquirer.prompt([
            {
                type: 'editor',
                name: 'editedMessage',
                message: 'Edit the commit message as needed:',
                default: message,
            }
        ]);
        return previewCommitMessage(editedMessage, lintRules);
    }
}

/**
 * Checks if the current directory is inside a Git repository.
 * If the directory is not a Git repository, displays an error message and exits the process.
 * 
 * @throws {Error} If the directory is not a Git repository
 */
function ensureGitRepo(): void {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
        console.log(chalk.red("Not a Git repository. Please run 'git init' or navigate to a valid repo."));
        process.exit(1);
    }
}

/**
 * Shows a preview of the staged diff.
 */
function showDiffPreview(): void {
    try {
        const diffSoFancyPath = path.join(__dirname, '..', 'node_modules', '.bin', 'diff-so-fancy');
        const diff = execSync(`git diff --staged | "${diffSoFancyPath}"`, { encoding: 'utf8' });
        if (diff.trim() === "") {
            console.log(chalk.yellow("No staged changes to show."));
        } else {
            console.log(chalk.green("\nStaged Diff Preview:\n"));
            console.log(chalk.green(diff));
        }
    } catch (err: any) {
        console.error(chalk.red("Error retrieving diff:"), err.message);
    }
}

program
    .name('sc')
    .description('Smart Commit CLI Tool - Create customizable Git commits with ease.')
    .version('1.1.4');

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
  sc ci            # Run CI tests as configured
  sc stats         # Show enhanced commit statistics
  sc history       # Show commit history with filtering
  sc config        # Configure or view settings
  sc setup         # Run interactive setup wizard
`));

program
    .command('config')
    .alias('cfg')
    .description('Configure or view Smart Commit settings')
    .option('-a, --auto-add <bool>', 'Set auto-add for commits (true/false)', (value: string) => value === 'true')
    .option('-e, --use-emoji <bool>', 'Use emojis in commit types (true/false)', (value: string) => value === 'true')
    .option('-c, --ci-command <command>', 'Set CI command (e.g., "npm test")')
    .option('-t, --template <template>', 'Set default commit message template')
    .option('--enable-scope <bool>', 'Enable scope prompt (true/false)', (value: string) => value === 'true')
    .option('--enable-body <bool>', 'Enable body prompt (true/false)', (value: string) => value === 'true')
    .option('--enable-footer <bool>', 'Enable footer prompt (true/false)', (value: string) => value === 'true')
    .option('--enable-ticket <bool>', 'Enable ticket prompt (true/false)', (value: string) => value === 'true')
    .option('--enable-run-ci <bool>', 'Enable CI prompt (true/false)', (value: string) => value === 'true')
    .option('--ticket-regex <regex>', 'Set regex for ticket extraction from branch name')
    .option('--enable-lint <bool>', 'Enable commit message linting (true/false)', (value: string) => value === 'true')
    .option('--enable-hooks <bool>', 'Enable Git Hooks installation (true/false)', (value: string) => value === 'true')
    .action((options) => {
        const config = loadConfig();
        let changed = false;

        if (options.autoAdd !== undefined) {
            config.autoAdd = options.autoAdd;
            changed = true;
        }
        if (options.useEmoji !== undefined) {
            config.useEmoji = options.useEmoji;
            changed = true;
        }
        if (options.ciCommand) {
            config.ciCommand = options.ciCommand;
            changed = true;
        }
        if (options.template) {
            config.templates.defaultTemplate = options.template;
            changed = true;
        }
        if (options.enableScope !== undefined) {
            config.steps.scope = options.enableScope;
            changed = true;
        }
        if (options.enableBody !== undefined) {
            config.steps.body = options.enableBody;
            changed = true;
        }
        if (options.enableFooter !== undefined) {
            config.steps.footer = options.enableFooter;
            changed = true;
        }
        if (options.enableTicket !== undefined) {
            config.steps.ticket = options.enableTicket;
            changed = true;
        }
        if (options.enableRunCi !== undefined) {
            config.steps.runCI = options.enableRunCi;
            changed = true;
        }
        if (options.ticketRegex) {
            config.ticketRegex = options.ticketRegex;
            changed = true;
        }
        if (options.enableLint !== undefined) {
            config.enableLint = options.enableLint;
            changed = true;
        }
        // if (options.enableHooks !== undefined) {
        //     config.enableHooks = options.enableHooks;
        //     changed = true;
        // }

        if (changed) {
            saveConfig(config);
        } else {
            console.log("\nCurrent configuration:\n");

            console.table([
                { Key: 'autoAdd', Value: config.autoAdd },
                { Key: 'useEmoji', Value: config.useEmoji },
                { Key: 'ciCommand', Value: config.ciCommand },
                { Key: 'ticketRegex', Value: config.ticketRegex },
                { Key: 'enableLint', Value: config.enableLint },
                // { Key: 'enableHooks', Value: config.enableHooks },
            ]);

            console.log("\nSteps (prompts enabled):");
            console.table([
                { Step: 'scope', Enabled: config.steps.scope },
                { Step: 'body', Enabled: config.steps.body },
                { Step: 'footer', Enabled: config.steps.footer },
                { Step: 'ticket', Enabled: config.steps.ticket },
                { Step: 'runCI', Enabled: config.steps.runCI }
            ]);

            console.log("\nLint Rules:");
            console.table([
                {
                    summaryMaxLength: config.lintRules.summaryMaxLength,
                    typeCase: config.lintRules.typeCase,
                    requiredTicket: config.lintRules.requiredTicket
                }
            ]);

            console.log("\nCommit Types:");
            console.table(config.commitTypes);

            console.log("\nDefault Template:\n", config.templates.defaultTemplate);
        }
    });

program
    .command('setup')
    .description('Interactive setup for Smart Commit configuration')
    .action(async () => {
        console.log("Welcome to Smart Commit setup!");
        const questions = [
            {
                type: 'confirm',
                name: 'enableScope',
                message: 'Enable scope prompt?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'enableBody',
                message: 'Enable body prompt?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'enableFooter',
                message: 'Enable footer prompt?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'enableTicket',
                message: 'Enable ticket prompt?',
                default: false,
            },
            {
                type: 'confirm',
                name: 'enableRunCi',
                message: 'Enable CI prompt?',
                default: false,
            },
            {
                type: 'input',
                name: 'ticketRegex',
                message: 'Enter regex for ticket extraction (leave blank for none):',
                default: ""
            },
            {
                type: 'input',
                name: 'template',
                message: 'Enter default commit message template:',
                default: "[{type}]: {summary}"
            },
            {
                type: 'confirm',
                name: 'autoAdd',
                message: 'Enable auto-add by default?',
                default: false,
            },
            {
                type: 'input',
                name: 'ciCommand',
                message: 'Enter CI command (leave blank for none):',
                default: ""
            },
            {
                type: 'confirm',
                name: 'enableLint',
                message: 'Enable commit message linting?',
                default: false
            },
            // {
            //     type: 'confirm',
            //     name: 'enableHooks',
            //     message: 'Enable Git Hooks installation?',
            //     default: false
            // }
        ];
        const setupAnswers = await inquirer.prompt(questions as any);

        const newConfig: Config = {
            ...defaultConfig,
            autoAdd: setupAnswers.autoAdd,
            ciCommand: setupAnswers.ciCommand || defaultConfig.ciCommand,
            templates: {
                defaultTemplate: setupAnswers.template || defaultConfig.templates.defaultTemplate
            },
            steps: {
                scope: setupAnswers.enableScope,
                body: setupAnswers.enableBody,
                footer: setupAnswers.enableFooter,
                ticket: setupAnswers.enableTicket,
                runCI: setupAnswers.enableRunCi,
            },
            ticketRegex: setupAnswers.ticketRegex || "",
            enableLint: setupAnswers.enableLint,
            // enableHooks: setupAnswers.enableHooks,
        };
        saveConfig(newConfig);
        console.log("Setup complete!");
    });

program
    .command('commit')
    .alias('c')
    .description('Create a commit with interactive prompts')
    .option('--push', 'Push commit to remote after creation', false)
    .option('--sign', 'Sign commit with GPG', false)
    .option('--no-lint', 'Skip commit message linting', false)
    .action(async (cmdObj: { lint: boolean; sign: any; push: any; }) => {
        ensureGitRepo();
        const config = loadConfig();
        const suggestedType = suggestCommitType();
        const commitTypeChoices = config.commitTypes.map(ct => ({
            name: config.useEmoji
                ? `${ct.emoji} ${ct.value} (${ct.description})`
                : `${ct.value} (${ct.description})`,
            value: ct.value,
        }));
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
            name: 'autoAdd',
            message: 'Stage all changes before commit?',
            default: config.autoAdd,
        } as ConfirmQuestion);

        const answers = await inquirer.prompt(questions) as CommitAnswers;
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

        if (answers.autoAdd) {
            execSync('git add .', { stdio: 'inherit' });
        }

        const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() !== '');
        if (stagedFiles.length === 0) {
            console.log(chalk.yellow("No changes staged. Aborting commit."));
            process.exit(0);
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
                process.exit(0);
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

        if (cmdObj.lint !== false && config.enableLint) {
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
                process.exit(0);
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

        if (cmdObj.push) {
            try {
                execSync('git push', { stdio: 'inherit' });
                console.log(chalk.green('Pushed successfully!'));
            } catch (err: any) {
                console.error(chalk.red('Push failed:'), err.message);
            }
        }
    });

program
    .command('amend')
    .description('Amend the last commit interactively')
    .action(async () => {
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
                process.exit(0);
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

program
    .command('rollback')
    .description('Rollback the last commit while choosing between soft and hard reset')
    .action(async () => {
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

program
    .command('rebase-helper')
    .description('Launch interactive rebase helper with explanations')
    .action(async () => {
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
        try {
            console.log(chalk.blue(`Launching interactive rebase for the last ${commitCount} commits.`));
            console.log(chalk.blue("In the rebase editor, use the following commands as needed:\n- pick: use the commit\n- reword: use the commit, but edit the commit message\n- edit: stop for amending the commit\n- squash: meld the commit into the previous commit\n- fixup: like squash but discard this commit's message\n- exec: run a shell command\n- drop: remove the commit"));
            execSync(`git rebase -i HEAD~${commitCount}`, { stdio: 'inherit' });
            console.log(chalk.green("Interactive rebase completed."));
        } catch (err: any) {
            console.error(chalk.red("Error during interactive rebase:"), err.message);
            process.exit(1);
        }
    });

program
    .command('stats')
    .description('Show enhanced commit statistics with ASCII graphs')
    .action(async () => {
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
                execSync(`git shortlog -s -n --since="${period}"`, { stdio: 'inherit' });
            } else if (statsType === 'activity') {
                const datesOutput = execSync(`git log --since="${period}" --pretty=format:"%ad" --date=short`, { encoding: 'utf8' });
                const dates = datesOutput.split('\n').filter(Boolean);
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
        } catch (err: any) {
            console.error(chalk.red("Error retrieving statistics:"), err.message);
            process.exit(1);
        }
    });

program
    .command('history')
    .description('Show commit history with search options')
    .action(async () => {
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

program.parse(process.argv);