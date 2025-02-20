import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import parseGitIgnore from 'parse-gitignore';
import inquirer from 'inquirer';
import chalk from 'chalk';

import {
  defaultConfig,
  loadConfig,
  saveConfig,
  loadGitignorePatterns,
  getUnstagedFiles,
  stageSelectedFiles,
  computeAutoSummary,
  suggestCommitType,
  lintCommitMessage,
  previewCommitMessage,
  ensureGitRepo,
  showDiffPreview,
} from '../src/utils';

jest.mock('fs');
jest.mock('child_process');
jest.mock('parse-gitignore');
jest.mock('inquirer');

const CONFIG_PATH = path.join(os.homedir(), '.smart-commit-config.json');

describe('Utils', () => {
  describe('loadConfig', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('should return defaultConfig if global config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      const config = loadConfig();
      expect(config).toEqual(defaultConfig);
    });
    it('should load and parse global config if file exists', () => {
      const globalConfig = { ...defaultConfig, autoAdd: true };
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === CONFIG_PATH) return true;
        if (filePath === path.join('/fake/path', '.smartcommitrc.json')) return false;
        return false;
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(globalConfig));
      const config = loadConfig();
      expect(config).toEqual(globalConfig);
    });
    it('should merge local config over global config', () => {
      const globalConfig = { ...defaultConfig, autoAdd: false, ciCommand: "npm test" };
      const localConfig = { autoAdd: true, ciCommand: "yarn test" };
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === CONFIG_PATH) return true;
        if (filePath === path.join('/fake/path', '.smartcommitrc.json')) return true;
        return false;
      });
      (fs.readFileSync as jest.Mock)
        .mockImplementation((filePath: string) => {
          if (filePath === CONFIG_PATH) return JSON.stringify(globalConfig);
          if (filePath === path.join('/fake/path', '.smartcommitrc.json')) return JSON.stringify(localConfig);
          return "";
        });
      const config = loadConfig();
      expect(config.autoAdd).toBe(true);
      expect(config.ciCommand).toBe("yarn test");
    });
    it('should log error and use default if global config is invalid JSON', () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error('Invalid JSON'); });
      const config = loadConfig();
      expect(console.error).toHaveBeenCalledWith(chalk.red("Error reading global config, using default settings."));
      expect(config).toEqual(defaultConfig);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveConfig', () => {
    it('should write config to CONFIG_PATH and log message', () => {
      const writeFileSyncMock = fs.writeFileSync as jest.Mock;
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      saveConfig(defaultConfig);
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        CONFIG_PATH,
        JSON.stringify(defaultConfig, null, 2),
        'utf8'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green("Global configuration saved at"), CONFIG_PATH);
      consoleLogSpy.mockRestore();
    });
  });

  describe('loadGitignorePatterns', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('should return empty array if .gitignore does not exist', () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const patterns = loadGitignorePatterns();
      expect(patterns).toEqual([]);
    });
    it('should parse and return patterns from .gitignore', () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue("node_modules\n.dist\n");
      (parseGitIgnore as unknown as jest.Mock).mockReturnValue(["node_modules", ".dist"]);
      const patterns = loadGitignorePatterns();
      expect(patterns).toEqual(["node_modules", ".dist"]);
    });
    it('should log error and return empty array if parsing fails', () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/fake/path');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error("read error"); });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const patterns = loadGitignorePatterns();
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Failed to parse .gitignore:"), expect.any(Error));
      expect(patterns).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUnstagedFiles', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('should return unique list of changed and untracked files', () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce("file1.js\nfile2.js\n")
        .mockReturnValueOnce("file2.js\nfile3.js\n");
      const files = getUnstagedFiles();
      expect(files.sort()).toEqual(["file1.js", "file2.js", "file3.js"].sort());
    });
    it('should log error and return empty array if execSync fails', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (execSync as jest.Mock).mockImplementation(() => { throw new Error("git error"); });
      const files = getUnstagedFiles();
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Error getting unstaged files:"), "git error");
      expect(files).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('stageSelectedFiles', () => {
    it('should call git add for each file in the list', () => {
      (execSync as jest.Mock).mockReset();
      stageSelectedFiles(["file1.js", "file2.js"]);
      expect(execSync).toHaveBeenCalledWith('git add "file1.js"', { stdio: 'inherit' });
      expect(execSync).toHaveBeenCalledWith('git add "file2.js"', { stdio: 'inherit' });
    });
    it('should do nothing if file list is empty', () => {
      (execSync as jest.Mock).mockReset();
      stageSelectedFiles([]);
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  describe('computeAutoSummary', () => {
    it('should return a concatenated summary based on staged files', () => {
      (execSync as jest.Mock).mockReturnValue("package.json\nsrc/app.ts\nREADME.md\n");
      const summary = computeAutoSummary();
      expect(summary).toContain("Update dependencies");
      expect(summary).toContain("Update source code");
      expect(summary).toContain("Update documentation");
    });
    it('should return empty string if no staged files', () => {
      (execSync as jest.Mock).mockReturnValue("");
      const summary = computeAutoSummary();
      expect(summary).toBe("");
    });
  });

  describe('suggestCommitType', () => {
    it('should suggest "docs" if all staged files are markdown', () => {
      (execSync as jest.Mock).mockReturnValue("README.md\nCONTRIBUTING.md\n");
      const type = suggestCommitType();
      expect(type).toBe("docs");
    });
    it('should suggest "chore" if package.json is staged', () => {
      (execSync as jest.Mock).mockReturnValue("package.json\nother.txt\n");
      const type = suggestCommitType();
      expect(type).toBe("chore");
    });
    it('should suggest "feat" if any staged file is in src/', () => {
      (execSync as jest.Mock).mockReturnValue("src/index.ts\n");
      const type = suggestCommitType();
      expect(type).toBe("feat");
    });
    it('should return null if no staged files', () => {
      (execSync as jest.Mock).mockReturnValue("");
      const type = suggestCommitType();
      expect(type).toBeNull();
    });
  });

  describe('lintCommitMessage', () => {
    const rules = {
      summaryMaxLength: 10,
      typeCase: "lowercase",
      requiredTicket: true,
    };
    it('should return error if summary too long', () => {
      const message = "This summary is definitely too long\nOther lines";
      const errors = lintCommitMessage(message, rules);
      expect(errors[0]).toMatch(/Summary is too long/);
    });
    it('should return error if summary does not start with lowercase', () => {
      const message = "Invalid summary\nBody";
      const errors = lintCommitMessage(message, { ...rules, summaryMaxLength: 100, requiredTicket: false });
      expect(errors).toContain("Summary should start with a lowercase letter.");
    });
    it('should return error if ticket is required but not present', () => {
      const message = "valid summary\nBody";
      const errors = lintCommitMessage(message, { ...rules, summaryMaxLength: 100, requiredTicket: true });
      expect(errors).toContain("A ticket ID is required in the commit message (e.g., '#DEV-123').");
    });
    it('should return empty array if message passes all lint rules', () => {
      const message = "valid\nBody with #123";
      const errors = lintCommitMessage(message, { summaryMaxLength: 100, typeCase: "lowercase", requiredTicket: true });
      expect(errors).toEqual([]);
    });
  });

  describe('previewCommitMessage', () => {
    it('should return message if preview is confirmed and no lint errors', async () => {
      (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ confirmPreview: true });
      const message = "valid message with #ticket";
      const result = await previewCommitMessage(message, { summaryMaxLength: 100, typeCase: "lowercase", requiredTicket: false });
      expect(result).toBe(message);
    });
    
    it('should allow editing message when not confirmed', async () => {
      (inquirer.prompt as unknown as jest.Mock)
        .mockResolvedValueOnce({ confirmPreview: false })
        .mockResolvedValueOnce({ editedMessage: "edited message" })
        .mockResolvedValueOnce({ confirmPreview: true });

      const message = "original message";
      const result = await previewCommitMessage(message, { summaryMaxLength: 100, typeCase: "lowercase", requiredTicket: false });
      expect(result).toBe("edited message");
    });
  });

  describe('ensureGitRepo', () => {
    let exitSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit: ${code}`);
      });
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should do nothing if inside a Git repo', () => {
      (execSync as jest.Mock).mockReturnValue("true");
      expect(() => ensureGitRepo()).not.toThrow();
    });

    it('should log error and call process.exit if not inside a Git repo', () => {
      (execSync as jest.Mock).mockImplementation(() => { throw new Error("not a repo"); });
      expect(() => ensureGitRepo()).toThrow('process.exit: 1');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.red("Not a Git repository. Please run 'git init' or navigate to a valid repo.")
      );
    });
  });

  describe('showDiffPreview', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('should show message if no staged changes to show', () => {
      (execSync as jest.Mock).mockReturnValue("   ");
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      showDiffPreview();
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow("No staged changes to show."));
      consoleLogSpy.mockRestore();
    });
    it('should show diff preview if diff is not empty', () => {
      const fakeDiff = "diff --git a/file b/file";
      (execSync as jest.Mock).mockReturnValue(fakeDiff);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      showDiffPreview();
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green("\nStaged Diff Preview:\n"));
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(fakeDiff));
      consoleLogSpy.mockRestore();
    });
    it('should log error if execSync fails', () => {
      (execSync as jest.Mock).mockImplementation(() => { throw new Error("diff error"); });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      showDiffPreview();
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Error retrieving diff:"), "diff error");
      consoleErrorSpy.mockRestore();
    });
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
});