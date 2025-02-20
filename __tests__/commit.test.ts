import { Command } from 'commander';
import { registerCommitCommand } from '../src/commands/commit';
import {
    loadConfig,
    getUnstagedFiles,
    loadGitignorePatterns,
    stageSelectedFiles,
    computeAutoSummary,
    suggestCommitType,
    previewCommitMessage,
    ensureGitRepo,
    showDiffPreview,
} from '../src/utils';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import micromatch from 'micromatch';

jest.mock('inquirer', () => ({
    prompt: jest.fn(),
}));
jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));
jest.mock('../src/utils', () => ({
    loadConfig: jest.fn(),
    getUnstagedFiles: jest.fn(),
    loadGitignorePatterns: jest.fn(),
    stageSelectedFiles: jest.fn(),
    computeAutoSummary: jest.fn(),
    suggestCommitType: jest.fn(),
    previewCommitMessage: jest.fn(),
    ensureGitRepo: jest.fn(),
    showDiffPreview: jest.fn(),
}));
jest.mock('micromatch', () => ({
    isMatch: jest.fn(),
}));

describe('registerCommitCommand', () => {
    let program: Command;
    let mockExit: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        registerCommitCommand(program);

        (inquirer.prompt as unknown as jest.Mock).mockReset();
        (execSync as jest.Mock).mockReset();
        (loadConfig as jest.Mock).mockReset();
        (getUnstagedFiles as jest.Mock).mockReset();
        (loadGitignorePatterns as jest.Mock).mockReset();
        (stageSelectedFiles as jest.Mock).mockReset();
        (computeAutoSummary as jest.Mock).mockReset();
        (suggestCommitType as jest.Mock).mockReset();
        (previewCommitMessage as jest.Mock).mockReset();
        (ensureGitRepo as jest.Mock).mockReset();
        (showDiffPreview as jest.Mock).mockReset();
        (micromatch.isMatch as jest.Mock).mockReset();

        mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
            throw new Error(`process.exit: ${code}`);
        });
    });

    afterEach(() => {
        mockExit.mockRestore();
    });

    it('should fail if not a git repo', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { throw new Error('Not a Git repo'); });
        await expect(program.parseAsync(['node', 'test', 'commit'])).rejects.toThrow('Not a Git repo');
    });

    it('should abort if no unstaged files (manual staging)', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [],
            useEmoji: true,
            steps: {},
            templates: { defaultTemplate: '[{type}]: {summary}' },
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue([]);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (execSync as jest.Mock).mockReturnValueOnce('').mockReturnValue('');
        await expect(program.parseAsync(['node', 'test', 'commit'])).resolves.not.toThrow();
        expect(stageSelectedFiles).not.toHaveBeenCalled();
    });

    it('should let user pick files then abort if no changes staged', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [{ emoji: '✨', value: 'feat', description: 'feature' }],
            useEmoji: true,
            steps: {},
            templates: { defaultTemplate: '[{type}]: {summary}' },
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['src/a.ts', 'test/b.ts']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ files: ['src/a.ts', 'test/b.ts'] });
        (execSync as jest.Mock).mockReturnValueOnce('').mockReturnValue('');
        await expect(program.parseAsync(['node', 'test', 'commit'])).resolves.not.toThrow();
        expect(stageSelectedFiles).toHaveBeenCalledWith(['src/a.ts', 'test/b.ts']);
    });

    it('should auto-add files if autoAdd=true then abort if no changes staged', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: true,
            commitTypes: [],
            useEmoji: true,
            steps: {},
            templates: {},
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['src/x.ts']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (execSync as jest.Mock).mockReturnValue('');
        await expect(program.parseAsync(['node', 'test', 'commit'])).resolves.not.toThrow();
        expect(stageSelectedFiles).toHaveBeenCalledWith(['src/x.ts']);
    });

    it('should ask main questions and commit if all is good (no diff preview, no lint, no CI)', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [
                { emoji: '✨', value: 'feat', description: 'feature' },
                { emoji: '🐛', value: 'fix', description: 'bug fix' }
            ],
            useEmoji: true,
            steps: { scope: true, body: false, footer: false, ticket: false, runCI: false },
            templates: { defaultTemplate: '[{type}]{scope}: {summary}' },
            enableLint: false
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['a.js']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['a.js'] })
            .mockResolvedValueOnce({ type: 'feat', scope: 'myScope', summary: 'My summary', pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: false })
            .mockResolvedValueOnce({ previewChoice: false })
            .mockResolvedValueOnce({ finalConfirm: true });
        (execSync as jest.Mock)
            .mockReturnValueOnce('a.js\n')
            .mockReturnValueOnce('a.js\n')
            .mockReturnValueOnce('');
        (computeAutoSummary as jest.Mock).mockReturnValue('AutoSummary');
        (suggestCommitType as jest.Mock).mockReturnValue('feat');
        await program.parseAsync(['node', 'test', 'commit']);
        const calls = (execSync as jest.Mock).mock.calls;
        const commitCall = calls.find(c => c[0].includes('git commit'));
        expect(commitCall).toBeTruthy();
        expect(commitCall[0]).toMatch(/\[feat\]\(myScope\): My summary/);
    });

    it('should run CI and fail, causing exit(1) and no commit', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [],
            useEmoji: true,
            steps: { runCI: true },
            ciCommand: 'npm test',
            templates: { defaultTemplate: '[{type}]: {summary}' },
            enableLint: false
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['file.js']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['file.js'] })
            .mockResolvedValueOnce({ type: 'fix', summary: 'some fix', runCI: true, pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: false })
            .mockResolvedValueOnce({ previewChoice: false })
            .mockResolvedValueOnce({ finalConfirm: true });
        (execSync as jest.Mock)
            .mockReturnValueOnce('file.js\n')
            .mockImplementationOnce(() => { throw new Error('Tests failed'); });
        await expect(program.parseAsync(['node', 'test', 'commit'])).rejects.toThrow('process.exit: 1');
        expect((execSync as jest.Mock).mock.calls.some(call => call[0].includes('git commit'))).toBe(false);
    });

    it('should show diff preview and abort if user declines diff confirm', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            steps: { runCI: false },
            commitTypes: [{ value: 'feat' }],
            templates: { defaultTemplate: '' },
            enableLint: false
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['f1']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['f1'] })
            .mockResolvedValueOnce({ type: 'feat', summary: 'summary', pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: true })
            .mockResolvedValueOnce({ diffConfirm: false });
        (execSync as jest.Mock)
            .mockReturnValueOnce('f1\n')
            .mockReturnValueOnce('f1\n');
        (showDiffPreview as jest.Mock).mockImplementation(() => { });
        await expect(program.parseAsync(['node', 'test', 'commit'])).resolves.not.toThrow();
        expect((execSync as jest.Mock).mock.calls.some(call => call[0].includes('git commit'))).toBe(false);
    });

    it('should call previewCommitMessage if lint=true and fail, causing exit(1)', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [{ value: 'feat' }],
            templates: { defaultTemplate: '[{type}]: {summary}' },
            steps: {},
            enableLint: true
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['x.ts']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['x.ts'] })
            .mockResolvedValueOnce({ type: 'feat', scope: '', summary: 'some', pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: false });
        (execSync as jest.Mock)
            .mockReturnValueOnce('x.ts\n')
            .mockReturnValueOnce('x.ts\n');
        (previewCommitMessage as jest.Mock).mockImplementation(() => { throw new Error('lint fail'); });
        await expect(program.parseAsync(['node', 'test', 'commit', '--lint'])).rejects.toThrow('lint fail');
        expect((execSync as jest.Mock).mock.calls.some(c => c[0].includes('git commit'))).toBe(false);
    });

    it('should skip lint, show preview, and abort if finalConfirm is false', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [{ value: 'feat' }],
            templates: { defaultTemplate: '[{type}]: {summary}' },
            steps: {}
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['abc']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['abc'] })
            .mockResolvedValueOnce({ type: 'feat', scope: '', summary: 'summary', pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: false })
            .mockResolvedValueOnce({ previewChoice: true })
            .mockResolvedValueOnce({ finalConfirm: false });
        (execSync as jest.Mock)
            .mockReturnValueOnce('abc\n')
            .mockReturnValueOnce('abc\n');
        await expect(program.parseAsync(['node', 'test', 'commit'])).resolves.not.toThrow();
        expect((execSync as jest.Mock).mock.calls.some(call => call[0].includes('git commit'))).toBe(false);
    });

    it('should commit and push if pushCommit=true', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [{ value: 'fix' }],
            templates: { defaultTemplate: '[{type}]: {summary}' },
            steps: {}
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['file']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['file'] })
            .mockResolvedValueOnce({ type: 'fix', scope: '', summary: 'fix something', pushCommit: true })
            .mockResolvedValueOnce({ diffPreview: false })
            .mockResolvedValueOnce({ previewChoice: false })
            .mockResolvedValueOnce({ finalConfirm: true });
        (execSync as jest.Mock)
            .mockReturnValueOnce('file\n')
            .mockReturnValueOnce('file\n')
            .mockReturnValueOnce('') // commit
            .mockReturnValueOnce(''); // push
        await program.parseAsync(['node', 'test', 'commit']);
        const calls = (execSync as jest.Mock).mock.calls;
        const commitCall = calls.find(c => c[0].includes('git commit -m'));
        expect(commitCall).toBeTruthy();
        expect(commitCall[0]).toMatch(/\[fix\]\: fix something/);
        const pushCall = calls.find(c => c[0] === 'git push');
        expect(pushCall).toBeTruthy();
    });

    it('should do git commit -S if --sign is true', async () => {
        (ensureGitRepo as jest.Mock).mockImplementation(() => { });
        (loadConfig as jest.Mock).mockReturnValue({
            autoAdd: false,
            commitTypes: [{ value: 'chore' }],
            templates: { defaultTemplate: '[{type}]: {summary}' },
            steps: {}
        });
        (getUnstagedFiles as jest.Mock).mockReturnValue(['xxx']);
        (loadGitignorePatterns as jest.Mock).mockReturnValue([]);
        (micromatch.isMatch as jest.Mock).mockReturnValue(false);
        (execSync as jest.Mock)
            .mockReturnValueOnce('xxx\n')
            .mockReturnValueOnce('xxx\n')
            .mockReturnValueOnce('');
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ files: ['xxx'] })
            .mockResolvedValueOnce({ type: 'chore', scope: '', summary: 'some chore', pushCommit: false })
            .mockResolvedValueOnce({ diffPreview: false })
            .mockResolvedValueOnce({ previewChoice: false })
            .mockResolvedValueOnce({ finalConfirm: true });
        await program.parseAsync(['node', 'test', 'commit', '--sign']);
        const calls = (execSync as jest.Mock).mock.calls;
        const commitCall = calls.find(c => c[0].includes('git commit -S -m'));
        expect(commitCall).toBeTruthy();
        expect(commitCall[0]).toMatch(/some chore/);
    });
});