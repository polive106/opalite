# opalite

Terminal-based PR review and fix tool for **Bitbucket Cloud**.

Review pull requests, browse diffs, leave comments, approve, and fix review feedback — all without leaving your terminal. Optionally pair with an AI agent (Claude Code or Cursor) to refine your review comments and auto-fix incoming feedback on your own PRs.

---

## Table of contents

- [Why opalite?](#why-opalite)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [AI agent integration](#ai-agent-integration)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Tech stack](#tech-stack)
- [Development](#development)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Why opalite?

If your team uses Bitbucket Cloud, the web UI for code review is fine — but slow to navigate, hard to script, and forces a context switch out of your editor. opalite brings the whole review loop into the terminal:

- **For reviewers**: a unified dashboard across every repo, fast keyboard navigation, and an AI agent that turns terse drafts into clear, constructive feedback.
- **For authors**: a single queue of unresolved comments across all your open PRs, and one keystroke to spawn an agent that fixes a comment, shows the diff, and commits + pushes.

No API keys, no shared secrets — opalite uses a per-developer Bitbucket API token and the agent CLI you already have installed.

## Features

### Reviewer mode (default)

- **Multi-repo dashboard** — open PRs across every repo configured in `.opalite.yml`, grouped by repo
- **Age color-coding** — yellow after 24h, red after 48h (configurable)
- **File tree sidebar** with per-file comment count badges
- **Side-by-side or unified diff view** with syntax highlighting
- **Inline comments and threaded replies** posted straight to Bitbucket
- **Approve / request changes** from the diff screen, with optional general comment
- **AI comment refinement (optional)** — when you write a review comment, an agent rewrites it for clarity. Accept, edit, give feedback, or skip
- **Auto-refresh** — configurable polling, with TanStack Query caching to avoid loading flicker

### Author mode (`opalite my`)

- **Your PRs only** — open PRs where you are the author, with unresolved comment counts and reviewer status
- **Comment fix queue** — a single list of every unresolved comment across your PRs
- **One-key agent fix** — `f` runs the configured agent on a single comment, `F` batch-fixes all comments on a PR
- **Resolve, reply, copy-to-clipboard** — manage comments without opening the browser

## Requirements

- [Bun](https://bun.sh) >= 1.2.0 (the install script will set this up if missing)
- macOS or Linux
- A [Bitbucket Cloud](https://bitbucket.org) account with an API token
- (Optional) [Claude Code CLI](https://docs.claude.com/en/docs/agents-and-tools/claude-code/overview) or [Cursor CLI](https://docs.cursor.com/cli) for AI features

## Installation

### Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/polive106/opalite/main/install.sh | bash
```

This will install Bun (if needed), install opalite globally, and add Bun's global bin directory to your `PATH` (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`).

### Manual install

```bash
bun install -g opalite
```

Verify the install:

```bash
opalite --version
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

opalite validates the token by calling `GET /2.0/user` and saves your credentials to `~/.config/opalite/auth.json`. Run `opalite logout` to remove them.

### 2. Initialize a repository

From the root of any repo you want to track:

```bash
opalite init
```

The interactive wizard:

1. Lets you pick a Bitbucket workspace (fetched live from your account)
2. Lists every repo in that workspace — toggle with `Space`, select all with `a`
3. Detects available AI agent CLIs (`claude`, `cursor-agent`) and lets you pick one (or skip)
4. Writes `.opalite.yml` (shared, commit it) and optionally updates `~/.config/opalite/config.yml` (personal)

### 3. Open the dashboard

```bash
opalite          # reviewer dashboard
opalite my       # author mode (your PRs)
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

opalite checks for new releases on startup (non-blocking, 2s timeout) and prints a one-line notice if an update is available.

## Workflows

### Reviewer: review a PR end-to-end

1. `opalite` — dashboard opens, PRs grouped by repo
2. `j` / `k` to move, `Enter` to open the PR
3. `Tab` to focus the diff pane, `n` / `N` to jump between files, `j` / `k` to scroll
4. `c` to leave an inline comment on the current line. If an agent is configured, your draft is sent for refinement — press `Enter` to accept the suggestion, `e` to edit it, `r` to give the agent feedback, or `s` to skip
5. `r` to reply to an existing thread
6. `u` toggles split / unified diff
7. `a` to approve or `x` to request changes — confirm on the next screen with an optional summary
8. `Esc` or `b` to step back, `q` to quit

### Author: fix incoming review feedback

1. `opalite my` — your open PRs with unresolved comment counts
2. `j` / `k`, `Enter` on a PR to open its comment queue
3. On any comment: `f` to spawn the agent for just that comment, or `F` to batch-fix every unresolved comment on the PR
4. `r` to reply, `v` to mark resolved, `e` to copy the agent prompt to your clipboard (handy if you'd rather paste it into a different tool)
5. `b` or `Esc` to go back, `d` to jump to the reviewer dashboard

## Configuration

opalite reads from two files and merges them, with **shared values winning** when both are set. Credentials are stored separately.

### `.opalite.yml` — shared team config (commit this)

```yaml
workspace: my-workspace
repos:
  - api
  - frontend
  - mobile
autoRefreshInterval: 30000   # ms, 0 to disable
```

### `~/.config/opalite/config.yml` — personal config (do not commit)

```yaml
workspace: my-workspace      # optional override
repos:                       # optional override
  - api
agent:
  default: claude-code
  claude-code:
    interactive: claude "{prompt}"
    print: claude --print "{prompt}"
    print_json: claude --print --output-format json "{prompt}"
  cursor:
    interactive: agent "{prompt}"
    print: agent -p "{prompt}"
    print_json: agent -p --output-format json "{prompt}"
```

### `~/.config/opalite/auth.json` — credentials

Auto-managed by `opalite login` / `opalite logout`. Don't edit by hand.

```json
{
  "email": "you@example.com",
  "api_token": "ATAT...",
  "user": {
    "username": "you",
    "display_name": "Your Name"
  }
}
```

## AI agent integration

opalite never calls Claude or any LLM directly — it shells out to whichever agent CLI you have installed. That means **no API keys, no usage billing through opalite**, and the agent inherits the auth and project context already on your machine.

The agent config has three command templates per agent:

| Template | Used for |
|----------|----------|
| `interactive` | Author mode `f` / `F` — opens an interactive agent session in the terminal |
| `print` | Reviewer comment refinement — captures stdout for non-interactive use |
| `print_json` | Reserved for structured output (future use) |

`{prompt}` is replaced with the actual prompt at runtime. If `print` is missing, AI comment refinement is silently disabled and your draft is posted as-is.

Run `opalite init` and select an agent to have the wizard write a sensible default block for you.

## Keyboard shortcuts

### Dashboard (reviewer)

| Key | Action |
|-----|--------|
| `j` / `↓` | Next PR |
| `k` / `↑` | Previous PR |
| `Enter` | Open PR diff |
| `r` | Refresh |
| `m` | Switch to author mode |
| `q` | Quit |

### DiffNav (PR diff view)

| Key | Action |
|-----|--------|
| `Tab` | Toggle focus: file tree ↔ diff |
| `j` / `k` | Move in tree, or scroll diff |
| `n` / `N` | Next / previous file |
| `u` | Toggle split / unified view |
| `c` | Comment on current line (inline) |
| `r` | Reply to selected thread |
| `a` | Approve PR |
| `x` | Request changes |
| `b` / `Esc` | Back to dashboard |
| `q` | Quit |

### Comment refinement (during `c`, when an agent is configured)

| Key | Action |
|-----|--------|
| `Enter` | Accept the suggestion and post |
| `e` | Edit the suggestion before posting |
| `r` | Give feedback to the agent and re-refine |
| `s` | Skip refinement, post your original draft |
| `Esc` | Cancel the comment entirely |

### MyPRs (author mode)

| Key | Action |
|-----|--------|
| `j` / `↓` / `k` / `↑` | Navigate PRs |
| `Enter` | Open comment queue for selected PR |
| `r` | Refresh |
| `d` | Back to reviewer dashboard |
| `q` | Quit |

### Comment queue

| Key | Action |
|-----|--------|
| `j` / `↓` / `k` / `↑` | Navigate comments |
| `f` | Fix selected comment with agent |
| `F` | Batch-fix all comments |
| `r` | Reply to selected comment |
| `v` | Resolve selected comment |
| `e` | Copy agent prompt to clipboard |
| `b` / `Esc` | Back |
| `q` | Quit |

### Init wizard

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate options |
| `Space` | Toggle repo selection |
| `a` | Select / deselect all repos |
| `Enter` | Confirm |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) >= 1.2.0 |
| Language | TypeScript (strict) |
| TUI framework | [OpenTUI](https://github.com/msmps/opentui) (`@opentui/core` + `@opentui/react`) |
| Data fetching | [TanStack Query](https://tanstack.com/query) v5 |
| API | Bitbucket Cloud REST API v2.0 (Basic auth) |
| AI agents | Claude Code CLI / Cursor CLI (optional, configurable) |
| Config format | YAML (`yaml` package) |

## Development

```bash
git clone https://github.com/polive106/opalite.git
cd opalite
bun install
bun run src/index.tsx        # run locally against your real Bitbucket account
bun test                     # run all tests
bun test --watch             # TDD mode
```

The codebase follows a **feature-sliced** structure — every feature lives in `src/features/<name>/{hooks,widgets,ui}/`. See [CLAUDE.md](CLAUDE.md) for the full architecture, testing layers (hooks → widgets → integration), and the TanStack Query patterns we use for caching and optimistic updates.

### Project layout (high level)

```
src/
├── index.tsx              # CLI entry — arg parsing + renderer setup
├── App.tsx                # Screen router
├── cli.ts                 # Arg parsing
├── commands/              # login, logout, init, update, authGuard
├── features/
│   ├── dashboard/         # Reviewer mode
│   ├── diff-review/       # PR diff + comments + approve/request changes
│   ├── author-mode/       # MyPRs
│   ├── comment-queue/     # Author mode comment queue
│   ├── init/              # Init wizard
│   └── shared/            # Cross-feature hooks + widgets
├── services/              # bitbucket, auth, agent, config, queryClient, prompt, update
├── theme/                 # Tokyo Night by default
└── types/                 # Domain + API types
```

## Contributing

We use **TDD (red-green-refactor)** — write the failing test first. See [CLAUDE.md](CLAUDE.md) for the full testing strategy and conventions.

### Workflow

1. Branch from `main`
2. Write a failing test
3. Make it pass with the minimum code
4. Refactor while green
5. **Add a changeset** (required — there's a hook that blocks commits without one):

   Create a markdown file in `.changeset/` with any descriptive name:

   ```md
   ---
   "opalite": patch
   ---

   Short description of what changed.
   ```

   Bump types: `patch` (fixes), `minor` (features / new stories), `major` (breaking).

6. Open a PR — releases are cut by `npx changeset version` after merge.

### House rules

- **Bun only** — `Bun.spawn()` for subprocesses, `bun add` for dependencies (never edit `package.json` by hand)
- **Strict TypeScript** — no `any`, no `as` casts unless unavoidable
- **No API keys in source** — AI features use the user's installed agent CLI
- **Stay in scope** — don't refactor unrelated code in feature PRs
- **Stories** — feature work is tracked in `docs/stories/US-*.md`; the AI review epic lives at `docs/epics/EP-01-ai-assisted-review.md`

## Troubleshooting

**`Your API token has expired.`**
Run `opalite login` again to issue and store a new token.

**`Agent not found.`**
Either the agent CLI isn't on your `PATH` or the command in `~/.config/opalite/config.yml` is wrong. Run `opalite init` again to re-detect, or fix the `agent.<name>.print` template manually.

**Nothing happens when I press `c` to comment.**
Make sure the diff pane has focus — press `Tab` to switch from the file tree to the diff. The cursor must be on a changed line.

**The dashboard is empty.**
Check `.opalite.yml` — `workspace` must match the Bitbucket workspace slug exactly, and `repos` must contain repo slugs (not display names). Open `https://bitbucket.org/<workspace>/<repo>` in a browser to verify.

**`opalite` command not found after install.**
Bun's global bin directory isn't on your `PATH`. Run `bun pm bin -g` to find it and add it to your shell profile (the install script does this automatically for bash/zsh/fish).

## License

[MIT](LICENSE)
