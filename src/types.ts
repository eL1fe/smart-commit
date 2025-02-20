import { Question } from "inquirer";

export type InputQuestion = Question & { type: 'input' };
export type ListQuestion = Question & { type: 'list' };
export type ConfirmQuestion = Question & { type: 'confirm' };
export type EditorQuestion = Question & { type: 'editor' };
export type AutocompleteQuestion = Question & { type: 'autocomplete'; source: (answersSoFar: any, input: string) => Promise<string[]> };

export interface CommitType {
    emoji: string;
    value: string;
    description: string;
}

export interface Templates {
    defaultTemplate: string;
}

export interface LintRules {
    summaryMaxLength: number;
    typeCase: string; // e.g. 'lowercase'
    requiredTicket: boolean;
}

export interface BranchType {
    value: string;
    description: string;
}

export interface PlaceholderConfig {
    lowercase?: boolean;
    separator?: string;
    collapseSeparator?: boolean;
    maxLength?: number;
}

export interface BranchConfig {
    template: string; // e.g. "{type}/{ticketId}-{shortDesc}"
    types: BranchType[];
    placeholders?: Record<string, PlaceholderConfig>;
}

export interface Config {
    commitTypes: CommitType[];
    autoAdd: boolean;
    useEmoji: boolean;
    ciCommand: string;
    templates: Templates;
    steps: {
        scope: boolean;
        body: boolean;
        footer: boolean;
        ticket: boolean;
        runCI: boolean;
    };
    ticketRegex: string;
    enableLint: boolean;
    lintRules: LintRules;
    branch?: BranchConfig;
    // enableHooks: boolean; // TODO: implement hooks
}