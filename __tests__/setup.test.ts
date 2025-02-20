import { Command } from 'commander';
import inquirer from 'inquirer';
import { registerSetupCommand } from '../src/commands/setup';
import { defaultConfig } from '../src/utils';
import { Config } from '../src/types';

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));
jest.mock('../src/utils', () => ({
  saveConfig: jest.fn(),
  defaultConfig: {
    autoAdd: false,
    ciCommand: "npm test",
    templates: { defaultTemplate: "[{type}]: {summary}" },
    steps: { scope: false, body: false, footer: false, ticket: false, runCI: false },
    ticketRegex: "",
    enableLint: false,
    branch: {
      template: "{type}/{ticketId}-{shortDesc}",
      types: [],
      placeholders: {},
    },
  },
}));

describe('registerSetupCommand', () => {
  let program: Command;
  let promptMock: jest.Mock;
  let saveConfigMock: jest.Mock;

  beforeEach(() => {
    program = new Command();
    registerSetupCommand(program);
    promptMock = (inquirer.prompt as unknown) as jest.Mock;
    saveConfigMock = require('../src/utils').saveConfig;
    promptMock.mockReset();
    saveConfigMock.mockReset();
  });

  it('should run through setup and save config without branch config', async () => {
    promptMock.mockResolvedValueOnce({
      enableScope: true,
      enableBody: false,
      enableFooter: false,
      enableTicket: true,
      enableRunCi: false,
      ticketRegex: "ABC-\\d+",
      template: "[{type}]: {summary}",
      autoAdd: true,
      ciCommand: "yarn test",
      enableLint: true,
      enableBranchConfig: false,
    });
    await program.parseAsync(['setup'], { from: 'user' });
    const expectedConfig: Config = {
      ...defaultConfig,
      autoAdd: true,
      ciCommand: "yarn test",
      templates: { defaultTemplate: "[{type}]: {summary}" },
      steps: {
        scope: true,
        body: false,
        footer: false,
        ticket: true,
        runCI: false,
      },
      ticketRegex: "ABC-\\d+",
      enableLint: true,
    };
    expect(saveConfigMock).toHaveBeenCalledWith(expectedConfig);
  });

  it('should run through setup with branch config and parse branch types and placeholders', async () => {
    const branchTypesJson = `[
      {"value": "feature", "description": "New feature"},
      {"value": "fix", "description": "Bug fix"}
    ]`;
    const branchPlaceholdersJson = `{
      "ticketId": {"lowercase": true}
    }`;
    promptMock.mockResolvedValueOnce({
      enableScope: false,
      enableBody: true,
      enableFooter: true,
      enableTicket: true,
      enableRunCi: true,
      ticketRegex: "XYZ-\\d+",
      template: "[{ticket}]{ticketSeparator}[{type}]: {summary}",
      autoAdd: false,
      ciCommand: "npm run ci",
      enableLint: false,
      enableBranchConfig: true,
      branchTemplate: "{type}/{ticketId}-{shortDesc}",
      addBranchTypes: true,
      branchTypes: branchTypesJson,
      addPlaceholders: true,
      branchPlaceholders: branchPlaceholdersJson,
    });
    await program.parseAsync(['setup'], { from: 'user' });
    const expectedConfig: Config = {
      ...defaultConfig,
      autoAdd: false,
      ciCommand: "npm run ci",
      templates: { defaultTemplate: "[{ticket}]{ticketSeparator}[{type}]: {summary}" },
      steps: {
        scope: false,
        body: true,
        footer: true,
        ticket: true,
        runCI: true,
      },
      ticketRegex: "XYZ-\\d+",
      enableLint: false,
      branch: {
        template: "{type}/{ticketId}-{shortDesc}",
        types: JSON.parse(branchTypesJson),
        placeholders: JSON.parse(branchPlaceholdersJson),
      },
    };
    expect(saveConfigMock).toHaveBeenCalledWith(expectedConfig);
  });

  it('should ignore branch types JSON if parsing fails', async () => {
    promptMock.mockResolvedValueOnce({
      enableScope: false,
      enableBody: false,
      enableFooter: false,
      enableTicket: false,
      enableRunCi: false,
      ticketRegex: "",
      template: "[{type}]: {summary}",
      autoAdd: false,
      ciCommand: "",
      enableLint: false,
      enableBranchConfig: true,
      branchTemplate: "{type}/{ticketId}-{shortDesc}",
      addBranchTypes: true,
      branchTypes: "invalid json",
      addPlaceholders: false,
    });
    await program.parseAsync(['setup'], { from: 'user' });
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      branch: {
        template: "{type}/{ticketId}-{shortDesc}",
        types: defaultConfig.branch?.types,
        placeholders: defaultConfig.branch?.placeholders,
      }
    }));
  });

  it('should ignore branch placeholders JSON if parsing fails', async () => {
    promptMock.mockResolvedValueOnce({
      enableScope: false,
      enableBody: false,
      enableFooter: false,
      enableTicket: false,
      enableRunCi: false,
      ticketRegex: "",
      template: "[{type}]: {summary}",
      autoAdd: false,
      ciCommand: "",
      enableLint: false,
      enableBranchConfig: true,
      branchTemplate: "{type}/{ticketId}-{shortDesc}",
      addBranchTypes: false,
      addPlaceholders: true,
      branchPlaceholders: "not a json",
    });
    await program.parseAsync(['setup'], { from: 'user' });
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      branch: {
        template: "{type}/{ticketId}-{shortDesc}",
        types: defaultConfig.branch?.types,
        placeholders: defaultConfig.branch?.placeholders,
      }
    }));
  });

  it('should save config using default values for unanswered questions', async () => {
    promptMock.mockResolvedValueOnce({
      enableScope: false,
      enableBody: false,
      enableFooter: false,
      enableTicket: false,
      enableRunCi: false,
      ticketRegex: "",
      template: "",
      autoAdd: false,
      ciCommand: "",
      enableLint: false,
      enableBranchConfig: false,
    });
    await program.parseAsync(['setup'], { from: 'user' });
    expect(saveConfigMock).toHaveBeenCalledWith({
      ...defaultConfig,
      autoAdd: false,
      ciCommand: defaultConfig.ciCommand,
      templates: { defaultTemplate: defaultConfig.templates.defaultTemplate },
      steps: {
        scope: false,
        body: false,
        footer: false,
        ticket: false,
        runCI: false,
      },
      ticketRegex: "",
      enableLint: false,
    });
  });

  it('should log "Setup complete!" after saving config', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    promptMock.mockResolvedValueOnce({
      enableScope: false,
      enableBody: false,
      enableFooter: false,
      enableTicket: false,
      enableRunCi: false,
      ticketRegex: "",
      template: "[{type}]: {summary}",
      autoAdd: false,
      ciCommand: "",
      enableLint: false,
      enableBranchConfig: false,
    });
    await program.parseAsync(['setup'], { from: 'user' });
    expect(consoleLogSpy).toHaveBeenCalledWith("Setup complete!");
    consoleLogSpy.mockRestore();
  });
});