import { Command } from 'commander';
import { registerConfigCommand } from '../src/commands/config';
import { loadConfig, saveConfig } from '../src/utils';

jest.mock('../src/utils', () => ({
    loadConfig: jest.fn(),
    saveConfig: jest.fn()
}));

jest.mock('chalk', () => ({
    ...jest.requireActual('chalk'),
    blue: jest.fn((str) => str),
    red: jest.fn((str) => str),
    green: jest.fn((str) => str),
}));

describe('registerConfigCommand', () => {
    let program: Command;
    let mockLoadConfig: jest.Mock;
    let mockSaveConfig: jest.Mock;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        program = new Command();
        registerConfigCommand(program);

        mockLoadConfig = loadConfig as jest.Mock;
        mockSaveConfig = saveConfig as jest.Mock;

        mockLoadConfig.mockReturnValue({
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
                runCI: false
            },
            ticketRegex: "",
            enableLint: false,
            lintRules: {
                summaryMaxLength: 72,
                typeCase: "lowercase",
                requiredTicket: false
            },
            commitTypes: [
                { emoji: "✨", value: "feat", description: "A new feature" },
                { emoji: "🐛", value: "fix", description: "A bug fix" }
            ],
            branch: {
                template: "{type}/{ticketId}-{shortDesc}",
                types: [
                    { value: "feature", description: "New feature" },
                    { value: "fix", description: "Bug fix" }
                ],
                placeholders: {
                    ticketId: { lowercase: false }
                }
            }
        });

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.resetAllMocks();
    });

    it('prints current config if no flags are passed', async () => {
        await program.parseAsync(['node', 'test', 'config']);

        expect(saveConfig).not.toHaveBeenCalled();

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Current configuration:"));
    });

    it('updates autoAdd when passing --auto-add true', async () => {
        await program.parseAsync(['node', 'test', 'config', '--auto-add', 'true']);

        expect(mockLoadConfig).toHaveBeenCalled();
        expect(saveConfig).toHaveBeenCalledTimes(1);
        const updatedConfig = (saveConfig as jest.Mock).mock.calls[0][0];
        expect(updatedConfig.autoAdd).toBe(true);
    });

    it('updates multiple fields in one go', async () => {
        await program.parseAsync([
            'node',
            'test',
            'config',
            '--auto-add',
            'true',
            '--enable-body',
            'true',
            '--enable-run-ci',
            'true',
            '--ci-command',
            'npm run test'
        ]);
        expect(saveConfig).toHaveBeenCalledTimes(1);
        const updatedConfig = (saveConfig as jest.Mock).mock.calls[0][0];
        expect(updatedConfig.autoAdd).toBe(true);
        expect(updatedConfig.steps.body).toBe(true);
        expect(updatedConfig.steps.runCI).toBe(true);
        expect(updatedConfig.ciCommand).toBe('npm run test');
    });

    it('parses valid JSON in --branch-type and updates config', async () => {
        const validJson = '[{"value":"hotfix","description":"Hotfix branch"}]';
        await program.parseAsync(['node', 'test', 'config', '--branch-type', validJson]);
        expect(saveConfig).toHaveBeenCalledTimes(1);
        const updatedConfig = (saveConfig as jest.Mock).mock.calls[0][0];
        expect(updatedConfig.branch.types).toEqual([
            { value: "hotfix", description: "Hotfix branch" }
        ]);
    });

    it('logs error if invalid JSON in --branch-type', async () => {
        const invalidJson = '{"not":"an array"}';
        await program.parseAsync(['node', 'test', 'config', '--branch-type', invalidJson]);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining("branch-type JSON must be an array of objects!")
        );
        expect(saveConfig).not.toHaveBeenCalled();
    });

    it('parses valid JSON in --branch-placeholder and updates config', async () => {
        const validJson = '{"ticketId": {"maxLength":10,"separator":"_"}}';
        await program.parseAsync(['node', 'test', 'config', '--branch-placeholder', validJson]);
        expect(saveConfig).toHaveBeenCalledTimes(1);
        const updatedConfig = (saveConfig as jest.Mock).mock.calls[0][0];
        expect(updatedConfig.branch.placeholders).toEqual({
            ticketId: { maxLength: 10, separator: "_" }
        });
    });

    it('logs error if invalid JSON in --branch-placeholder', async () => {
        const invalidJson = 'not valid json...';
        await program.parseAsync(['node', 'test', 'config', '--branch-placeholder', invalidJson]);

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const [firstArg, secondArg] = consoleErrorSpy.mock.calls[0];

        expect(firstArg).toContain("Invalid JSON for --branch-placeholder:");
        expect(secondArg).toBeInstanceOf(SyntaxError);

        expect(saveConfig).not.toHaveBeenCalled();
    });

    it('updates enableLint if passed --enable-lint true', async () => {
        await program.parseAsync(['node', 'test', 'config', '--enable-lint', 'true']);
        expect(saveConfig).toHaveBeenCalledTimes(1);
        const updatedConfig = (saveConfig as jest.Mock).mock.calls[0][0];
        expect(updatedConfig.enableLint).toBe(true);
    });
});