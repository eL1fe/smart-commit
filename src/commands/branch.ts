import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { loadConfig, ensureGitRepo } from '../utils';
import { AutocompleteQuestion } from '../types';

interface ExtendedPlaceholderConfig extends Record<string, any> {
    separator?: string;
    collapseSeparator?: boolean;
    maxLength?: number;
    lowercase?: boolean;
}

/**
 * Sanitizes a string for a branch name:
 * - Replaces spaces with separator (default '-')
 * - Removes "extra" characters (except letters, numbers, _, and the separator itself)
 * - If lowercase !== false, converts to lowerCase (default: true)
 * - If collapseSeparator (default true), collapses repeated separators
 * - If maxLength is set, truncates
 */
export function sanitizeForBranch(input: string, options?: ExtendedPlaceholderConfig): string {
    const separator = options?.separator ?? '-';
    const collapseSeparator = options?.collapseSeparator ?? true;
    const maxLength = options?.maxLength;

    let result = input.replace(/\s/g, separator);

    const invalidChars = new RegExp(`[^a-zA-Z0-9_${separator}]`, 'g');
    result = result.replace(invalidChars, '');

    if (options?.lowercase !== false) {
        result = result.toLowerCase();
    }

    if (collapseSeparator) {
        const reSep = new RegExp(`${separator}{2,}`, 'g');
        result = result.replace(reSep, separator);
    }

    if (maxLength && result.length > maxLength) {
        result = result.substring(0, maxLength);
    }

    return result;
}

export function registerBranchCommand(program: Command): void {
    program
        .command('branch')
        .alias('b')
        .description('Create a new branch from a base branch (or current HEAD) with a naming template and autocomplete search.')
        .action(async () => {
            ensureGitRepo();
            const config = loadConfig();

            const template = config.branch?.template || "{type}/{ticketId}-{shortDesc}";
            const branchTypes = config.branch?.types || [];

            let localBranches: string[] = [];
            try {
                const rawBranches = execSync(
                    'git branch --sort=-committerdate --format="%(refname:short)"',
                    { encoding: 'utf8' }
                );
                localBranches = rawBranches
                    .split('\n')
                    .map(b => b.trim())
                    .filter(Boolean);
            } catch (err: any) {
                console.error(chalk.red("Error getting local branches:"), err.message);
            }

            const baseBranchQuestion: AutocompleteQuestion = {
                type: 'autocomplete',
                name: 'baseBranchChoice',
                message: 'Select a base branch (or type to search). Choose "Manual input..." to enter something else.',
                source: async (answersSoFar, input) => {
                    if (!input) {
                        let suggestions = localBranches.slice(0, 4);
                        const mainBranch = localBranches.find(branch =>
                            branch.toLowerCase() === 'main' || branch.toLowerCase() === 'master'
                        );
                        if (mainBranch && !suggestions.includes(mainBranch)) {
                            suggestions.push(mainBranch);
                        }
                        suggestions.push('Manual input...');
                        return suggestions;
                    }

                    const query = input.toLowerCase();
                    let suggestions = localBranches.filter(branch =>
                        branch.toLowerCase().includes(query)
                    );
                    if (!suggestions.includes('Manual input...')) {
                        suggestions.push('Manual input...');
                    }
                    return suggestions;
                }
            };

            const { baseBranchChoice } = await inquirer.prompt([baseBranchQuestion]);
            let finalBaseBranch = baseBranchChoice;
            if (baseBranchChoice === 'Manual input...') {
                const { manualBranch } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'manualBranch',
                        message: 'Enter base branch name (any value):',
                    }
                ]);
                finalBaseBranch = manualBranch.trim();
            }

            const placeholderRegex = /{(\w+)}/g;
            const placeholders: string[] = [];
            let match;
            while ((match = placeholderRegex.exec(template)) !== null) {
                if (!placeholders.includes(match[1])) {
                    placeholders.push(match[1]);
                }
            }

            const answers: Record<string, string> = {};
            for (const ph of placeholders) {
                let question;
                if (ph === 'type') {
                    if (branchTypes.length > 0) {
                        const choices = branchTypes.map(bt => ({
                            name: `${bt.value} (${bt.description})`,
                            value: bt.value
                        }));
                        choices.push({
                            name: "Custom input...",
                            value: "CUSTOM_INPUT"
                        });
                        question = {
                            type: 'list',
                            name: ph,
                            message: 'Select branch type:',
                            choices
                        };
                    } else {
                        question = {
                            type: 'input',
                            name: ph,
                            message: 'Enter branch type (no branch types defined in config):',
                            default: ''
                        };
                    }
                } else if (ph === 'shortDesc') {
                    question = {
                        type: 'input',
                        name: ph,
                        message: 'Short description for branch name:',
                        validate: (input: string) => input ? true : 'Description cannot be empty'
                    };
                } else if (ph === 'ticketId') {
                    question = {
                        type: 'input',
                        name: ph,
                        message: 'Enter ticket ID (optional):',
                        default: ''
                    };
                } else {
                    question = {
                        type: 'input',
                        name: ph,
                        message: `Enter ${ph} (optional):`,
                        default: ''
                    };
                }

                const singleAnswer = await inquirer.prompt([question]);
                answers[ph] = singleAnswer[ph] || '';

                if (ph === 'type' && answers.type === 'CUSTOM_INPUT') {
                    const { customType } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'customType',
                            message: 'Enter custom branch type:',
                        }
                    ]);
                    answers.type = customType.trim();
                }
            }

            for (const ph of placeholders) {
                if (answers[ph]) {
                    const opts: ExtendedPlaceholderConfig = config.branch?.placeholders?.[ph] || {};
                    answers[ph] = sanitizeForBranch(answers[ph], opts);
                }
            }

            let finalBranchName = template;
            for (const ph of placeholders) {
                const val = answers[ph] || '';
                if (!val) {
                    finalBranchName = finalBranchName
                        .replace(`{${ph}}/`, '')
                        .replace(`{${ph}}-`, '')
                        .replace(`{${ph}}`, '');
                } else {
                    finalBranchName = finalBranchName.replace(`{${ph}}`, val);
                }
            }

            finalBranchName = finalBranchName
                .replace(/\/\/+/g, '/')
                .replace(/--+/g, '-')
                .replace(/^-+|-+$/g, '')
                .replace(/\/+$/, '');

            if (!finalBranchName) {
                const randomPart = Math.floor(Math.random() * 10000);
                finalBranchName = `new-branch-${randomPart}`;
            }

            try {
                console.log(chalk.blue(`Fetching all refs...`));
                execSync(`git fetch --all`, { stdio: 'inherit' });

                console.log(chalk.blue(`Creating new branch '${finalBranchName}' from '${finalBaseBranch || "HEAD"}'...`));
                if (finalBaseBranch) {
                    execSync(`git checkout -b "${finalBranchName}" "${finalBaseBranch}"`, { stdio: 'inherit' });
                } else {
                    execSync(`git checkout -b "${finalBranchName}"`, { stdio: 'inherit' });
                }
                console.log(chalk.green(`Branch created: ${finalBranchName}`));
            } catch (err: any) {
                console.error(chalk.red("Error creating branch:"), err.message);
                process.exit(1);
            }

            const { stayOnBranch } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'stayOnBranch',
                    message: `Stay on '${finalBranchName}'? (If 'No', you'll return to '${finalBaseBranch || "HEAD"}')`,
                    default: true
                }
            ]);
            if (!stayOnBranch && finalBaseBranch) {
                try {
                    execSync(`git checkout "${finalBaseBranch}"`, { stdio: 'inherit' });
                    console.log(chalk.green(`Switched back to '${finalBaseBranch}'.`));
                } catch (err: any) {
                    console.error(chalk.red("Error switching branch back:"), err.message);
                }
            } else if (!stayOnBranch) {
                console.log(chalk.yellow("No base branch specified, staying on new branch anyway."));
            }
        });
}