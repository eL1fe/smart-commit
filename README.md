# Smart Commit

![npm version](https://img.shields.io/npm/v/%40el1fe/smart-commit)
![npm downloads](https://img.shields.io/npm/dm/%40el1fe/smart-commit)
![license](https://img.shields.io/npm/l/%40el1fe/smart-commit)
![build](https://github.com/el1fe/smart-commit/actions/workflows/nodejs.yml/badge.svg)

Smart Commit is a highly customizable CLI utility for creating Git commits interactively. It helps you produce consistent, well-formatted commit messages and branch names that integrate seamlessly with your development workflow.

## Features

- **Interactive Prompts**
  - Customize which prompts appear during commit creation (commit type, scope, summary, body, footer, ticket, and CI tests).
  - Automatically suggest commit types based on staged changes.

- **Template-Based Commit Messages**
  - Define your commit message format using placeholders:
    - {type}: The commit type (e.g., feat, fix, docs, etc.)
    - {ticketSeparator}: A separator inserted if a ticket ID is provided.
    - {ticket}: The ticket ID (entered by the user or auto-extracted).
    - {summary}: A short summary of the commit.
    - {body}: A detailed description of the commit.
    - {footer}: Additional footer text.
    
- **CI Integration**
  - Optionally run a specified CI command (e.g., tests) before creating the commit.

- **Auto Ticket Extraction**
  - Automatically extract a ticket ID from the current branch name using a custom regular expression.

- **Push and Signed Commits**
  - Automatically push commits after creation using the --push flag.
  - Create GPG-signed commits with the --sign flag.

- **Commit Statistics and History Search**
  - View commit statistics as ASCII graphs (shortlog by author, activity graphs) with the `sc stats` command.
  - Search commit history by keyword, author, or date range using the `sc history` command.

- **Additional Commands**
  - **Amend:** Interactively edit the last commit message (with optional linting).
  - **Rollback:** Rollback the last commit, with options for soft (keeping changes staged) or hard (discarding changes) resets.
  - **Rebase Helper:** Launch an interactive rebase session with guidance on modifying recent commits.

- **Advanced Branch Creation**
  - **sc branch** creates a new branch from a base branch (or current HEAD) using a naming template and autocomplete.
  - **Universal Placeholders:** Use placeholders (e.g., {type}, {ticketId}, {shortDesc}, or any custom placeholder) in your branch template.
  - **Branch Type Selection:** Define a list of branch types in your configuration; if defined, you can select one or provide a custom input.
  - **Custom Sanitization Options:** For each placeholder, you can set custom sanitization rules:
    - **lowercase:** (default true) Converts the value to lowercase unless set to false.
    - **separator:** (default "-") Character to replace spaces.
    - **collapseSeparator:** (default true) Collapses multiple consecutive separators into one.
    - **maxLength:** Limits the maximum length of the sanitized value.
  - The branch name is built from the template by replacing placeholders with sanitized inputs. Extraneous separators are removed, and if the final branch name is empty, a random fallback name is generated.
  - After branch creation, you are prompted whether to remain on the new branch or switch back to the base branch.

## Commands

- **sc commit (or sc c)**
  - Initiates the interactive commit process.
  - Prompts for commit type, scope, summary, body, footer, ticket, and CI test execution.
  - Supports manual file staging or auto-add, GPG signing (--sign), and pushing (--push).
  - Applies commit message linting if enabled.
  - **Linting Behavior and Overrides:**

    By default, commit message linting is disabled (i.e. `enableLint` is set to `false` in your configuration). This means that if you don’t specify any command‑line flag, your commit will be created without linting the message.

    If you want to enable linting for a specific commit—even if your configuration has it disabled—you can pass the `--lint` flag. Conversely, if linting is enabled in your configuration but you want to skip it for one commit, you can pass the standard Commander flag `--no-lint` (which sets the option to false).

    For example:

    ```bash
    sc commit --lint
    sc commit --no-lint
    ```

    The command‑line flags override the configuration settings, giving you flexibility on a per‑commit basis.

- **sc amend**
  - Opens the last commit message in your default editor for amendment.
  - Validates the amended message using linting rules (if enabled) before updating the commit.

- **sc rollback**
  - Rolls back the last commit.
  - Offers a choice between a soft reset (keep changes staged) or a hard reset (discard changes).

- **sc rebase-helper (or sc rebase)**
  - Launches an interactive rebase session.
  - Guides you through modifying recent commits with options like pick, reword, edit, squash, fixup, exec, and drop.

- **sc stats**
  - Displays commit statistics as ASCII graphs.
  - Choose between a shortlog by author or an activity graph over a specified period (Day, Week, Month).

- **sc history**
  - Searches commit history.
  - Offers search options by keyword, author, or date range.
  - Provides different view modes via interactive prompt:
    - **All commits:** Shows complete commit history
    - **Current branch only:** Shows commits unique to the current branch

- **sc config (or sc cfg)**
  - View and update Smart Commit settings.
  - Reset Configuration
  - Configure options such as:
    - Auto-add (automatically stage changes)
    - Emoji usage in commit type prompts
    - CI command
    - Commit message template
    - Prompt toggles for scope, body, footer, ticket, and CI
    - Ticket extraction regex
    - Commit linting rules
    - Branch configuration (template, types, and custom sanitization options)
  - **Examples:**
    - Enable auto-add: `sc config --auto-add true`
    - Set CI command: `sc config --ci-command "npm test"`
    - View current configuration: `sc config`
    - Reset configuration to default: `sc config --reset`

- **sc setup**
  - Launches an interactive setup wizard to configure your Smart Commit preferences step by step.
  - Walks you through each configuration option.

- **sc branch (or sc b)**
  - Creates a new branch from a base branch (or current HEAD) using a naming template and autocomplete.
  - **Key Features:**
    - **Universal Placeholders:** Customize branch names with placeholders such as {type}, {ticketId}, {shortDesc}, or any custom placeholder.
    - **Branch Type Selection:** If branch types are defined in the configuration, you can select from a list or enter a custom type.
    - **Custom Sanitization Options:** For each placeholder, set options to control:
      - Conversion to lowercase (default true)
      - Replacement of spaces with a specific separator (default "-")
      - Collapsing of consecutive separators (default true)
      - Maximum length of the sanitized value
    - **Final Name Assembly:** Constructs the branch name from the template by replacing placeholders with sanitized values and cleaning extraneous separators.
    - **Fallback Mechanism:** Generates a random branch name if the final name is empty.
    - **Stay on Branch Prompt:** After creation, decide whether to remain on the new branch or switch back to the base branch.

## Configuration File

Global configuration is stored in your home directory as `~/.smart-commit-config.json`. To override these settings for a specific project, create a `.smartcommitrc.json` file in the project root. Use the `sc setup` or `sc config` commands to modify your settings.

### Detailed Configuration Options

| Option                         | Type    | Default                                                                                                   | Description                                                                                                                                                             | Example                          |
|--------------------------------|---------|-----------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------|
| **commitTypes**                | Array   | List of commit types (feat, fix, docs, style, refactor, perf, test, chore)                                 | Each type includes an emoji, a value, and a description used in commit prompts.                                                                                         | [{"emoji": "✨", "value": "feat", "description": "A new feature"}, ...] |
| **autoAdd**                    | Boolean | false                                                                                                     | If true, automatically stage all changed files before committing.                                                                                                     | true                             |
| **useEmoji**                   | Boolean | true                                                                                                      | If true, display emojis in commit type prompts.                                                                                                                       | false                            |
| **ciCommand**                  | String  | ""                                                                                                        | Command to run CI tests before committing.                                                                                                                             | "npm test"                       |
| **templates.defaultTemplate**  | String  | "[{type}]{ticketSeparator}{ticket}: {summary}\n\nBody:\n{body}\n\nFooter:\n{footer}"                      | Template for commit messages; placeholders are replaced with user input or auto-generated content.                                                                     | "[{type}]: {summary}"             |
| **steps.scope**                | Boolean | false                                                                                                     | Whether to prompt for a commit scope.                                                                                                                                   | true                             |
| **steps.body**                 | Boolean | false                                                                                                     | Whether to prompt for a detailed commit body.                                                                                                                           | true                             |
| **steps.footer**               | Boolean | false                                                                                                     | Whether to prompt for additional footer information.                                                                                                                  | true                             |
| **steps.ticket**               | Boolean | false                                                                                                     | Whether to prompt for a ticket ID. If enabled and left empty, the ticket may be auto-extracted using the regex.                                                         | true                             |
| **steps.runCI**                | Boolean | false                                                                                                     | Whether to prompt for running CI tests before committing.                                                                                                             | true                             |
| **ticketRegex**                | String  | ""                                                                                                        | Regular expression for extracting a ticket ID from the branch name.                                                                                                    | "^(DEV-\\d+)"                   |
| **enableLint**                 | Boolean | false                                                                                                     | If true, enable commit message linting.                                                                                                                               | true                             |
| **lintRules.summaryMaxLength** | Number  | 72                                                                                                        | Maximum allowed length for the commit summary.                                                                                                                        | 72                               |
| **lintRules.typeCase**         | String  | "lowercase"                                                                                               | Required case for the first character of the commit summary.                                                                                                          | "lowercase"                      |
| **lintRules.requiredTicket**   | Boolean | false                                                                                                     | If true, a ticket ID is required in the commit message.                                                                                                               | true                             |
| **branch.template**            | String  | "{type}/{ticketId}-{shortDesc}"                                                                           | Template for branch names; supports placeholders replaced by user input.                                                                                                | "{type}/{ticketId}-{shortDesc}"  |
| **branch.types**               | Array   | List of branch types (feature, fix, chore, hotfix, release, dev)                                            | Provides options for branch types during branch creation.                                                                                                             | [{"value": "feature", "description": "New feature"}, ...]  |
| **branch.placeholders**        | Object  | { ticketId: { lowercase: false } }                                                                        | Custom sanitization options for branch placeholders. Options include: lowercase (default true), separator (default "-"), collapseSeparator (default true), maxLength. | {"ticketId": {"lowercase": false}} |

### Example Local Configuration File (.smartcommitrc.json)

```json
{
  "autoAdd": true,
  "useEmoji": true,
  "ciCommand": "npm test",
  "templates": {
    "defaultTemplate": "[{type}]: {summary}"
  },
  "steps": {
    "scope": true,
    "body": true,
    "footer": true,
    "ticket": true,
    "runCI": true
  },
  "ticketRegex": "^(DEV-\\d+)",
  "enableLint": true,
  "lintRules": {
    "summaryMaxLength": 72,
    "typeCase": "lowercase",
    "requiredTicket": true
  },
  "branch": {
    "template": "{type}/{ticketId}-{shortDesc}",
    "types": [
      { "value": "feature", "description": "New feature" },
      { "value": "fix", "description": "Bug fix" },
      { "value": "chore", "description": "Chore branch" },
      { "value": "hotfix", "description": "Hotfix branch" },
      { "value": "release", "description": "Release branch" },
      { "value": "dev", "description": "Development branch" }
    ],
    "placeholders": {
      "ticketId": {
        "lowercase": false,
        "separator": "-",
        "collapseSeparator": true,
        "maxLength": 10
      }
    }
  }
}
```

## Custom Sanitization Options

When creating branch names, each placeholder can be sanitized using custom options defined in the configuration. The available options are:
- **lowercase:** Converts input to lowercase (default true; set to false to preserve original case).
- **separator:** Character to replace spaces (default is "-").
- **collapseSeparator:** If true, collapses multiple consecutive separator characters into one (default true).
- **maxLength:** Limits the maximum length of the sanitized string. Note that the fallback branch name (generated randomly) is appended and should be considered when setting this value.

## Installation

Install Smart Commit globally using npm:

```bash
npm install -g @el1fe/smart-commit
```

After installation, the commands `smart-commit` and `sc` will be available in your terminal.

## Installation via Homebrew

For macOS (and Linux with Homebrew), you can install Smart Commit using the Homebrew tap:

```bash
brew tap el1fe/homebrew-smart-commit
brew install smart-commit
```

This will download the pre-built binary from the GitHub Releases and install it as sc.

## Usage Examples

- **Creating a Commit:**

```bash
  sc commit [--push] [--sign]
```

- **Amending the Last Commit:**

```bash
  sc amend
```

- **Rolling Back the Last Commit:**

```bash
  sc rollback
```

- **Launching the Interactive Rebase Helper:**

```bash
  sc rebase-helper
```

- **Viewing Commit Statistics:**

```bash
  sc stats
```

- **Searching Commit History:**

```bash
  sc history
```

- **Configuring Settings:**
    
```bash
  sc config  
  sc setup
```

- **Creating a Branch:**

```bash
  sc branch  
```
  - Select the base branch via autocomplete or enter manually.
  - When prompted, choose a branch type from the list (if defined) or provide a custom value.
  - Enter values for placeholders (e.g., ticket ID, short description, or any custom placeholder).
  - The branch name is constructed from your branch template with custom sanitization applied.
  - After branch creation, choose whether to remain on the new branch or switch back to the base branch.

## Configuration File

Global configuration is stored in `~/.smart-commit-config.json`. To override global settings for a project, create a `.smartcommitrc.json` file in the project directory. Use the `sc setup` or `sc config` commands to update your settings.

### Detailed Configuration Options

- **commitTypes:** Array of commit types (each with emoji, value, and description).
- **autoAdd:** Boolean indicating whether changes are staged automatically.
- **useEmoji:** Boolean to enable emoji display in commit type prompts.
- **ciCommand:** Command to run CI tests before committing.
- **templates.defaultTemplate:** Template for commit messages.
- **steps:** Object with booleans for each prompt: scope, body, footer, ticket, and runCI.
- **ticketRegex:** Regular expression to extract a ticket ID from the branch name.
- **enableLint:** Boolean to enable commit message linting.
- **lintRules:** Object defining linting rules (summaryMaxLength, typeCase, requiredTicket).
- **branch:** Branch configuration including:
  - **template:** Template for branch names (e.g., "{type}/{ticketId}-{shortDesc}").
  - **types:** Array of branch types (each with value and description).
  - **placeholders:** Custom sanitization options for branch placeholders. For each placeholder, you can set:
    - **lowercase:** Whether to convert the value to lowercase (default true).
    - **separator:** Character to replace spaces (default "-").
    - **collapseSeparator:** Whether to collapse multiple separators (default true).
    - **maxLength:** Maximum length for the sanitized value.

## License

MIT

For more information and to contribute, please visit the GitHub repository.