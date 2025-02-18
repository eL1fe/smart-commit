#!/usr/bin/env node

import { program } from 'commander';
import inquirer, { Answers, Question } from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Type alias for an input question.
 * @template T - The answer type.
 */
type InputQuestion<T extends Answers<any>> = Question<T> & { type: 'input' };

/**
 * Type alias for a list question.
 * @template T - The answer type.
 */
type ListQuestion<T extends Answers<any>> = Question<T> & { type: 'list' };

/**
 * Type alias for a confirm question.
 * @template T - The answer type.
 */
type ConfirmQuestion<T extends Answers<any>> = Question<T> & { type: 'confirm' };

/**
 * Type alias for an editor question.
 * @template T - The answer type.
 */
type EditorQuestion<T extends Answers<any>> = Question<T> & { type: 'editor' };

/**
 * Interface representing a commit type.
 */
interface CommitType {
    emoji: string;
    value: string;
    description: string;
}

/**
 * Interface representing commit message templates.
 */
interface Templates {
    /** Default commit message template. Available placeholders: {ticket}, {ticketSeparator}, {type}, {scope}, {summary}, {body}, {footer} */
    defaultTemplate: string;
}

/**
 * Interface for the configuration settings.
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
    /** Regular expression for ticket extraction from branch name (empty string if none) */
    ticketRegex: string;
}

/** Global configuration file path */
const CONFIG_PATH = path.join(os.homedir(), '.smart-commit-config.json');

/** Default configuration settings */
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
    ciCommand: "npm test",
    templates: {
        // Default template. If a ticket is provided, it will be prefixed.
        defaultTemplate: "[{type}]{ticketSeparator}{ticket}: {summary}\n\nBody:\n{body}\n\nFooter:\n{footer}"
    },
    // By default, only type and summary are enabled.
    steps: {
        scope: false,
        body: false,
        footer: false,
        ticket: false,
        runCI: false,
    },
    ticketRegex: ""
};

/**
 * Loads the global configuration from disk.
 * If the file does not exist or fails to load, returns the default configuration.
 * Then, if a local config (.smartcommitrc.json) exists in the current directory,
 * merges its properties into the global config.
 * @returns {Config} The loaded (and merged) configuration.
 */
function loadConfig(): Config {
    let config: Config = defaultConfig;
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            config = JSON.parse(data) as Config;
        } catch (err) {
            console.error("Error reading global config, using default settings.");
        }
    }
    // Check for local configuration file
    const localConfigPath = path.join(process.cwd(), '.smartcommitrc.json');
    if (fs.existsSync(localConfigPath)) {
        try {
            const localData = fs.readFileSync(localConfigPath, 'utf8');
            const localConfig = JSON.parse(localData) as Partial<Config>;
            // Merge local config over global config (shallow merge)
            config = { ...config, ...localConfig };
        } catch (err) {
            console.error("Error reading local config, ignoring.");
        }
    }
    return config;
}

/**
 * Saves the global configuration to disk.
 * @param {Config} config - The configuration to save.
 */
function saveConfig(config: Config): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log("Global configuration saved at", CONFIG_PATH);
}

/**
 * Interface for answers collected during commit creation.
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
 * Computes a default commit summary based on staged changes.
 * It checks for common files and keywords and merges results.
 * @returns {string} The auto-generated summary.
 */
function computeAutoSummary(): string {
    let summaries: string[] = [];
    try {
        const diffFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() !== '');
        if (diffFiles.length > 0) {
            if (diffFiles.includes('package.json')) {
                summaries.push('Update dependencies');
            }
            if (diffFiles.some(f => f.includes('Dockerfile'))) {
                summaries.push('Update Docker configuration');
            }
            if (diffFiles.some(f => f.endsWith('.md'))) {
                summaries.push('Update documentation');
            }
            if (diffFiles.some(f => f.startsWith('src/') || f.endsWith('.ts') || f.endsWith('.js'))) {
                summaries.push('Update source code');
            }
            // Merge multiple summaries if any
            return summaries.join(', ');
        }
    } catch (err) {
        // If diff fails, return empty string
    }
    return '';
}

/**
 * Suggests a commit type based on staged files.
 * @returns {string | null} Suggested commit type or null if none.
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
    } catch (err) {
        // ignore
    }
    return null;
}

program
    .name('sc')
    .description('Smart Commit CLI Tool - Create customizable Git commits with ease.')
    .version('1.0.0');

program.addHelpText('beforeAll', `
========================================
 Welcome to Smart Commit CLI!
========================================
`);

program.addHelpText('afterAll', `
Examples:
  sc commit        # Start interactive commit prompt
  sc config        # View or edit configuration (pretty printed)
  sc setup         # Run initial setup wizard
  sc ci            # Run CI tests
  sc stats         # Show commit statistics for the last week
`);

/**
 * Commit command: prompts the user for commit details and creates a Git commit.
 */
program
    .command('commit')
    .alias('c')
    .description('Create a commit with interactive prompts')
    .option('--push', 'Push commit to remote after creation', false)
    .option('--sign', 'Sign commit with GPG', false)
    .action(async (cmdObj) => {
        const config = loadConfig();
        const suggestedType = suggestCommitType();
        const commitTypeChoices = config.commitTypes.map(ct => ({
            name: config.useEmoji
                ? `${ct.emoji} ${ct.value} (${ct.description})`
                : `${ct.value} (${ct.description})`,
            value: ct.value,
        }));
        const autoSummary = computeAutoSummary();

        const questions: (ListQuestion<CommitAnswers> | InputQuestion<CommitAnswers> | ConfirmQuestion<CommitAnswers> | EditorQuestion<CommitAnswers>)[] = [];
        questions.push({
            type: 'list',
            name: 'type',
            message: 'Select commit type:',
            choices: commitTypeChoices,
            default: suggestedType || undefined,
        } as ListQuestion<CommitAnswers>);

        if (config.steps.scope) {
            questions.push({
                type: 'input',
                name: 'scope',
                message: 'Enter scope (optional):',
            } as InputQuestion<CommitAnswers>);
        }

        questions.push({
            type: 'input',
            name: 'summary',
            message: 'Enter commit summary:',
            default: autoSummary,
            validate: (input: string) => input ? true : 'Summary cannot be empty',
        } as InputQuestion<CommitAnswers>);

        if (config.steps.body) {
            questions.push({
                type: 'editor',
                name: 'body',
                message: 'Enter commit body (your default editor will open, leave empty to skip):',
            } as EditorQuestion<CommitAnswers>);
        }

        if (config.steps.footer) {
            questions.push({
                type: 'input',
                name: 'footer',
                message: 'Enter commit footer (optional):',
            } as InputQuestion<CommitAnswers>);
        }

        if (config.steps.ticket) {
            questions.push({
                type: 'input',
                name: 'ticket',
                message: 'Enter ticket ID (optional):',
            } as InputQuestion<CommitAnswers>);
        }

        if (config.steps.runCI) {
            questions.push({
                type: 'confirm',
                name: 'runCI',
                message: 'Run CI tests before commit?',
                default: false,
            } as ConfirmQuestion<CommitAnswers>);
        }

        questions.push({
            type: 'confirm',
            name: 'autoAdd',
            message: 'Stage all changes before commit?',
            default: config.autoAdd,
        } as ConfirmQuestion<CommitAnswers>);

        questions.push({
            type: 'confirm',
            name: 'confirmCommit',
            message: 'Confirm and execute commit?',
            default: true,
        } as ConfirmQuestion<CommitAnswers>);

        const answers = (await inquirer.prompt(questions as any)) as CommitAnswers;
        if (answers.scope === undefined) answers.scope = "";
        if (answers.body === undefined) answers.body = "";
        if (answers.footer === undefined) answers.footer = "";
        if (answers.ticket === undefined) answers.ticket = "";
        if (answers.runCI === undefined) answers.runCI = false;

        if (config.steps.ticket && !answers.ticket && config.ticketRegex) {
            try {
                const branchName = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
                const re = new RegExp(config.ticketRegex);
                const match = branchName.match(re);
                if (match && match[0]) {
                    answers.ticket = match[0];
                    console.log(`Extracted ticket from branch: ${answers.ticket}`);
                }
            } catch (err) {
                // Ignore extraction errors
            }
        }

        if (answers.runCI) {
            try {
                console.log('Running CI tests...');
                execSync(config.ciCommand, { stdio: 'inherit' });
                console.log('CI tests passed!');
            } catch (err: any) {
                console.error('CI tests failed:', err.message);
                process.exit(1);
            }
        }

        if (!answers.confirmCommit) {
            console.log('Commit cancelled.');
            process.exit(0);
        }

        const scopeFormatted = answers.scope && answers.scope.trim() !== '' ? `(${answers.scope.trim()})` : '';
        const ticketSeparator = answers.ticket && answers.ticket.trim() !== '' ? ": " : "";
        let commitMsg = config.templates.defaultTemplate
            .replace('{ticket}', answers.ticket.trim())
            .replace('{ticketSeparator}', ticketSeparator)
            .replace('{type}', answers.type)
            .replace('{scope}', scopeFormatted)
            .replace('{summary}', answers.summary.trim())
            .replace('{body}', answers.body.trim())
            .replace('{footer}', answers.footer.trim());

        try {
            if (answers.autoAdd) {
                execSync('git add .', { stdio: 'inherit' });
            }
            const commitCommand = cmdObj.sign
                ? `git commit -S -m "${commitMsg.replace(/"/g, '\\"')}"`
                : `git commit -m "${commitMsg.replace(/"/g, '\\"')}"`;
            execSync(commitCommand, { stdio: 'inherit' });
            console.log('Commit successful!');
        } catch (err: any) {
            console.error('Error during commit:', err.message);
            process.exit(1);
        }

        if (cmdObj.push) {
            try {
                execSync('git push', { stdio: 'inherit' });
                console.log('Pushed successfully!');
            } catch (err: any) {
                console.error('Push failed:', err.message);
            }
        }
    });

//
// CI Command (alias "rci")
//
program
    .command('ci')
    .alias('rci')
    .description('Run CI tests as configured')
    .action(() => {
        const config = loadConfig();
        try {
            console.log('Running CI tests...');
            execSync(config.ciCommand, { stdio: 'inherit' });
            console.log('CI tests passed!');
        } catch (err: any) {
            console.error('CI tests failed:', err.message);
            process.exit(1);
        }
    });

//
// Stats Command: shows commit statistics for the last week.
//
program
    .command('stats')
    .description('Show commit statistics for the last week')
    .action(() => {
        try {
            execSync('git shortlog -s -n --since="1 week ago"', { stdio: 'inherit' });
        } catch (err: any) {
            console.error('Error retrieving stats:', err.message);
            process.exit(1);
        }
    });

//
// Config Command (alias "cfg")
// Outputs current configuration in a table format if no options are provided.
//
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
    .action((options: {
        autoAdd?: boolean;
        useEmoji?: boolean;
        ciCommand?: string;
        template?: string;
        enableScope?: boolean;
        enableBody?: boolean;
        enableFooter?: boolean;
        enableTicket?: boolean;
        enableRunCi?: boolean;
        ticketRegex?: string;
    }) => {
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
        if (changed) {
            saveConfig(config);
        } else {
            console.log("Current configuration:\n");

            console.table([
                { Key: 'autoAdd', Value: config.autoAdd },
                { Key: 'useEmoji', Value: config.useEmoji },
                { Key: 'ciCommand', Value: config.ciCommand },
                { Key: 'ticketRegex', Value: config.ticketRegex }
            ]);

            console.log("\nSteps (prompts enabled):");
            console.table([
                { Step: 'scope', Enabled: config.steps.scope },
                { Step: 'body', Enabled: config.steps.body },
                { Step: 'footer', Enabled: config.steps.footer },
                { Step: 'ticket', Enabled: config.steps.ticket },
                { Step: 'runCI', Enabled: config.steps.runCI }
            ]);

            console.log("\nCommit Types:");
            console.table(config.commitTypes);

            console.log("\nDefault Template:\n", config.templates.defaultTemplate);
        }
    });

//
// Setup Command
// Runs an interactive setup wizard for initial configuration.
//
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
            }
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
            ticketRegex: setupAnswers.ticketRegex || ""
        };
        saveConfig(newConfig);
        console.log("Setup complete!");
    });

program.parse(process.argv);