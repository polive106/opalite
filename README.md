# opalite

Terminal-based PR review and fix tool for Bitbucket Cloud.

Review pull requests, browse diffs, leave comments, and approve — all without leaving your terminal.

## Features

**Reviewer mode** — A dashboard showing open PRs across all your repos.

- PR list grouped by repository with age color-coding
- Side-by-side and unified diff viewer
- File tree sidebar with comment count badges
- Inline comments and threaded replies
- Approve or request changes directly from the terminal
- Auto-refresh and keyboard-driven navigation

**Author mode** — Focus on your own PRs and unresolved comments.

- View your open PRs with unresolved comment counts
- Queue of comments that need your attention
- AI agent integration (Claude Code or Cursor) to auto-fix review comments

## Requirements

- [Bun](https://bun.sh) >= 1.2.0
- macOS or Linux
- A [Bitbucket Cloud](https://bitbucket.org) account with an API token

## Installation

### Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/polive106/opalite/main/install.sh | bash
```

This will install Bun (if needed) and set up opalite globally.

### Manual install

```bash
bun install -g opalite
```

## Getting started

### 1. Log in to Bitbucket

```bash
opalite login
```

You'll be prompted to create an API token at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens). The token needs these scopes:

- `read:user:bitbucket`
- `read:workspace:bitbucket`
- `read:repository:bitbucket`
- `write:repository:bitbucket`
- `read:pullrequest:bitbucket`
- `write:pullrequest:bitbucket`

### 2. Initialize a repository

```bash
opalite init
```

This interactive wizard lets you select your workspace and the repositories you want to track. It creates a `.opalite.yml` config in your project root.

### 3. Open the dashboard

```bash
opalite
```

## Usage

```
opalite [command]

Commands:
  (none)      Open the review dashboard
  login       Log in to Bitbucket Cloud
  logout      Log out and remove stored credentials
  init        Initialize opalite in the current repository
  my          Show your open PRs (author mode)
  update      Check for and install updates

Options:
  --version, -v   Print version
  --help, -h      Print help
```

## Configuration

opalite uses two config files:

**`.opalite.yml`** — Shared team config (commit this to your repo):

```yaml
workspace: my-workspace
repos:
  - api
  - frontend
```

**`~/.config/opalite/config.yml`** — Personal config (local overrides):

```yaml
workspace: my-workspace
repos:
  - api
  - frontend
agent: claude          # or "cursor-agent"
autoRefreshInterval: 30000
```

Credentials are stored separately in `~/.config/opalite/auth.json`, managed by `opalite login` and `opalite logout`.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` | Open selected PR |
| `Esc` | Go back |
| `r` | Refresh |
| `?` | Show help |

## Tech stack

- **Runtime:** [Bun](https://bun.sh)
- **Language:** TypeScript (strict mode)
- **TUI framework:** [OpenTUI](https://github.com/msmps/opentui)
- **API:** Bitbucket Cloud REST API v2.0
- **AI agents:** Claude Code CLI / Cursor CLI (optional)

## Development

```bash
git clone https://github.com/polive106/opalite.git
cd opalite
bun install
bun run src/index.tsx   # run locally
bun test                # run tests
bun test --watch        # run tests in watch mode
```

## License

[MIT](LICENSE)
