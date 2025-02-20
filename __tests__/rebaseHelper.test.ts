import { Command } from 'commander';
import inquirer from 'inquirer';
import { registerRebaseHelperCommand } from '../src/commands/rebaseHelper';
import { ensureGitRepo } from '../src/utils';

jest.mock('inquirer');
jest.mock('../src/utils', () => ({
  ensureGitRepo: jest.fn()
}));

describe('registerRebaseHelperCommand', () => {
  let program: Command;
  let exitSpy: jest.SpyInstance;
  let execSyncSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    program = new Command();
    registerRebaseHelperCommand(program);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    });
    execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('executes rebase when valid inputs and confirmed', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ commitCount: '3' })
      .mockResolvedValueOnce({ confirm: true });

    await program.parseAsync(['rebase-helper'], { from: 'user' });

    expect(ensureGitRepo).toHaveBeenCalled();
    expect(execSyncSpy).toHaveBeenCalledWith('git rebase -i HEAD~3', { stdio: 'inherit' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Interactive rebase completed.'));
  });

  test('aborts rebase when user does not confirm', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ commitCount: '5' })
      .mockResolvedValueOnce({ confirm: false });

    await expect(program.parseAsync(['rebase-helper'], { from: 'user' }))
      .rejects.toThrow('process.exit: 0');

    expect(execSyncSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Rebase aborted by user.'));
  });

  test('exits with error if execSync throws an error', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ commitCount: '2' })
      .mockResolvedValueOnce({ confirm: true });

    const errorMessage = 'Simulated exec error';
    execSyncSpy.mockImplementation(() => { throw new Error(errorMessage); });

    await expect(program.parseAsync(['rebase-helper'], { from: 'user' }))
      .rejects.toThrow('process.exit: 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error during interactive rebase:'),
      expect.stringContaining(errorMessage)
    );
  });
});