# Smart Commit

**Smart Commit** is a highly customizable CLI utility for creating Git commits interactively. It provides an easy-to-use interactive prompt that helps you produce consistent, well-formatted commit messages. The tool includes advanced features such as:

- **Interactive Prompts:** Enable or disable prompts for commit type, scope, summary, body, footer, ticket, and CI tests.
- **Template-Based Commit Message:** Customize your commit message template using placeholders:
  - {type}: Commit type (e.g., feat, fix, etc.)
  - {scope}: Optional scope
  - {summary}: Commit summary
  - {body}: Detailed commit body
  - {footer}: Optional footer
  - {ticket}: Ticket ID
  - {ticketSeparator}: Separator inserted if a ticket is provided
- **CI Integration:** Optionally run a CI command before committing.
- **Auto Ticket Extraction:** Extract a ticket ID from your branch name using a custom regex.
- **Push Support:** Use the --push flag to automatically push the commit to the remote repository after creation.
- **Automatic Commit Type Suggestion:** The tool analyzes staged changes and suggests an appropriate commit type based on modified files.
- **Signed Commits:** Use the --sign flag to create GPG-signed commits.
- **Commit Statistics:** The sc stats command shows commit statistics for the last week.
- **Local Configuration:** Global settings are stored in ~/.smart-commit-config.json. To override these for a specific project, create a file named .smartcommitrc.json in your project directory.
- **Interactive Setup:** Run sc setup to configure your preferences interactively.

## Installation

Simply install Smart Commit globally via npm:

```bash
npm install -g smart-commit
```
After installation, the commands smart-commit and the short alias sc will be available in your terminal.

## Usage

### Creating a Commit

Run the command:

```bash
sc commit [--push] [--sign]
```

You will be prompted for:
- **Commit Type:** Choose from the list. The tool may automatically suggest a type based on staged changes.
- **Scope:** (If enabled) Enter an optional scope.
- **Summary:** A short commit summary (auto-generated by default but editable).
- **Body:** (If enabled) Your default editor will open for a detailed message.
- **Footer:** (If enabled) Additional commit footer information.
- **Ticket:** (If enabled), which can be auto-extracted from the branch name if configured.
- **Run CI tests:** (If enabled) Run the configured CI command before committing.
- **Stage all changes:** (Auto-add) Stage all changes before creating the commit.
- **Confirm:** Confirm and execute the commit.

Additional flags:
- --push: After the commit, automatically push it to the remote repository.
- --sign: Create a GPG-signed commit.

### Running CI Tests Manually

```bash
sc ci
```

### Viewing Commit Statistics

```bash
sc stats
```

This command displays commit statistics (using Git shortlog) for the last week.

## Configuration

### Global Configuration

Global settings are stored in your home directory as ~/.smart-commit-config.json.

To view or update settings, run:

```bash
sc config
```

For example, to enable the ticket prompt and set a regex for ticket extraction:

```bash
sc config --enable-ticket true --ticket-regex "^(DEV-\\d+)"
```

### Interactive Setup

Run the interactive setup wizard to configure your preferences:

```bash
sc setup
```

This wizard will prompt you for:
- Enabling/disabling prompts (scope, body, footer, ticket, CI)
- Setting the ticket extraction regex
- Defining the commit message template
- Enabling auto-add
- Setting the CI command

### Local Configuration

To use project-specific settings, create a file named .smartcommitrc.json in your project's root directory. This file will override the global configuration (~/.smart-commit-config.json) for that project.

## Configuration File Example

The global configuration is stored in your home directory as ~/.smart-commit-config.json. A sample configuration:

```json
{
  "commitTypes": [
    { "emoji": "✨", "value": "feat", "description": "A new feature" },
    { "emoji": "🐛", "value": "fix", "description": "A bug fix" },
    { "emoji": "📝", "value": "docs", "description": "Documentation changes" },
    { "emoji": "💄", "value": "style", "description": "Code style improvements" },
    { "emoji": "♻️", "value": "refactor", "description": "Code refactoring" },
    { "emoji": "🚀", "value": "perf", "description": "Performance improvements" },
    { "emoji": "✅", "value": "test", "description": "Adding tests" },
    { "emoji": "🔧", "value": "chore", "description": "Maintenance and chores" }
  ],
  "autoAdd": false,
  "useEmoji": true,
  "ciCommand": "npm test",
  "templates": {
    "defaultTemplate": "[{type}]{ticketSeparator}{ticket}: {summary}\n\nBody:\n{body}\n\nFooter:\n{footer}"
  },
  "steps": {
    "scope": false,
    "body": false,
    "footer": false,
    "ticket": false,
    "runCI": false
  },
  "ticketRegex": ""
}
```

You can manually edit this file or use sc config / sc setup to update it.

## License

[MIT](LICENSE)