import { Command } from 'commander';
import { registerStatsCommand } from '../src/commands/stats';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { ensureGitRepo } from '../src/utils';
import chalk from 'chalk';

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
jest.mock('../src/utils', () => ({
  ensureGitRepo: jest.fn(),
}));

describe('registerStatsCommand', () => {
  let program: Command;
  let promptMock: jest.Mock;
  let execSyncMock: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    program = new Command();
    registerStatsCommand(program);
    promptMock = inquirer.prompt as unknown as jest.Mock;
    execSyncMock = execSync as jest.Mock;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    });
    (ensureGitRepo as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show shortlog statistics for selected period', async () => {
    promptMock
      .mockResolvedValueOnce({ period: '1 week ago' })
      .mockResolvedValueOnce({ statsType: 'shortlog' });

    execSyncMock.mockImplementation((cmd: string, options: any) => {
      if (cmd.startsWith('git --no-pager shortlog')) {
        expect(cmd).toContain('--since="1 week ago"');
        return "";
      }
      return "";
    });

    await program.parseAsync(['stats'], { from: 'user' });
    expect(ensureGitRepo).toHaveBeenCalled();
    expect(execSyncMock).toHaveBeenCalledWith('git --no-pager shortlog -s -n --since="1 week ago"', { stdio: 'inherit' });
  });

  it('should show activity statistics for selected period', async () => {
    promptMock
      .mockResolvedValueOnce({ period: '1 month ago' })
      .mockResolvedValueOnce({ statsType: 'activity' });
    const datesOutput = `2025-02-01
2025-02-01
2025-02-02
2025-02-03
2025-02-03
2025-02-03`;
    execSyncMock.mockImplementation((cmd: string, options: any) => {
      if (cmd.startsWith('git log')) {
        expect(cmd).toContain('--since="1 month ago"');
        return datesOutput;
      }
      return "";
    });

    await program.parseAsync(['stats'], { from: 'user' });
    expect(ensureGitRepo).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.blue("\nCommit Activity:"));
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`2025-02-01: ${"#".repeat(2)} (2)`));
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`2025-02-02: ${"#".repeat(1)} (1)`));
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`2025-02-03: ${"#".repeat(3)} (3)`));
  });

  it('should print "No commits found for the selected period." when no commits are present', async () => {
    promptMock
      .mockResolvedValueOnce({ period: '1 day ago' })
      .mockResolvedValueOnce({ statsType: 'activity' });
    execSyncMock.mockImplementation((cmd: string, options: any) => {
      if (cmd.startsWith('git log')) {
        return "";
      }
      return "";
    });

    await program.parseAsync(['stats'], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow("No commits found for the selected period."));
  });

  it('should exit with error if execSync fails', async () => {
    promptMock
      .mockResolvedValueOnce({ period: '1 day ago' })
      .mockResolvedValueOnce({ statsType: 'shortlog' });

    const errorMessage = 'Simulated error';
    execSyncMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(program.parseAsync(['stats'], { from: 'user' }))
      .rejects.toThrow('process.exit: 1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Error retrieving statistics:"), expect.stringContaining(errorMessage));
  });
});