import { Command } from 'commander';
import { registerAmendCommand } from '../src/commands/ammend';
import { loadConfig, ensureGitRepo, lintCommitMessage } from '../src/utils';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

jest.mock('inquirer', () => ({
    prompt: jest.fn(),
}));
jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));
jest.mock('../src/utils', () => ({
    ensureGitRepo: jest.fn(),
    loadConfig: jest.fn(),
    lintCommitMessage: jest.fn(),
}));

describe('registerAmendCommand', () => {
    let program: Command;
    let mockExit: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        registerAmendCommand(program);

        (inquirer.prompt as unknown as jest.Mock).mockReset();
        (execSync as jest.Mock).mockReset();
        (ensureGitRepo as jest.Mock).mockReset();
        (loadConfig as jest.Mock).mockReset();
        (lintCommitMessage as jest.Mock).mockReset();

        mockExit = jest.spyOn(process, 'exit').mockImplementation(code => {
            throw new Error(`process.exit: ${code}`);
        });
    });

    afterEach(() => {
        mockExit.mockRestore();
    });

    it('should throw if ensureGitRepo throws an error', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => {
            throw new Error('Not a Git repo');
        });

        await expect(program.parseAsync(['node', 'test', 'amend']))
            .rejects
            .toThrow('Not a Git repo');

        expect(execSync).not.toHaveBeenCalled();
    });

    it('should exit if user does not confirm amend', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({});

        (execSync as jest.Mock).mockReturnValueOnce('Old commit message\n');

        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ amendConfirm: false });

        await expect(program.parseAsync(['node', 'test', 'amend']))
            .resolves
            .not.toThrow();

        expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('should amend normally if user confirms and without lint', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            enableLint: false,
        });
        (execSync as jest.Mock).mockReturnValueOnce('Old commit message\n');

        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ amendConfirm: true })
            .mockResolvedValueOnce({ newMessage: 'New commit message' });

        await program.parseAsync(['node', 'test', 'amend']);

        const calls = (execSync as jest.Mock).mock.calls;
        const amendCall = calls.find(call => call[0].includes('git commit --amend'));
        expect(amendCall).toBeTruthy();
        expect(amendCall[0]).toMatch(/New commit message/);

        expect(lintCommitMessage).not.toHaveBeenCalled();

    });

    it('should perform lint if enableLint = true and abort amend on errors', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            enableLint: true,
            lintRules: { /* ... */ },
        });
        (execSync as jest.Mock).mockReturnValueOnce('Old commit message\n');

        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ amendConfirm: true })
            .mockResolvedValueOnce({ newMessage: 'bad commit message' });

        (lintCommitMessage as jest.Mock).mockReturnValue(['Error: summary too long']);

        await expect(program.parseAsync(['node', 'test', 'amend']))
            .rejects
            .toThrow('process.exit: 1');

        expect(execSync).toHaveBeenCalledTimes(1);
        const calls = (execSync as jest.Mock).mock.calls;
        expect(calls.some(call => call[0].includes('git commit --amend'))).toBe(false);
    });

    it('should perform lint and amend normally if no errors', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            enableLint: true,
            lintRules: { /* ... */ },
        });
        (execSync as jest.Mock).mockReturnValueOnce('Old commit message\n');

        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ amendConfirm: true })
            .mockResolvedValueOnce({ newMessage: 'good commit message' });

        (lintCommitMessage as jest.Mock).mockReturnValue([]);

        await program.parseAsync(['node', 'test', 'amend']);

        expect(execSync).toHaveBeenCalledTimes(2);
        const calls = (execSync as jest.Mock).mock.calls;
        const amendCall = calls.find(call => call[0].includes('git commit --amend'));
        expect(amendCall[0]).toMatch(/"good commit message"/);
    });

    it('should catch execSync errors and exit with code 1', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({ enableLint: false });

        (execSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('git error');
        });

        await expect(program.parseAsync(['node', 'test', 'amend']))
            .rejects
            .toThrow('process.exit: 1');
    });
});