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

    it('should build and paginate the command correctly for filterType "keyword"', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'keyword', viewMode: 'merged' })
            .mockResolvedValueOnce({ keyword: 'fix' })
            .mockResolvedValueOnce({ limit: '20' })
            .mockResolvedValueOnce({ showMore: false });

        (execSync as jest.Mock).mockReturnValueOnce('commit1\ncommit2\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(ensureGitRepo).toHaveBeenCalled();
        expect(inquirer.prompt).toHaveBeenCalledTimes(4);
        expect(execSync).toHaveBeenCalledWith(
            'git log --pretty=oneline --grep="fix" --max-count=20 --skip=0',
            { encoding: 'utf8' }
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.blue("\nCommit History:\n"));
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commit1\ncommit2\n'));
    });

    it('should build and paginate the command correctly for filterType "author"', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'author', viewMode: 'merged' })
            .mockResolvedValueOnce({ author: 'john@example.com' })
            .mockResolvedValueOnce({ limit: '15' })
            .mockResolvedValueOnce({ showMore: false });
        (execSync as jest.Mock).mockReturnValueOnce('commitA\ncommitB\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(inquirer.prompt).toHaveBeenCalledTimes(4);
        expect(execSync).toHaveBeenCalledWith(
            'git log --pretty=oneline --author="john@example.com" --max-count=15 --skip=0',
            { encoding: 'utf8' }
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commitA\ncommitB\n'));
    });

    it('should build and paginate the command correctly for filterType "date"', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'date', viewMode: 'merged' })
            .mockResolvedValueOnce({ since: '2023-01-01', until: '2023-01-31' })
            .mockResolvedValueOnce({ limit: '10' })
            .mockResolvedValueOnce({ showMore: false });
        (execSync as jest.Mock).mockReturnValueOnce('commitX\ncommitY\n');

        await program.parseAsync(['node', 'test', 'history']);

        expect(inquirer.prompt).toHaveBeenCalledTimes(4);
        expect(execSync).toHaveBeenCalledWith(
            'git log --pretty=oneline --since="2023-01-01" --until="2023-01-31" --max-count=10 --skip=0',
            { encoding: 'utf8' }
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green('commitX\ncommitY\n'));
    });

    it('should paginate over multiple pages if user selects to show more', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'keyword', viewMode: 'merged' })
            .mockResolvedValueOnce({ keyword: 'update' })
            .mockResolvedValueOnce({ limit: '5' })
            .mockResolvedValueOnce({ showMore: true })
            .mockResolvedValueOnce({ showMore: false });

        (execSync as jest.Mock)
            .mockReturnValueOnce('commit1\ncommit2\ncommit3\ncommit4\ncommit5\n')
            .mockReturnValueOnce('');

        await program.parseAsync(['node', 'test', 'history']);

        expect(execSync).toHaveBeenNthCalledWith(
            1,
            'git log --pretty=oneline --grep="update" --max-count=5 --skip=0',
            { encoding: 'utf8' }
        );
        expect(execSync).toHaveBeenNthCalledWith(
            2,
            'git log --pretty=oneline --grep="update" --max-count=5 --skip=5',
            { encoding: 'utf8' }
        );
    });

    it('should log error and exit if execSync fails during pagination', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ filterType: 'keyword', viewMode: 'merged' })
            .mockResolvedValueOnce({ keyword: 'error' })
            .mockResolvedValueOnce({ limit: '20' })
            .mockResolvedValueOnce({ showMore: false });
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('Git error occurred');
        });

        await expect(program.parseAsync(['node', 'test', 'history']))
            .rejects.toThrow('process.exit: 1');

        expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Error retrieving history:"), 'Git error occurred');
    });
});