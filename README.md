# Smart Commit

Smart Commit is a highly customizable CLI utility for creating Git commits interactively. It offers a range of features to help you produce consistent, well-formatted commit messages while integrating with your workflow. Below is a detailed overview of its features and commands:

## Features

- **Interactive Prompts:**
  - Customize which prompts appear during commit creation (commit type, scope, summary, body, footer, ticket, and CI tests).
  - Automatically suggest a commit type based on staged changes.

- **Template-Based Commit Message:**
  - Define your commit message format using placeholders:
    - {type}: Commit type (e.g., feat, fix, docs, etc.)
    - {scope}: Optional scope (if enabled)
    - {ticket}: Ticket ID (if provided or auto-extracted)
    - {ticketSeparator}: Separator inserted if a ticket is provided
    - {summary}: Commit summary (short description)
    - {body}: Detailed commit message body (if enabled)
    - {footer}: Additional footer information (if enabled)

- **CI Integration:**
  - Optionally run a CI command before executing a commit.

- **Auto Ticket Extraction:**
  - Extract a ticket ID from your branch name using a custom regular expression (if configured).

- **Push Support:**
  - Automatically push commits to the remote repository using the --push flag.

- **Signed Commits:**
  - Create GPG-signed commits using the --sign flag.

- **Commit Statistics:**
  - View commit statistics (e.g., Git shortlog by author or commit activity with ASCII graphs) using the `sc stats` command.

- **Commit History Search:**
  - Search your commit history by:
    - Keyword in commit messages
    - Author name or email
    - Date range
  - Use the `sc history` command for flexible commit searching.

- **Additional Commands:**
  - **Amend:** Interactively amend the last commit, with optional linting support.
  - **Rollback:** Rollback the last commit with an option for a soft reset (keeping changes staged) or a hard reset (discarding changes).
  - **Rebase Helper:** Launch an interactive rebase helper that provides in-editor instructions for modifying recent commits.

- **Local and Global Configuration:**
  - Global configuration is stored in your home directory as ~/.smart-commit-config.json.
  - Override global settings for a specific project by creating a .smartcommitrc.json file in the project root.
  - Configure settings such as auto-add, emoji usage, CI command, commit message template, prompt toggles (scope, body, footer, ticket, CI), linting rules, and ticket extraction regex via the `sc config` command or the interactive setup (`sc setup`).

- **Commit Message Linting:**
  - Optionally enable linting to enforce rules such as maximum summary length, lowercase starting character in the summary, and ticket inclusion when required.

## Commands

- **sc commit (or sc c):**
  - Start the interactive commit process.
  - Prompts for commit type, scope, summary, body, footer, ticket, CI tests, and staging changes.
  - Supports auto-add, signed commits, and CI integration.

- **sc amend:**
  - Amend the last commit interactively.
  - Opens the current commit message in your default editor for modifications.
  - Validates the amended commit message with linting rules if enabled.

- **sc rollback:**
  - Rollback the last commit.
  - Offers a choice between a soft reset (keeping changes staged) and a hard reset (discarding changes).

- **sc rebase-helper:**
  - Launch an interactive rebase helper.
  - Provides instructions and options (pick, reword, edit, squash, fixup, drop) for modifying recent commits.

- **sc stats:**
  - Display commit statistics.
  - Options include viewing a shortlog by author or commit activity graphs over a selected period (day, week, month).

- **sc history:**
  - Search commit history with flexible options.
  - Choose to search by a keyword in commit messages, by author, or by a date range.

- **sc config (or sc cfg):**
  - View and update global Smart Commit settings.
  - Configure options such as auto-add, emoji usage, CI command, commit message template, prompt settings, linting, and ticket extraction regex.

- **sc setup:**
  - Run the interactive setup wizard to configure your Smart Commit preferences.

## Installation

Install Smart Commit globally via npm:

```bash
npm install -g smart-commit
```

After installation, the commands smart-commit and the alias sc will be available in your terminal.

## Usage Examples

- Creating a commit:

```bash
sc commit [--push] [--sign]
```

- Amending the last commit:

```bash
sc amend
```

- Rolling back the last commit:

```bash
sc rollback
```

- Launching the interactive rebase helper:

```bash
sc rebase-helper
```

- Viewing commit statistics:

```bash
sc stats
```

- Searching commit history:

```bash
sc history
```

- Configuring settings:

```bash
sc config
sc setup
```

## Configuration File

Global settings are stored in ~/.smart-commit-config.json. You can override these settings locally by creating a .smartcommitrc.json file in your project directory. To configure Smart Commit, run `sc setup` or you can use the `sc config` command to manually edit the configuration file.

### Configuration Options

Below is a table explaining each configuration option available in Smart Commit, along with their types, default values, descriptions, and examples.

| Option                         | Type     | Default                                                                                                  | Description                                                                                                          | Example                          |
|--------------------------------|----------|----------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|----------------------------------|
| **commitTypes**                | Array    | See default list below:<br> • feat: "A new feature"<br> • fix: "A bug fix"<br> • docs: "Documentation changes"<br> • style: "Code style improvements"<br> • refactor: "Code refactoring"<br> • perf: "Performance improvements"<br> • test: "Adding tests"<br> • chore: "Maintenance and chores" | List of available commit types, each with an emoji, a value, and a description.                                     | `[{"emoji": "✨", "value": "feat", "description": "A new feature"}, ...]`  |
| **autoAdd**                    | Boolean  | false                                                                                                    | If set to true, all changes will be staged automatically before creating a commit.                                   | true                             |
| **useEmoji**                   | Boolean  | true                                                                                                     | Determines whether emojis are displayed in the commit type selection prompt.                                         | false                            |
| **ciCommand**                  | String   | ""                                                                                                       | Command to run CI tests before committing. If provided, CI tests will run automatically when prompted.                | "npm test"                       |
| **templates.defaultTemplate**  | String   | `[{type}]{ticketSeparator}{ticket}: {summary}\n\nBody:\n{body}\n\nFooter:\n{footer}`                     | Template used to format the commit message. Placeholders will be replaced with user-provided or auto-generated content.   | `"[{type}]: {summary}"`           |
| **steps.scope**                | Boolean  | false                                                                                                    | Whether to prompt for a commit scope (an optional field).                                                            | true                             |
| **steps.body**                 | Boolean  | false                                                                                                    | Whether to prompt for a detailed commit body.                                                                        | true                             |
| **steps.footer**               | Boolean  | false                                                                                                    | Whether to prompt for additional commit footer information.                                                          | true                             |
| **steps.ticket**               | Boolean  | false                                                                                                    | Whether to prompt for a ticket ID. If enabled and left empty, ticket ID might be auto-extracted using the regex.        | true                             |
| **steps.runCI**                | Boolean  | false                                                                                                    | Whether to prompt for running CI tests before committing.                                                            | true                             |
| **ticketRegex**                | String   | ""                                                                                                       | A regular expression used to extract a ticket ID from the current branch name.                                         | `"^(DEV-\\d+)"`                  |
| **enableLint**                 | Boolean  | false                                                                                                    | Enables commit message linting based on specified linting rules.                                                      | true                             |
| **lintRules.summaryMaxLength** | Number   | 72                                                                                                       | Maximum allowed length for the commit summary.                                                                       | 72                               |
| **lintRules.typeCase**         | String   | "lowercase"                                                                                              | Specifies the required case for the first character of the commit summary.                                            | "lowercase"                      |
| **lintRules.requiredTicket**   | Boolean  | false                                                                                                    | If true, a ticket ID is required in the commit message.                                                              | true                             |

### Example of a Local Configuration File (`.smartcommitrc.json`)

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
  }
}
```

## License

MIT