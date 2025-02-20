import { Command } from 'commander';
import inquirer from 'inquirer';
import { saveConfig, defaultConfig } from '../utils';
import { Config } from '../types';

export function registerSetupCommand(program: Command): void {
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
                {
                    type: 'confirm',
                    name: 'enableBranchConfig',
                    message: 'Would you like to configure branch naming settings?',
                    default: false,
                },
                {
                    type: 'input',
                    name: 'branchTemplate',
                    message: 'Enter branch template (e.g. "{type}/{ticketId}-{shortDesc}"):',
                    default: "{type}/{ticketId}-{shortDesc}",
                    when: (answers: any) => answers.enableBranchConfig
                },
                {
                    type: 'confirm',
                    name: 'addBranchTypes',
                    message: 'Would you like to configure branch types?',
                    default: false,
                    when: (answers: any) => answers.enableBranchConfig
                },
                {
                    type: 'editor',
                    name: 'branchTypes',
                    message: 'Enter your branch types as JSON (array of {value, description}):',
                    default: '[\n  {"value":"feature","description":"New feature"},\n  {"value":"fix","description":"Bug fix"}\n]',
                    when: (answers: any) => answers.addBranchTypes
                },
                {
                    type: 'confirm',
                    name: 'addPlaceholders',
                    message: 'Would you like to configure placeholder rules?',
                    default: false,
                    when: (answers: any) => answers.enableBranchConfig
                },
                {
                    type: 'editor',
                    name: 'branchPlaceholders',
                    message: 'Enter placeholder config as JSON (e.g. { "ticketId": {"lowercase": false} })',
                    default: '{\n  "ticketId": {"lowercase": false}\n}',
                    when: (answers: any) => answers.addPlaceholders
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
                ticketRegex: setupAnswers.ticketRegex || "",
                enableLint: setupAnswers.enableLint,
                // enableHooks: setupAnswers.enableHooks,
            };

            if (setupAnswers.enableBranchConfig) {
                newConfig.branch = {
                    template: setupAnswers.branchTemplate || defaultConfig.branch?.template || "{type}/{ticketId}-{shortDesc}",
                    types: defaultConfig.branch?.types || [],
                    placeholders: defaultConfig.branch?.placeholders || {}
                };

                if (setupAnswers.addBranchTypes && setupAnswers.branchTypes) {
                    try {
                        const parsed = JSON.parse(setupAnswers.branchTypes);
                        newConfig.branch.types = parsed;
                    } catch {
                        console.error("Error parsing branch types JSON, ignoring...");
                    }
                }

                if (setupAnswers.addPlaceholders && setupAnswers.branchPlaceholders) {
                    try {
                        const parsed = JSON.parse(setupAnswers.branchPlaceholders);
                        newConfig.branch.placeholders = parsed;
                    } catch {
                        console.error("Error parsing placeholders JSON, ignoring...");
                    }
                }
            }
            saveConfig(newConfig);
            console.log("Setup complete!");
        });
}