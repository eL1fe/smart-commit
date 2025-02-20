import { Command } from 'commander';
import chalk from 'chalk';
import { saveConfig, loadConfig, defaultConfig } from '../utils';

export function registerConfigCommand(program: Command): void {
    program
        .command('config')
        .alias('cfg')
        .description('Configure or view Smart Commit settings')
        .option('--reset', 'Reset configuration to default settings')
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
        // .option('--enable-hooks <bool>', 'Enable Git Hooks installation (true/false)', (value: string) => value === 'true')
        .option('--branch-template <template>', 'Set branch naming template')
        .option('--branch-type <json>', 'Set branch types (JSON string)')
        .option('--branch-placeholder <json>', 'Set branch placeholder config (JSON string)')
        .action((options) => {
            if (options.reset) {
                saveConfig(defaultConfig);
                console.log(chalk.green("Configuration has been reset to default settings."));
                return;
            }

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

            if (options.branchTemplate) {
                if (!config.branch) {
                    config.branch = {
                        template: "{type}/{ticketId}-{shortDesc}",
                        types: [],
                        placeholders: {}
                    };
                }
                config.branch.template = options.branchTemplate;
                changed = true;
            }

            if (options.branchType) {
                try {
                    const parsed = JSON.parse(options.branchType);
                    if (Array.isArray(parsed)) {
                        if (!config.branch) {
                            config.branch = { template: "", types: parsed, placeholders: {} };
                        } else {
                            config.branch.types = parsed;
                        }
                        changed = true;
                    } else {
                        console.error("branch-type JSON must be an array of objects!");
                    }
                } catch (err) {
                    console.error("Invalid JSON for --branch-type:", err);
                }
            }

            if (options.branchPlaceholder) {
                try {
                    const parsed = JSON.parse(options.branchPlaceholder);
                    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                        if (!config.branch) {
                            config.branch = { template: "", types: [], placeholders: parsed };
                        } else {
                            config.branch.placeholders = parsed;
                        }
                        changed = true;
                    } else {
                        console.error("branch-placeholder JSON must be an object!");
                    }
                } catch (err) {
                    console.error("Invalid JSON for --branch-placeholder:", err);
                }
            }

            if (changed) {
                saveConfig(config);
            } else {
                console.log(chalk.blue("Current configuration:"));

                console.table([
                    { Key: 'autoAdd', Value: config.autoAdd },
                    { Key: 'useEmoji', Value: config.useEmoji },
                    { Key: 'ciCommand', Value: config.ciCommand },
                    { Key: 'ticketRegex', Value: config.ticketRegex },
                    { Key: 'enableLint', Value: config.enableLint },
                    // { Key: 'enableHooks', Value: config.enableHooks },
                ]);

                console.log(chalk.blue("\nSteps (prompts enabled):"));
                console.table([
                    { Step: 'scope', Enabled: config.steps.scope },
                    { Step: 'body', Enabled: config.steps.body },
                    { Step: 'footer', Enabled: config.steps.footer },
                    { Step: 'ticket', Enabled: config.steps.ticket },
                    { Step: 'runCI', Enabled: config.steps.runCI }
                ]);

                console.log(chalk.blue("\nLint Rules:"));
                console.table([
                    {
                        summaryMaxLength: config.lintRules.summaryMaxLength,
                        typeCase: config.lintRules.typeCase,
                        requiredTicket: config.lintRules.requiredTicket
                    }
                ]);

                console.log(chalk.blue("\nCommit Types:"));
                console.table(config.commitTypes);

                console.log(chalk.blue("\nDefault Commit Template:\n"), config.templates.defaultTemplate);

                if (config.branch) {
                    console.log(chalk.blue("\nBranch Configuration Template:\n"), config.branch.template);

                    if (config.branch.types && config.branch.types.length > 0) {
                        console.log(chalk.blue("\nBranch Types:"));
                        console.table(config.branch.types);
                    }

                    if (config.branch.placeholders) {
                        console.log(chalk.blue("\nBranch Placeholders:"));

                        const placeholdersData = Object.entries(config.branch.placeholders).map(([phName, opts]) => ({
                            placeholder: phName,
                            lowercase: opts.lowercase ?? true,
                            separator: opts.separator ?? '-',
                            collapseSeparator: opts.collapseSeparator ?? true,
                            maxLength: opts.maxLength ?? 'N/A'
                        }));
                        console.table(placeholdersData);
                    }
                }
            }
        });
}