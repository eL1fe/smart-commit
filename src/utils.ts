import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { execSync } from 'child_process';
import parseGitIgnore from 'parse-gitignore';
import { Config, LintRules } from './types';
import inquirer from 'inquirer';

declare const __dirname: string;

const CONFIG_PATH = path.join(os.homedir(), '.smart-commit-config.json');

export const defaultConfig: Config = {
    commitTypes: [
        { emoji: "✨", value: "feat", description: "A new feature" },
        { emoji: "🐛", value: "fix", description: "A bug fix" },
        { emoji: "📝", value: "docs", description: "Documentation changes" },
        { emoji: "💄", value: "style", description: "Code style improvements" },
        { emoji: "♻️", value: "refactor", description: "Code refactoring" },
        { emoji: "🚀", value: "perf", description: "Performance improvements" },
        { emoji: "✅", value: "test", description: "Adding tests" },
        { emoji: "🔧", value: "chore", description: "Maintenance and chores" },
        { emoji: "🚧", value: "wip", description: "Work in progress" }
    ],
    autoAdd: false,
    useEmoji: true,
    ciCommand: "",
    templates: {
        defaultTemplate: "[{type}]{ticketSeparator}{ticket}: {summary}"
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
    branch: {
        template: "{type}/{ticketId}-{shortDesc}",
        types: [
            { value: "feature", description: "New feature" },
            { value: "fix", description: "Bug fix" },
            { value: "chore", description: "Chore branch" },
            { value: "hotfix", description: "Hotfix branch" },
            { value: "release", description: "Release branch" },
            { value: "dev", description: "Development branch" }
        ],
        placeholders: {
            ticketId: { lowercase: false }
        }
    }
};

export function loadConfig(): Config {
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

export function saveConfig(config: Config): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log(chalk.green("Global configuration saved at"), CONFIG_PATH);
}

export function loadGitignorePatterns(): string[] {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        return [];
    }
    try {
        const buf = fs.readFileSync(gitignorePath);
        const result = parseGitIgnore(buf);

        let patterns: string[] = [];
        if (Array.isArray(result)) {
            patterns = result;
        } else if (result && Array.isArray((result as any).patterns)) {
            patterns = (result as any).patterns;
        }

        patterns = patterns.filter(Boolean);

        return patterns;
    } catch (err) {
        console.error(chalk.red("Failed to parse .gitignore:"), err);
        return [];
    }
}

export function getUnstagedFiles(): string[] {
    let unstaged: string[] = [];

    try {
        const changed = execSync('git diff --name-only', { encoding: 'utf8' })
            .split('\n')
            .map(f => f.trim())
            .filter(Boolean);

        const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
            .split('\n')
            .map(f => f.trim())
            .filter(Boolean);

        unstaged = Array.from(new Set([...changed, ...untracked]));
    } catch (err: any) {
        console.error(chalk.red("Error getting unstaged files:"), err.message);
    }
    return unstaged;
}

export function stageSelectedFiles(files: string[]): void {
    if (files.length === 0) {
        return;
    }
    for (const file of files) {
        execSync(`git add "${file}"`, { stdio: 'inherit' });
    }
}

export function computeAutoSummary(): string {
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

export function suggestCommitType(): string | null {
    try {
        const diffFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() !== '');
        
        if (diffFiles.length > 0) {
            if (diffFiles.every(f => f.endsWith('.md'))) return 'docs';
            
            const configFiles = [
                'package.json', 
                'tsconfig.json', 
                '.eslintrc', 
                '.prettierrc', 
                'babel.config.js', 
                'webpack.config.js',
                'vite.config.ts',
                '.env',
                'docker-compose.yml',
                'Dockerfile'
            ];
            if (diffFiles.some(f => configFiles.includes(f))) return 'chore';

            if (diffFiles.some(f => 
                f.includes('__tests__') || 
                f.endsWith('.test.ts') || 
                f.endsWith('.spec.ts')
            )) return 'test';

            const sourcePatterns = [
                'src/components/',
                'src/hooks/',
                'src/utils/',
                'src/services/',
                'src/context/',
                'src/types/',
                'src/styles/'
            ];

            if (diffFiles.some(f => sourcePatterns.some(pattern => f.includes(pattern)))) {
                if (diffFiles.some(f => f.includes('styles/') || f.endsWith('.css') || f.endsWith('.scss'))) return 'style';
                if (diffFiles.some(f => f.includes('types/') || f.endsWith('.d.ts'))) return 'refactor';
                return 'feat';
            }

            if (diffFiles.some(f => 
                f.includes('perf/') || 
                f.includes('performance/') || 
                f.includes('optimization/')
            )) return 'perf';

            if (diffFiles.some(f => 
                f.includes('security/') || 
                f.endsWith('.lock') || 
                f.includes('vulnerability')
            )) return 'security';

            if (diffFiles.some(f => 
                f.includes('.github/workflows/') || 
                f.includes('ci/') || 
                f.includes('cd/') || 
                f === '.gitlab-ci.yml'
            )) return 'ci';

            if (diffFiles.some(f => 
                f === 'package-lock.json' || 
                f === 'yarn.lock' || 
                f === 'pnpm-lock.yaml'
            )) return 'build';

            if (diffFiles.some(f => f.startsWith('src/'))) return 'feat';
        }
    } catch { }
    return null;
}

export function lintCommitMessage(message: string, rules: LintRules): string[] {
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

export async function previewCommitMessage(message: string, lintRules: LintRules): Promise<string> {
  let currentMessage = message;

  while (true) {
    console.log(chalk.blue("\nPreview commit message:\n"));
    console.log(currentMessage);

    const { confirmPreview } = await inquirer.prompt([
      { 
        type: 'confirm', 
        name: 'confirmPreview', 
        message: 'Does the commit message look OK?', 
        default: true 
      }
    ]);

    if (!confirmPreview) {
      const response = await inquirer.prompt([
        { 
          type: 'editor', 
          name: 'editedMessage', 
          message: 'Edit the commit message as needed:', 
          default: currentMessage 
        }
      ]);
      currentMessage = response.editedMessage || currentMessage;
    }

    const errors = lintCommitMessage(currentMessage, lintRules);
    
    if (errors.length === 0) {
      return currentMessage;
    }

    console.log(chalk.red("Linting errors:"));
    errors.forEach(err => console.log(chalk.red("- " + err)));

    const response = await inquirer.prompt([
      { 
        type: 'confirm', 
        name: 'continueEditing', 
        message: 'Do you want to continue editing?', 
        default: true 
      },
      { 
        type: 'editor', 
        name: 'editedMessage', 
        message: 'Edit the commit message to fix these issues:', 
        default: currentMessage,
        when: (answers) => answers.continueEditing
      }
    ]);

    if (!response.continueEditing) {
      throw new Error("Commit message editing cancelled");
    }

    currentMessage = response.editedMessage;
  }
}

export function ensureGitRepo(): void {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch {
        console.log(chalk.red("Not a Git repository. Please run 'git init' or navigate to a valid repo."));
        process.exit(1);
    }
}

export function showDiffPreview(): void {
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