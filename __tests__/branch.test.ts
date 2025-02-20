import { execSync } from 'child_process';
import { Command } from 'commander';
import { loadConfig } from '../src/utils';
import inquirer from 'inquirer';
import { registerBranchCommand, sanitizeForBranch } from '../src/commands/branch';

jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));
jest.mock('inquirer', () => ({
    prompt: jest.fn(),
}));
jest.mock('../src/utils', () => ({
    loadConfig: jest.fn(),
    ensureGitRepo: jest.fn(),
}));

describe('sanitizeForBranch', () => {
    it('should replace spaces with default separator and lowercase the input', () => {
        const input = 'My Custom Branch';
        const result = sanitizeForBranch(input);
        expect(result).toBe('my-custom-branch');
    });

    it('should not convert to lowercase if lowercase is set to false', () => {
        const input = 'My Custom Branch';
        const result = sanitizeForBranch(input, { lowercase: false });
        expect(result).toBe('My-Custom-Branch');
    });

    it('should replace spaces with a custom separator', () => {
        const input = 'My Custom Branch';
        const result = sanitizeForBranch(input, { separator: '_' });
        expect(result).toBe('my_custom_branch');
    });

    it('should collapse multiple separators if collapseSeparator is true', () => {
        const input = 'My   Custom    Branch';
        const result = sanitizeForBranch(input, { separator: '-', collapseSeparator: true });
        expect(result).toBe('my-custom-branch');
    });

    it('should not collapse separators if collapseSeparator is false', () => {
        const input = 'My   Custom    Branch';
        const result = sanitizeForBranch(input, { separator: '-', collapseSeparator: false });
        expect(result).toBe('my---custom----branch');
    });

    it('should truncate the result to the specified maxLength', () => {
        const input = 'this is a very long branch name that should be truncated';
        const result = sanitizeForBranch(input, { maxLength: 20 });
        expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should remove invalid characters', () => {
        const input = 'Branch@Name!#%';
        const result = sanitizeForBranch(input);
        expect(result).toBe('branchname');
    });
});

describe('registerBranchCommand', () => {
    let program: Command;

    beforeEach(() => {
        program = new Command();
        (execSync as jest.Mock).mockReset();
        (inquirer.prompt as unknown as jest.Mock).mockReset();
        (loadConfig as jest.Mock).mockReturnValue({
            branch: {
                template: "{type}/{ticketId}-{shortDesc}",
                types: [
                    { value: 'feat', description: 'Feature' },
                    { value: 'fix', description: 'Bug fix' }
                ],
                placeholders: {}
            }
        });
    });

    it('should create a branch with valid branch name using provided inputs', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'main' })
            .mockResolvedValueOnce({ type: 'feat' })
            .mockResolvedValueOnce({ ticketId: '123' })
            .mockResolvedValueOnce({ shortDesc: 'add login' })
            .mockResolvedValueOnce({ stayOnBranch: true });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const branchCommandCall = calls.find(call => call[0].includes('git checkout -b'));
        expect(branchCommandCall[0]).toMatch(/feat\/123-add-login/);
    });

    it('should handle "Manual input..." for base branch', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'Manual input...' })
            .mockResolvedValueOnce({ manualBranch: 'develop' })
            .mockResolvedValueOnce({ type: 'fix' })
            .mockResolvedValueOnce({ ticketId: '456' })
            .mockResolvedValueOnce({ shortDesc: 'bug fix' })
            .mockResolvedValueOnce({ stayOnBranch: true });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const branchCommandCall = calls.find(call => call[0].includes('git checkout -b'));
        expect(branchCommandCall[0]).toMatch(/fix\/456-bug-fix/);
    });

    it('should prompt for custom branch type when "CUSTOM_INPUT" is selected', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'main' })
            .mockResolvedValueOnce({ type: 'CUSTOM_INPUT' })
            .mockResolvedValueOnce({ customType: 'custom' })
            .mockResolvedValueOnce({ ticketId: '789' })
            .mockResolvedValueOnce({ shortDesc: 'custom branch' })
            .mockResolvedValueOnce({ stayOnBranch: true });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const branchCommandCall = calls.find(call => call[0].includes('git checkout -b'));
        expect(branchCommandCall[0]).toMatch(/custom\/789-custom-branch/);
    });

    it('should generate fallback branch name if final branch name is empty', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'main' })
            .mockResolvedValueOnce({ type: '' })
            .mockResolvedValueOnce({ ticketId: '' })
            .mockResolvedValueOnce({ shortDesc: '' })
            .mockResolvedValueOnce({ stayOnBranch: true });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const branchCommandCall = calls.find(call => call[0].includes('git checkout -b'));
        // new-branch-XXXX
        expect(branchCommandCall[0]).toMatch(/new-branch-\d+/);
    });

    it('should switch back to the base branch when user opts not to stay on the new branch', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'main' })
            .mockResolvedValueOnce({ type: 'feat' })
            .mockResolvedValueOnce({ ticketId: '123' })
            .mockResolvedValueOnce({ shortDesc: 'add feature' })
            .mockResolvedValueOnce({ stayOnBranch: false });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const switchBackCall = calls.find(call => call[0].includes('git checkout "') && !call[0].includes('-b'));
        expect(switchBackCall).toBeTruthy();
        expect(switchBackCall[0]).toMatch(/git checkout "main"/);
    });

    it('should handle empty manual input for base branch and not attempt to switch back if base branch is empty', async () => {
        (inquirer.prompt as unknown as jest.Mock)
            .mockResolvedValueOnce({ baseBranchChoice: 'Manual input...' })
            .mockResolvedValueOnce({ manualBranch: '    ' })
            .mockResolvedValueOnce({ type: 'fix' })
            .mockResolvedValueOnce({ ticketId: '456' })
            .mockResolvedValueOnce({ shortDesc: 'fix bug' })
            .mockResolvedValueOnce({ stayOnBranch: false });

        registerBranchCommand(program);
        await program.parseAsync(['node', 'test', 'branch']);

        const calls = (execSync as jest.Mock).mock.calls;
        const branchCommandCall = calls.find(call => call[0].includes('git checkout -b'));
        expect(branchCommandCall[0]).toMatch(/^git checkout -b "[^"]+"$/);

        const switchBackCall = calls.find(call => call[0].startsWith('git checkout "') && !call[0].includes('-b'));
        expect(switchBackCall).toBeUndefined();
    });
});