import { Command } from 'commander';
import inquirer from 'inquirer';
import { registerRollbackCommand } from '../src/commands/rollback';
import { ensureGitRepo } from '../src/utils';

jest.mock('inquirer');
jest.mock('../src/utils', () => ({
  ensureGitRepo: jest.fn()
}));

describe('registerRollbackCommand', () => {
  let program: Command;
  let exitSpy: jest.SpyInstance;
  let execSyncSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    program = new Command();
    registerRollbackCommand(program);
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

  test('performs soft reset successfully when confirmed', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'soft' })
      .mockResolvedValueOnce({ confirmRollback: true });

    await program.parseAsync(['rollback'], { from: 'user' });

    expect(ensureGitRepo).toHaveBeenCalled();
    expect(execSyncSpy).toHaveBeenCalledWith('git reset --soft HEAD~1', { stdio: 'inherit' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Rollback successful!"));
  });

  test('performs hard reset successfully when confirmed', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'hard' })
      .mockResolvedValueOnce({ confirmRollback: true });

    await program.parseAsync(['rollback'], { from: 'user' });

    expect(ensureGitRepo).toHaveBeenCalled();
    expect(execSyncSpy).toHaveBeenCalledWith('git reset --hard HEAD~1', { stdio: 'inherit' });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Rollback successful!"));
  });

  test('cancels rollback when confirmation is false', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'soft' })
      .mockResolvedValueOnce({ confirmRollback: false });

    await expect(program.parseAsync(['rollback'], { from: 'user' }))
      .rejects.toThrow('process.exit: 0');

    expect(execSyncSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Rollback cancelled."));
  });

  test('exits with error if execSync throws an error during soft reset', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'soft' })
      .mockResolvedValueOnce({ confirmRollback: true });

    const errorMessage = 'Simulated soft reset error';
    execSyncSpy.mockImplementation(() => { throw new Error(errorMessage); });

    await expect(program.parseAsync(['rollback'], { from: 'user' }))
      .rejects.toThrow('process.exit: 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error during rollback:"),
      expect.stringContaining(errorMessage)
    );
  });

  test('exits with error if execSync throws an error during hard reset', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'hard' })
      .mockResolvedValueOnce({ confirmRollback: true });

    const errorMessage = 'Simulated hard reset error';
    execSyncSpy.mockImplementation(() => { throw new Error(errorMessage); });

    await expect(program.parseAsync(['rollback'], { from: 'user' }))
      .rejects.toThrow('process.exit: 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error during rollback:"),
      expect.stringContaining(errorMessage)
    );
  });

  test('validates that ensureGitRepo is always called before any rollback logic', async () => {
    (inquirer.prompt as unknown as jest.Mock)
      .mockResolvedValueOnce({ resetType: 'hard' })
      .mockResolvedValueOnce({ confirmRollback: true });

    await program.parseAsync(['rollback'], { from: 'user' });
    expect(ensureGitRepo).toHaveBeenCalled();
  });
});