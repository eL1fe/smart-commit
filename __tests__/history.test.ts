import { Command } from 'commander';
import { registerHistoryCommand } from '../src/commands/history';
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

describe('registerHistoryCommand', () => {
    let program: Command;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let mockExit: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        registerHistoryCommand(program);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
            throw new Error(`process.exit: ${code}`);
        });
        (inquirer.prompt as unknown as jest.Mock).mockReset();
        (execSync as jest.Mock).mockReset();
        (ensureGitRepo as jest.Mock).mockReset();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        mockExit.mockRestore();
    });

    it('should call ensureGitRepo and prompt for filter type', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'keyword' })
            .mockResolvedValueOnce({ keyword: 'fix' });

        (execSync as jest.Mock).mockReturnValue('commit1\ncommit2\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(ensureGitRepo).toHaveBeenCalled();
        expect(inquirer.prompt).toHaveBeenCalledTimes(2);
        expect(execSync).toHaveBeenCalledWith('git log --pretty=oneline --grep="fix"', { encoding: 'utf8' });
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.blue("\nCommit History:\n"));
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commit1\ncommit2\n'));
    });

    it('should build the command correctly for filterType "author"', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'author' })
            .mockResolvedValueOnce({ author: 'john@example.com' });
        (execSync as jest.Mock).mockReturnValue('commitA\ncommitB\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(inquirer.prompt).toHaveBeenCalledTimes(2);
        expect(execSync).toHaveBeenCalledWith('git log --pretty=oneline --author="john@example.com"', { encoding: 'utf8' });
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commitA\ncommitB\n'));
    });

    it('should build the command correctly for filterType "date"', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'date' })
            .mockResolvedValueOnce({ since: '2023-01-01', until: '2023-01-31' });
        (execSync as jest.Mock).mockReturnValue('commitX\ncommitY\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(inquirer.prompt).toHaveBeenCalledTimes(2);
        expect(execSync).toHaveBeenCalledWith('git log --pretty=oneline --since="2023-01-01" --until="2023-01-31"', { encoding: 'utf8' });
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commitX\ncommitY\n'));
    });

    it('should log error and exit if execSync fails', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'keyword' })
            .mockResolvedValueOnce({ keyword: 'error' });
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('Git error occurred');
        });

        await expect(program.parseAsync(['node', 'test', 'history']))
            .rejects.toThrow('process.exit: 1');

        expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Error retrieving history:"), 'Git error occurred');
    });
});