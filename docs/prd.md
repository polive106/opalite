# opalite — Product Requirements Document

> This document is the single source of truth for building opalite.
> It is designed to be fed to Claude Code as a project spec.

---

## What is opalite?

opalite is a terminal-based PR review and fix tool for Bitbucket Cloud. It has two modes:

1. **Reviewer mode** — A dashboard showing all open PRs across multiple repos (inspired by gh-dash). Browse diffs, leave comments, and approve — all from the terminal. When writing review comments, an AI agent (Claude Code / Cursor CLI) refines your draft into clearer, more constructive feedback through a conversational loop. After your manual review, the AI does a second pass to catch anything you missed.
2. **Author mode** — Shows unresolved comments on your own PRs. Press `f` to spawn an AI agent (Claude Code or Cursor CLI) that fixes the comment. Review the agent's diff, accept, and auto-commit+push — without leaving the terminal.

---

## Tech stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| TUI framework | OpenTUI | latest | `@opentui/core` + `@opentui/react` |
| Runtime | Bun | >= 1.2.0 | Required by OpenTUI |
| Language | TypeScript | strict mode | JSX via `@opentui/react` |
| API | Bitbucket Cloud REST API v2.0 | — | API token (Basic auth: email + token) |
| AI agents | Claude Code CLI / Cursor CLI | — | Configurable, no API keys needed |
| Config | YAML | — | `.opalite.yml` (shared) + `~/.config/opalite/config.yml` (local) |

### OpenTUI setup

```bash
bun create tui --template react
bun add @opentui/core @opentui/react react
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "strict": true,
    "skipLibCheck": true
  }
}
```

**Entry point pattern:**
```tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"

function App() {
  return <box><text>Hello opalite</text></box>
}

const renderer = await createCliRenderer({ exitOnCtrlC: true, useAlternateScreen: true })
createRoot(renderer).render(<App />)
```

### Important: Install the OpenTUI skill

Before writing any OpenTUI code, install the OpenTUI skill for AI coding assistants:

```bash
npx skills add msmps/opentui-skill
```

This provides comprehensive API documentation for all OpenTUI components including `<box>`, `<text>`, `<code>`, `<diff>`, `<scroll-box>`, `<select>`, `<input>`, `useKeyboard()`, `useTerminalDimensions()`, and more.

---

## Project structure

```
opalite/
├── src/
│   ├── index.tsx                  # Entry: createCliRenderer + createRoot
│   ├── App.tsx                    # Screen router (manages current screen state)
│   │
│   ├── screens/                   # Compose widgets + hooks — wiring layer
│   │   ├── Dashboard.tsx          # Mode 1: PR review dashboard
│   │   ├── DiffNav.tsx            # Mode 1: File tree + split diff review
│   │   ├── ReviewSubmit.tsx       # Mode 1: Post review to Bitbucket
│   │   ├── MyPRs.tsx              # Mode 2: Author's open PRs
│   │   ├── CommentQueue.tsx       # Mode 2: Unresolved comments list
│   │   └── AgentFix.tsx           # Mode 2: Agent diff review
│   │
│   ├── widgets/                   # Pure presentational components (NO business logic)
│   │   ├── PRRow.tsx              # Single PR list item
│   │   ├── FileTree.tsx           # Sidebar file navigator
│   │   ├── CommentList.tsx        # Inline comments display
│   │   ├── CommentEditor.tsx      # Add/reply to comments
│   │   ├── AgentStatus.tsx        # Agent progress indicator
│   │   └── KeyBar.tsx             # Bottom keybinding help bar
│   │
│   ├── hooks/                     # Business logic (testable in isolation)
│   │   ├── usePRs.ts              # Fetch + poll PRs from Bitbucket
│   │   ├── useDiff.ts             # Fetch + parse diffs (remote, from Bitbucket)
│   │   ├── useLocalDiff.ts        # Git diff for agent changes (local)
│   │   └── useAgent.ts            # Agent spawn, status, and query
│   │
│   ├── services/
│   │   ├── auth.ts                # API token login, validation, logout
│   │   ├── bitbucket.ts           # Bitbucket REST API client
│   │   ├── agent.ts               # Agent CLI wrapper (interactive + print modes)
│   │   ├── prompt.ts              # Generate agent prompts (fix, review, comment)
│   │   ├── git.ts                 # Local git operations (diff, commit, push)
│   │   ├── update.ts              # Startup version check + `opalite update`
│   │   ├── clipboard.ts           # Cross-platform clipboard
│   │   └── config.ts              # YAML config loader + merger
│   │
│   ├── theme/
│   │   └── tokyo-night.ts         # Default color theme
│   │
│   └── types/
│       ├── bitbucket.ts           # Bitbucket API response types
│       ├── agent.ts               # Agent config types
│       └── review.ts              # Domain types (PR, Comment, Review, etc.)
│
├── __tests__/                     # Feature sliced test architecture
│   ├── unit/
│   │   ├── hooks/                 # Hook tests — business logic in isolation
│   │   └── services/              # Service tests — external integrations
│   ├── widgets/                   # Widget tests — pure rendering, no logic
│   └── integration/               # Integration tests — hook + widget wired together
│
├── install.sh                     # Installer script
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .opalite.yml                   # Example shared config
└── README.md
```

### Testing architecture

Development follows **Red-Green-Refactor** (TDD). Every feature starts with a failing test.

The codebase uses **feature sliced design** to test each layer in isolation:

| Layer | Location | What it contains | Tested in |
|-------|----------|-----------------|-----------|
| **Hooks** | `src/hooks/` | Business logic, state, data fetching | `__tests__/unit/hooks/` |
| **Widgets** | `src/widgets/` | Pure presentational components (props in, JSX out) | `__tests__/widgets/` |
| **Screens** | `src/screens/` | Composition of widgets + hooks | `__tests__/integration/` |
| **Services** | `src/services/` | External integrations (API, git, auth) | `__tests__/unit/services/` |

- **Widgets never contain business logic** — they receive data and callbacks via props.
- **Hooks never render UI** — they return state and functions.
- **Screens wire hooks to widgets** — this composition is tested in integration tests.
- **Integration tests inject a hook into a widget** and simulate user interactions to verify UI behavior end-to-end.

---

## Phase 1: Review Dashboard (MVP — build this first)

### Goal

Users can see all open PRs across configured Bitbucket repos, grouped by repository, color-coded by age. This is the "make the backlog visible" phase.

### 1.1 — CLI entry point and routing

**`src/index.tsx`** — Parse CLI args and render the app:

```
opalite          → Dashboard screen
opalite my       → MyPRs screen
opalite login    → OAuth login (opens browser)
opalite logout   → Remove stored auth
opalite init     → Setup wizard (workspace, repos, agent)
opalite update   → Run `bun install -g opalite@latest`
opalite config   → Open config in $EDITOR
opalite --help   → Print help
```

**Startup version check:** On every launch, check GitHub for the latest version in the background (non-blocking). If a newer version exists, show a one-line notice before rendering the TUI:

```
  opalite v0.2.0 available (current: v0.1.3) — run `opalite update` to upgrade
```

Implementation in `src/services/update.ts`:

```typescript
const REPO = "your-org/opalite"

async function checkForUpdate(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: AbortSignal.timeout(2000), // don't slow startup — 2s max
    })
    const data = await res.json()
    const latest = data.tag_name.replace(/^v/, "")  // "v0.2.0" → "0.2.0"
    const current = require("../../package.json").version
    if (latest !== current) return latest
  } catch {
    // Network error, offline, rate limited — silently ignore
  }
  return null
}
```

`opalite update` re-runs the install script:
```typescript
Bun.spawn(["bash", "-c", `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`])
```

**`src/App.tsx`** — Screen router using React state:

```tsx
type Screen =
  | { name: "dashboard" }
  | { name: "diffnav"; pr: PR }
  | { name: "review-submit"; pr: PR }
  | { name: "my-prs" }
  | { name: "comment-queue"; pr: PR }
  | { name: "agent-fix"; pr: PR; comment: Comment }
```

Use `useState<Screen>` and pass a `navigate` function to all screens.

### 1.2 — Config system

**Two config files, merged at startup:**

1. `.opalite.yml` — in repo root (committed, shared team config)
2. `~/.config/opalite/config.yml` — local per-user (NOT committed)

Local config overrides shared config. Use `yaml` npm package for parsing.

**Shared config (`.opalite.yml`):**
```yaml
# workspace is auto-detected from the logged-in user's account

repositories:
  - semble-api
  - semble-frontend
  - semble-ai-toolkit

display:
  theme: tokyo-night
  diff_view: split
  age_thresholds:
    warning: 24h     # turns yellow
    critical: 48h    # turns red

commit:
  template: "fix: {summary} (PR #{pr_id})"
  auto_push: true
```

**Local config (`~/.config/opalite/config.yml`):**
```yaml
# Auth is managed via `opalite login` — stored in auth.json, not here

agent:
  default: claude-code
  claude-code:
    interactive: claude {prompt}
    print: claude --print {prompt}
    print_json: claude --print --output-format json {prompt}
  cursor:
    interactive: agent {prompt}
    print: agent -p {prompt}
    print_json: agent -p --output-format json {prompt}
```

### 1.3 — Authentication: `opalite login`

Each developer creates a personal Bitbucket API token and pastes it into the CLI. No admin setup, no OAuth consumers, no shared secrets.

**Flow when user runs `opalite login`:**

```
$ opalite login

  To connect to Bitbucket, you need an API token.

  1. Open: https://id.atlassian.com/manage-profile/security/api-tokens
  2. Click "Create API token"
  3. Select Bitbucket, set permissions: Repositories (Read), Pull Requests (Read + Write)
  4. Copy the token

  Atlassian email: pierre@semble.com
  API token: ••••••••••••

  ✅ Logged in as Pierre (pierre)
  Token saved to ~/.config/opalite/auth.json
```

**Implementation (`src/services/auth.ts`):**

1. Print instructions with the link to create a token
2. Prompt for Atlassian email
3. Prompt for API token (hidden input)
4. Validate token starts with `ATAT` prefix — if not, show a helpful error
5. Test the credentials via `GET /2.0/user` using Basic auth (`email:token`)
6. On success, fetch user info (username, display_name, workspaces)
7. Save to `~/.config/opalite/auth.json`
8. Print success message

**Auth file (`~/.config/opalite/auth.json` — auto-managed):**
```json
{
  "email": "pierre@semble.com",
  "api_token": "ATAT...",
  "user": {
    "username": "pierre",
    "display_name": "Pierre"
  }
}
```

**How API calls authenticate:**

Bitbucket API tokens use Basic HTTP auth where the username is the Atlassian email and the password is the API token:

```typescript
function getAuthHeader(auth: AuthConfig): string {
  return `Basic ${btoa(`${auth.email}:${auth.api_token}`)}`
}

async function bbFetch(path: string, options?: RequestInit): Promise<Response> {
  const auth = loadAuthFile()
  return fetch(`https://api.bitbucket.org/2.0${path}`, {
    ...options,
    headers: {
      "Authorization": getAuthHeader(auth),
      "Accept": "application/json",
      ...options?.headers,
    },
  })
}
```

**`opalite logout`:** Deletes `~/.config/opalite/auth.json`.

**Note on token expiry:** API tokens have an expiry date set at creation (max 1 year). If a request returns 401, opalite should show a clear message: "Your API token has expired. Run `opalite login` to add a new one."

### 1.4 — Setup: `opalite init`

After logging in, user runs `opalite init` to pick workspace and repos. This is a NON-TUI interactive CLI wizard (plain stdin prompts, not OpenTUI).

Steps:
1. Check auth — if not logged in, prompt to run `opalite login` first
2. Fetch user's workspaces via `GET /2.0/workspaces`
3. If multiple, let user select one. If only one, auto-select
4. List all repos in workspace, let user select which to watch (checkboxes)
5. **Agent detection + setup** (see below)
6. Save config to `~/.config/opalite/config.yml`
7. Print "Run `opalite` to start"

**Step 5 — Agent detection logic:**

Check if known agent CLIs are available in PATH:

```typescript
import { which } from "bun"

async function detectAgents(): Promise<{ claude: boolean; cursor: boolean }> {
  return {
    claude: !!(await which("claude")),
    cursor: !!(await which("agent")) || !!(await which("cursor-agent")),  // "agent" is primary, "cursor-agent" is legacy alias
  }
}
```

Then handle each scenario:

**Both found:**
```
  AI Agent
  ────────────────────────────────────
  ✅ Claude Code detected (claude)
  ✅ Cursor CLI detected (agent)

  Which agent should opalite use by default?
  (●) Claude Code
  ( ) Cursor CLI
```

**Only one found:**
```
  AI Agent
  ────────────────────────────────────
  ✅ Claude Code detected (claude)
  ✗  Cursor CLI not found (agent)

  Using Claude Code as your AI agent.
```

**Neither found:**
```
  AI Agent
  ────────────────────────────────────
  ✗  Claude Code not found (claude)
  ✗  Cursor CLI not found (agent)

  opalite uses an AI agent for features like fixing review
  comments and suggesting code reviews. You can install one now
  or skip and add one later.

  (1) Install Claude Code
      curl -fsSL https://claude.ai/install.sh | bash

  (2) Install Cursor CLI
      curl -fsSL https://cursor.com/install | bash

  (3) Skip — I'll set it up later

  Choose [1/2/3]:
```

If user picks (1) or (2), opalite runs the install command, then re-checks detection. If the agent is now found, confirm and continue. If install failed, show the manual install URL and continue without an agent.

**After init, opalite works without an agent** — the AI features (fix comment, AI review suggestions) are simply disabled. The dashboard, diff viewing, and manual commenting all work fine without one. When a user tries an AI feature without an agent configured, show:

```
  No AI agent configured. Run one of:
    curl -fsSL https://claude.ai/install.sh | bash    # Claude Code
    curl -fsSL https://cursor.com/install | bash       # Cursor CLI
  Then run: opalite config
```

### 1.5 — Bitbucket API client

**File: `src/services/bitbucket.ts`**

Use Bitbucket Cloud REST API v2.0. Base URL: `https://api.bitbucket.org/2.0`

Auth: Basic auth with `email:api_token`. Use `bbFetch()` wrapper from `auth.ts`.

**Required endpoints:**

```typescript
// List open PRs for a repo
GET /repositories/{workspace}/{repo_slug}/pullrequests?state=OPEN

// Get a single PR
GET /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}

// Get PR diff
GET /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/diff

// Get PR comments
GET /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/comments

// Post a comment
POST /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/comments

// Approve a PR
POST /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/approve

// Request changes (post a comment with the review status)
POST /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/request-changes

// Unapprove
DELETE /repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/approve
```

**Response types to define in `src/types/bitbucket.ts`:**

```typescript
interface BitbucketPR {
  id: number
  title: string
  description: string
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED"
  source: { branch: { name: string }; repository: { full_name: string } }
  destination: { branch: { name: string } }
  author: { display_name: string; nickname: string }
  participants: Array<{
    user: { display_name: string; nickname: string }
    role: "PARTICIPANT" | "REVIEWER" | "AUTHOR"
    approved: boolean
    state: "approved" | "changes_requested" | null
  }>
  comment_count: number
  created_on: string
  updated_on: string
  links: { diff: { href: string }; html: { href: string } }
}

interface BitbucketComment {
  id: number
  content: { raw: string; markup: string; html: string }
  user: { display_name: string; nickname: string }
  created_on: string
  updated_on: string
  inline?: {
    path: string
    from?: number  // old line
    to?: number    // new line
  }
  parent?: { id: number }
  deleted: boolean
  resolved?: boolean  // Available via activity endpoint
}
```

**Pagination:** Bitbucket uses `next` URL in response. Implement auto-pagination.

### 1.5 — Dashboard screen

**File: `src/screens/Dashboard.tsx`**

Layout:
```
┌─ opalite ─────────────────────────────────── workspace ──┐
│                                                           │
│  Open PRs across {workspace}                 ⟳ 2 min ago │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  {repo-name}                                              │
│  ▸ {color} #{id}  {title}                     {age}      │
│         {files} files · +{add} -{del} · {author} · 💬 {n}│
│                                                           │
│  ... more repos ...                                       │
│                                                           │
│  ─────────────────────────────────────────────────────    │
│  {total} PRs open · oldest: {days} · avg: {days}         │
│                                                           │
│  ↑↓ navigate  ⏎ review  m my PRs  r refresh  q quit     │
└───────────────────────────────────────────────────────────┘
```

**Behavior:**
- Fetch all open PRs across all configured repos on mount
- Group PRs by repository
- Sort repos alphabetically, PRs by age (oldest first)
- Color-code PR age: green (< warning threshold), yellow (< critical), red (>= critical)
- Show comment count and unresolved count if available
- `↑/↓` or `j/k` — navigate PR list
- `⏎` (Enter) — open DiffNav for selected PR
- `m` — switch to MyPRs screen
- `r` — refresh (re-fetch all PRs)
- `q` — quit
- Auto-refresh every 2 minutes (configurable)

**Components used:**
- `<box>` — layout container with flexbox
- `<text>` — PR metadata, repo headers
- `<scroll-box>` — scrollable PR list
- `useKeyboard()` — navigation
- `useTerminalDimensions()` — responsive layout

**Custom hook: `usePRs(config)`**
- Fetches open PRs from all configured repos in parallel
- Returns `{ prs: PR[], loading: boolean, error: string | null, refresh: () => void }`
- Implements polling with configurable interval
- Groups by repo

### 1.6 — KeyBar component

**File: `src/widgets/KeyBar.tsx`**

A bottom bar showing available keybindings for the current screen. Accepts an array of `{ key: string, label: string }` and renders them horizontally.

```tsx
<KeyBar bindings={[
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "review" },
  { key: "m", label: "my PRs" },
  { key: "r", label: "refresh" },
  { key: "q", label: "quit" },
]} />
```

### 1.7 — Theme

**File: `src/theme/tokyo-night.ts`**

```typescript
export const theme = {
  bg: "#1a1b26",
  fg: "#a9b1d6",
  accent: "#7aa2f7",
  green: "#9ece6a",
  yellow: "#e0af68",
  red: "#f7768e",
  dimmed: "#565f89",
  border: "#3b4261",
  comment: "#bb9af7",
  selection: "#283457",
}
```

---

## Phase 2: Inline Review

### Goal

Users can view diffs, leave comments, and approve/request changes on a PR — full review workflow from the terminal.

### 2.1 — DiffNav screen

**File: `src/screens/DiffNav.tsx`**

Two-panel layout: file tree sidebar + diff viewer.

```
┌─ PR #{id}: {title} ─── {repo} ──────────────────────────────┐
│  {author} · {source} → {dest} · {age}                        │
├──────────────┬────────────────────────────────────────────────┤
│ 📁 Files ({n}) │  {filepath}                         +{a} -{d}│
│ ────────────── │                                               │
│ ● file1.ts    │     OLD                    │    NEW            │
│ ○ file2.ts    │  38│ old code              │ 38│ new code      │
│ ○ file3.ts    │  39│ ...                   │ 39│ ...           │
│               │                                                │
│ ────────────── │──────────────────────────────────────────────  │
│ 💬 comments   │  💬 Author (L40): comment text                 │
├──────────────┴────────────────────────────────────────────────┤
│  Tab tree  ↑↓ scroll  n/N file  c comment  a approve  x chg  │
└───────────────────────────────────────────────────────────────┘
```

**Components:**
- `<box flexDirection="row">` — sidebar + main split
- `<diff viewMode="split">` or `<diff viewMode="unified">` — OpenTUI's native diff component
- `<code filetype="typescript">` — syntax highlighted code
- `<scroll-box>` — scrollable diff and file tree
- `useKeyboard()` — navigation

**Keybindings:**
- `Tab` — toggle file tree focus
- `↑/↓` or `j/k` — scroll diff
- `n/N` — next/previous file
- `u` — toggle unified/split view
- `c` — open comment editor at current line
- `a` — approve PR (posts approval to Bitbucket)
- `x` — request changes
- `b` or `Esc` — back to dashboard

**Custom hook: `useDiff(pr)`**
- Fetches diff from Bitbucket API
- Parses unified diff format into file-level chunks
- Returns `{ files: DiffFile[], loading, error }`

### 2.2 — Comment editor

**File: `src/widgets/CommentEditor.tsx`**

An inline text input that appears when pressing `c` on a diff line. Posts the comment to Bitbucket via API.

Uses OpenTUI's `<input>` component for text entry.

- `Enter` — submit comment
- `Esc` — cancel
- `Tab` — AI comment suggestion (Phase 4, stub for now)

### 2.3 — ReviewSubmit screen

**File: `src/screens/ReviewSubmit.tsx`**

After reviewing, user can submit their review:

- `<select>` — choose: Comment / Request Changes / Approve
- `<input>` — optional general comment
- `Enter` — submit to Bitbucket
- `Esc` — go back

---

## Phase 3: Author Mode — Agent Fix

### Goal

PR authors can view comments on their PRs, spawn an AI agent to fix each comment, review the agent's diff, and accept+commit+push — all from the terminal.

### 3.1 — MyPRs screen

**File: `src/screens/MyPRs.tsx`**

Lists the current user's open PRs with comment counts.

- Filter PRs where `author.nickname === config.bitbucket.username`
- Show comment count and unresolved count
- Show reviewer statuses (approved, changes requested, pending)
- `⏎` — open CommentQueue for selected PR
- `d` — switch back to Dashboard

### 3.2 — CommentQueue screen

**File: `src/screens/CommentQueue.tsx`**

Shows all unresolved comments on a PR as a "fix queue."

Each comment shows:
- Author and file:line
- Comment text
- Code context (few lines around the commented line)

**Keybindings:**
- `f` — fix selected comment with agent (→ AgentFix screen)
- `F` — fix ALL comments with agent (batch mode)
- `r` — reply to comment
- `✓` — mark as resolved
- `e` — export prompt to clipboard
- `b` — back

### 3.3 — Agent service

**File: `src/services/agent.ts`**

```typescript
interface AgentConfig {
  interactive: string   // template: "claude {prompt}"
  print: string         // template: "claude --print {prompt}"
  printJson: string     // template: "claude --print --output-format json {prompt}"
}

// Replace {prompt} placeholder in template and spawn
function buildCommand(template: string, prompt: string): string[]

// Interactive mode: agent edits files in terminal, user sees it
async function spawnAgentInteractive(prompt: string, config: AgentConfig): Promise<void>

// Non-interactive: capture text output
async function queryAgent(prompt: string, config: AgentConfig): Promise<string>

// Non-interactive: capture JSON output
async function queryAgentJSON<T>(prompt: string, config: AgentConfig): Promise<T>
```

Use `Bun.spawn()` for all process spawning.

### 3.4 — Prompt generation

**File: `src/services/prompt.ts`**

**Single comment fix:**
```
Fix the following code review comment on PR #{id} "{title}"
(branch: {sourceBranch}).

## Comment
Author: {author}
File: {filePath}
Line: {line}
Comment: "{content}"

## Code Context
```{filetype}
{~20 lines around the comment}
```

## Instructions
- Make the minimal change needed to address this review comment
- Do not refactor unrelated code
- Maintain existing code style and conventions
- If a test is needed, add it in the appropriate test file
```

**Batch fix (all comments):**
```
Fix the following {n} code review comments on PR #{id}.

## Comment 1/{n}
File: {filePath}:{line}
Author: {author}
"{content}"

## Comment 2/{n}
...

Address each comment with the minimal change needed.
```

### 3.5 — AgentFix screen

**File: `src/screens/AgentFix.tsx`**

After the agent completes, shows the local `git diff` for review.

```
┌─ Agent Fix ── comment #1 of 3 ──────────────────────────┐
│                                                           │
│  Fixing: "{comment}" ({author}, L{line})                  │
│  Agent: {agent_name}                                      │
│  Status: ✅ Complete — {n} files changed                   │
│                                                           │
│  {filepath}                                      +{a} -{d}│
│  ──────────────────────────────────────────────────────    │
│  {diff lines with +/- coloring}                           │
│                                                           │
│  [a] Accept & commit  [e] Edit  [r] Reject                │
│  [c] Comment          [→] Next  [b] Back                  │
└───────────────────────────────────────────────────────────┘
```

**Accept flow:**
1. Stage all changes: `git add .`
2. Commit with template message: `fix: {summary} (PR #{pr_id})`
3. Push to PR branch (if `auto_push: true`)
4. Resolve comment on Bitbucket via API
5. Navigate to next unresolved comment

**Reject flow:**
1. `git checkout .` — discard all changes
2. Stay on current comment

**Custom hook: `useLocalDiff()`**
- Runs `git diff` to get current changes
- Runs `git diff --name-only` for file list
- Returns `{ diff: string, files: string[], hasChanges: boolean }`

### 3.6 — Git service

**File: `src/services/git.ts`**

```typescript
async function getRepoRoot(): Promise<string>
async function getDiff(): Promise<string>
async function getChangedFiles(): Promise<string[]>
async function stageAll(): Promise<void>
async function commit(message: string): Promise<void>
async function push(): Promise<void>
async function discardChanges(): Promise<void>
async function getCurrentBranch(): Promise<string>
```

All use `Bun.spawn()` with `cwd: getRepoRoot()`.

---

## Phase 4: AI-Assisted Review

> Full epic spec: `docs/epics/EP-01-ai-assisted-review.md`

### 4.1 — AI comment refinement (reviewer mode)

When a reviewer writes a comment and submits it, the configured AI agent refines the draft into a clearer, more constructive comment. The reviewer sees their draft alongside the suggestion and can:
- **Accept** the refined version
- **Skip** and post the original
- **Edit** the suggestion manually
- **Reject with feedback** — explain why, and the agent tries again (conversational loop until satisfied)

This uses `queryAgent()` in print mode. The prompt includes: the file diff, existing comments, and the reviewer's draft. If no agent is configured, comments post directly (existing behavior).

**Stories:** US-23 (agent service), US-24 (prompt builder), US-25 (refinement hook), US-26 (refinement widget), US-27 (DiffNav integration)

### 4.2 — AI second pass (reviewer mode, future)

After the manual review is complete, the AI does a second pass over the entire PR diff. It has full context: the diff, all existing comments (from automated reviewers + other humans), and the comments the reviewer just wrote. It proposes additional comments for anything that was missed. The reviewer triages these one by one.

This builds on the agent service and prompt builder from 4.1. Separate epic to be written.

### 4.3 — Themes

Support for multiple themes: Tokyo Night (default), GitHub Dark, Catppuccin.

Configurable via `display.theme` in config.

### 4.4 — Export prompt

From CommentQueue, press `e` to copy the agent prompt to clipboard for manual pasting into an agent outside of opalite.

### 4.3 — Themes

Support for multiple themes: Tokyo Night (default), GitHub Dark, Catppuccin.

Configurable via `display.theme` in config.

### 4.4 — Export prompt

From CommentQueue, press `e` to copy the agent prompt to clipboard for manual pasting into an agent outside of opalite.

---

## Configuration reference

### Agent CLI commands

Both Claude Code and Cursor CLI support the same two modes:

| Mode | Claude Code | Cursor CLI |
|------|------------|------------|
| Interactive (edits files) | `claude "prompt"` | `agent "prompt"` |
| Print (stdout) | `claude --print "prompt"` | `agent -p "prompt"` |
| Print JSON | `claude --print --output-format json "prompt"` | `agent -p --output-format json "prompt"` |

### Bitbucket auth

Each developer creates a personal API token. No admin setup needed.

**Steps:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Select **Bitbucket** as the app
4. Set permissions: Repositories (Read), Pull Requests (Read + Write)
5. Set an expiry (max 1 year)
6. Copy the token
7. Run `opalite login` and paste it

Auth uses Basic HTTP auth: `Authorization: Basic base64(email:token)`.

API tokens are prefixed with `ATAT` — opalite validates this during login.

```bash
opalite login   # paste email + token, validates and saves
opalite logout  # removes stored credentials
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `OPALITE_CONFIG` | Custom config file path |

---

## Install script

**File: `install.sh`**

The install script lives at the repo root and is served via GitHub raw URL:

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/opalite/main/install.sh | bash
```

It does:
1. Check for Bun — offer to install if missing
2. `bun install -g opalite` (or from GitHub if not on npm)
3. Fix PATH if needed (detect shell, append to rc file)
4. Detect available agents (`claude`, `agent`)
5. Print next steps

---

## package.json

```json
{
  "name": "opalite",
  "version": "0.1.0",
  "description": "PR reviews & fixes from your terminal",
  "type": "module",
  "bin": {
    "opalite": "./src/index.tsx"
  },
  "dependencies": {
    "@opentui/core": "latest",
    "@opentui/react": "latest",
    "react": "^18",
    "yaml": "^2"
  },
  "devDependencies": {
    "@types/react": "^18",
    "typescript": "^5"
  }
}
```

---

## Key design decisions

1. **No API keys.** All AI features use the agent CLI the user already has installed. Zero extra config.
2. **Two config files.** Shared team config in repo root, personal auth+agent config in `~/.config/`. The CLI merges them.
3. **OpenTUI, not Ink.** OpenTUI has built-in `<diff>`, `<code>`, and `<scroll-box>` components. Ink would require building all of these from scratch.
4. **Bun only.** Required by OpenTUI. Not a problem — opalite is a standalone CLI tool, not a library consumed by other projects.
5. **Agent-agnostic.** The agent config uses command templates with `{prompt}` placeholder. Works with any CLI agent that supports interactive and print modes (Claude Code, Cursor CLI, or any future agent).
6. **AI assists humans, doesn't replace them.** The AI refines reviewer comments and catches missed issues, but the human always has final say. Every AI suggestion goes through accept/reject/edit. The company's automated AI reviewer handles the first pass; opalite's AI helps during and after the human review.
7. **Phase 1 first.** Dashboard is the MVP. It solves "nobody reviews" by making the backlog visible. AI-assisted review builds on the manual review foundation.

---

## Non-goals (for now)

- GitHub support (Bitbucket only for MVP)
- Slack integration
- CI/CD integration
- Browser-based UI
- Reviewer auto-assignment

---

## User Stories

Stories are ordered by priority. Each story is independently shippable. Stories within a phase can be worked on in parallel where noted.

### How to work with these stories

**Before starting any work**, create each user story as an individual markdown file under `docs/stories/`:

```
docs/stories/
├── US-01-install-opalite.md
├── US-02-login-to-bitbucket.md
├── US-03-setup-workspace-repos.md
├── ...
└── US-21-export-prompt-clipboard.md
```

**Each story file must contain:**

1. The user story (as a / I want / so that)
2. The acceptance criteria (copied from this PRD)
3. A **technical tasks** section — break the story into concrete implementation tasks. Each task should be a single, completable unit of work (a function, a component, a test, a config change). Check them off as you go.
4. The files to create or modify

**Example format for a story file:**

```markdown
# US-2: Log in to Bitbucket

## User Story

**As a** developer,
**I want to** authenticate with Bitbucket by running `opalite login`,
**so that** opalite can access my PRs and repos.

## Acceptance Criteria

- Running `opalite login` prints instructions with a link to create a token
- The CLI prompts for Atlassian email and API token (hidden input)
- ...

## Technical Tasks

- [ ] Create auth service with login, logout, and credential validation
- [ ] Prompt for email and token with hidden input, validate ATAT prefix
- [ ] Validate credentials against Bitbucket API (GET /2.0/user)
- [ ] Persist credentials to ~/.config/opalite/auth.json
- [ ] Add login/logout subcommands to CLI entry point
- [ ] Add auth guard — block all commands except login/help if not authenticated
- [ ] Handle expired tokens — detect 401 responses and prompt to re-login
```

**Work through stories in phase order.** Within a phase, read all stories first, then implement them. This avoids rework from missed shared patterns.

---

### Phase 1 — Installation & Setup

#### US-1: Install opalite

**As a** developer,
**I want to** install opalite with a single command,
**so that** I can start using it without manual setup steps.

**Acceptance Criteria:**
- Running `curl -fsSL https://raw.githubusercontent.com/your-org/opalite/main/install.sh | bash` installs opalite globally
- If Bun is not installed, the script offers to install it automatically
- If Bun's global bin directory is not in PATH, the script detects the user's shell (bash/zsh/fish) and appends it to the appropriate rc file
- After install, running `opalite --version` prints the current version
- Running `opalite --help` prints available commands
- The install works on macOS and Linux

**Implementation:** `install.sh`, `package.json`, `src/index.tsx` (CLI arg parsing)

---

#### US-2: Log in to Bitbucket

**As a** developer,
**I want to** authenticate with Bitbucket by running `opalite login`,
**so that** opalite can access my PRs and repos.

**Acceptance Criteria:**
- Running `opalite login` prints instructions with a link to https://id.atlassian.com/manage-profile/security/api-tokens
- The CLI prompts for Atlassian email and API token (token input is hidden)
- If the token does not start with `ATAT`, an error is shown explaining the expected format
- The credentials are validated by calling `GET /2.0/user` — if auth fails, a clear error is shown
- On success, the user's display name and username are printed
- Credentials are saved to `~/.config/opalite/auth.json`
- Running `opalite logout` deletes `~/.config/opalite/auth.json` and prints confirmation
- If `opalite` is run without being logged in, it shows "Run `opalite login` first" and exits

**Implementation:** `src/services/auth.ts`

---

#### US-3: Set up workspace and repos

**As a** developer,
**I want to** run `opalite init` to select my workspace and repos,
**so that** opalite knows which PRs to show me.

**Acceptance Criteria:**
- Running `opalite init` without being logged in prompts the user to run `opalite login` first
- The wizard fetches the user's workspaces via `GET /2.0/workspaces`
- If the user belongs to one workspace, it is auto-selected. If multiple, the user picks one
- All repos in the workspace are listed and the user selects which to watch (checkbox-style)
- The wizard detects AI agents in PATH (`claude`, `agent`, `cursor-agent`) and either auto-selects or asks the user to choose
- If no agent is found, the wizard offers to install Claude Code or Cursor CLI (with the install command), or skip
- Config is saved to `~/.config/opalite/config.yml`
- If a `.opalite.yml` exists in the current directory, its values are merged (shared config takes precedence for team settings, local config for personal settings)

**Implementation:** `src/services/config.ts`, init wizard logic in `src/index.tsx`

---

#### US-4: Check for updates on startup

**As a** developer,
**I want to** be notified when a new version of opalite is available,
**so that** I always have the latest features and bug fixes.

**Acceptance Criteria:**
- On every launch, opalite checks the GitHub releases API for the latest version (non-blocking, 2s timeout)
- If a newer version exists, a single line is printed before the TUI renders: `opalite v0.2.0 available (current: v0.1.3) — run 'opalite update' to upgrade`
- If the check fails (offline, rate limited, timeout), nothing is shown — startup is not delayed
- Running `opalite update` re-runs the install script and prints the new version on success

**Implementation:** `src/services/update.ts`

---

### Phase 2 — Review Dashboard

*Depends on: Phase 1 complete*

#### US-5: View open PRs across repos

**As a** reviewer,
**I want to** see all open PRs across my configured repos in a single dashboard,
**so that** I can see what needs reviewing without checking Bitbucket or Slack.

**Acceptance Criteria:**
- Running `opalite` shows a full-screen TUI dashboard
- Open PRs are fetched from all configured repos in parallel
- PRs are grouped by repository, repos sorted alphabetically
- Within each repo, PRs are sorted by age (oldest first)
- Each PR row shows: status color, PR number, title, age, file count, lines added/removed, author, comment count
- PR age is color-coded: green (< `warning` threshold, default 24h), yellow (< `critical`, default 48h), red (>= `critical`)
- A summary line at the bottom shows: total open PRs, oldest PR age, average age
- The timestamp of the last fetch is shown (e.g. "⟳ 2 min ago")
- `q` quits the app
- The dashboard renders correctly at different terminal sizes

**Implementation:** `src/screens/Dashboard.tsx`, `src/widgets/PRRow.tsx`, `src/hooks/usePRs.ts`, `src/services/bitbucket.ts`

---

#### US-6: Navigate and refresh the dashboard

**As a** reviewer,
**I want to** navigate the PR list with keyboard shortcuts and refresh the data,
**so that** I can efficiently browse PRs without using a mouse.

**Acceptance Criteria:**
- `↑`/`↓` or `j`/`k` moves the selection cursor between PRs
- The selected PR is visually highlighted
- `Enter` on a selected PR navigates to the DiffNav screen (US-8)
- `m` switches to the MyPRs screen (US-14)
- `r` manually refreshes all PR data and updates the "last fetch" timestamp
- PRs auto-refresh every 2 minutes (interval configurable in `.opalite.yml`)
- A keybinding help bar is shown at the bottom of the screen

**Implementation:** `src/widgets/KeyBar.tsx`, keyboard handling in `Dashboard.tsx`

---

#### US-7: Route between screens

**As a** user,
**I want to** navigate between different screens (dashboard, diff view, my PRs, etc.),
**so that** I can use all features without restarting the app.

**Acceptance Criteria:**
- `App.tsx` manages a screen stack using React state
- Navigating to a new screen pushes it onto the stack
- `Esc` or `b` goes back to the previous screen
- `q` from the dashboard quits the app
- Screen transitions are instant (no loading flash)

**Implementation:** `src/App.tsx`

---

### Phase 3 — Inline Review

*Depends on: US-5, US-6, US-7*

#### US-8: View PR diff with file tree

**As a** reviewer,
**I want to** view a PR's diff with a file tree sidebar and side-by-side diff,
**so that** I can review code changes in my terminal.

**Acceptance Criteria:**
- Pressing `Enter` on a PR in the dashboard opens the DiffNav screen
- The screen has two panels: file tree sidebar (left) and diff viewer (right)
- The file tree lists all changed files with their change counts (+/-)
- The currently selected file is highlighted in the file tree
- The diff viewer shows the selected file's changes using OpenTUI's `<diff>` component
- The PR title, author, branches, and age are shown in a header
- `Tab` toggles focus between file tree and diff viewer
- `↑`/`↓` or `j`/`k` scrolls the focused panel
- `n`/`N` jumps to the next/previous changed file
- `u` toggles between split (side-by-side) and unified diff view
- `Esc` or `b` goes back to the dashboard

**Implementation:** `src/screens/DiffNav.tsx`, `src/widgets/FileTree.tsx`, `src/hooks/useDiff.ts`

---

#### US-9: View existing comments on a PR

**As a** reviewer,
**I want to** see existing Bitbucket comments inline in the diff,
**so that** I know what's already been discussed.

**Acceptance Criteria:**
- Inline comments are fetched from the Bitbucket API and displayed at the relevant lines in the diff
- Each comment shows the author, timestamp, and content
- Comment threads (replies) are shown nested under the parent comment
- General (non-inline) comments are shown in a separate section
- The comment count badge in the file tree reflects per-file comment counts

**Implementation:** `src/widgets/CommentList.tsx`, comment fetching in `src/services/bitbucket.ts`

---

#### US-10: Leave comments on a PR

**As a** reviewer,
**I want to** add inline and general comments on a PR,
**so that** I can give feedback without opening Bitbucket in a browser.

**Acceptance Criteria:**
- Pressing `c` on a diff line opens a comment editor at that line
- The comment editor uses OpenTUI's `<input>` component for text entry
- `Enter` submits the comment to Bitbucket via `POST /repositories/{workspace}/{repo}/pullrequests/{id}/comments`
- `Esc` cancels without posting
- After posting, the comment appears inline in the diff immediately
- Replying to an existing comment is supported (navigate to comment, press `r`)
- Posted comments include the correct `inline.path` and `inline.to` (line number) for inline comments

**Implementation:** `src/widgets/CommentEditor.tsx`, comment posting in `src/services/bitbucket.ts`

---

#### US-11: Submit a review (approve / request changes)

**As a** reviewer,
**I want to** approve a PR or request changes from within opalite,
**so that** I can complete the entire review workflow without leaving the terminal.

**Acceptance Criteria:**
- Pressing `a` from DiffNav approves the PR via `POST .../approve`
- Pressing `x` from DiffNav requests changes via `POST .../request-changes`
- Both actions show a confirmation before posting
- After submitting, the user is taken back to the dashboard
- The PR's status in the dashboard updates on the next refresh

**Implementation:** `src/screens/ReviewSubmit.tsx`, approve/request-changes endpoints in `src/services/bitbucket.ts`

---

### Phase 4 — Author Mode

*Depends on: Phase 3 complete. US-12 and US-13 can be built in parallel with Phase 3.*

#### US-12: View my open PRs

**As a** PR author,
**I want to** see a list of my own open PRs with comment counts,
**so that** I know which PRs need my attention.

**Acceptance Criteria:**
- Running `opalite my` or pressing `m` from the dashboard shows the MyPRs screen
- Only PRs authored by the logged-in user are shown
- Each PR shows: title, age, comment count (total and unresolved), reviewer statuses (approved, changes requested, pending)
- `Enter` on a PR navigates to the CommentQueue screen (US-13)
- `d` switches back to the dashboard
- `q` quits

**Implementation:** `src/screens/MyPRs.tsx`

---

#### US-13: View unresolved comments as a fix queue

**As a** PR author,
**I want to** see all unresolved comments on my PR in a queue,
**so that** I can work through them one by one.

**Acceptance Criteria:**
- Selecting a PR from MyPRs shows all unresolved comments as a numbered list
- Each comment shows: author, file path and line number, comment text, and a few lines of code context around the commented line
- `↑`/`↓` or `j`/`k` navigates between comments
- `f` triggers the agent fix flow for the selected comment (US-15)
- `F` triggers the batch fix flow for all comments (US-17)
- `r` opens a reply editor for the selected comment
- `✓` marks the selected comment as resolved on Bitbucket
- `e` copies the generated agent prompt to clipboard
- `b` goes back to MyPRs

**Implementation:** `src/screens/CommentQueue.tsx`

---

#### US-14: Generate agent prompts from comments

**As a** PR author,
**I want** opalite to generate a well-structured prompt from a review comment,
**so that** the AI agent has the right context to fix the issue.

**Acceptance Criteria:**
- Given a comment, a prompt is generated containing: PR ID, title, branch name, comment author, file path, line number, comment text, ~20 lines of code context around the commented line, and instructions to make minimal changes
- The prompt template is consistent and produces good results with both Claude Code and Cursor CLI
- A batch prompt variant combines multiple comments into a single prompt with numbered sections
- The prompt can be copied to clipboard via the `e` key in CommentQueue

**Implementation:** `src/services/prompt.ts`

---

#### US-15: Fix a comment with an AI agent

**As a** PR author,
**I want to** press `f` on a comment to spawn an AI agent that fixes it,
**so that** I can address review feedback without manually writing the fix.

**Acceptance Criteria:**
- Pressing `f` in CommentQueue generates a prompt (US-14) and spawns the configured agent in interactive mode
- The agent runs in the current terminal (stdio inherited) so the user can see and interact with it
- The agent command is built from the config template (e.g. `claude "{prompt}"` or `agent "{prompt}"`)
- The agent runs in the repo root directory
- After the agent exits, opalite detects changes via `git diff`
- If changes exist, the AgentFix screen (US-16) is shown
- If no changes, a message is shown: "Agent made no changes"
- If no agent is configured, a helpful error is shown with install instructions

**Implementation:** `src/services/agent.ts`, `src/hooks/useAgent.ts`

---

#### US-16: Review and accept agent changes

**As a** PR author,
**I want to** review the diff the agent produced and accept or reject it,
**so that** I stay in control of what gets committed.

**Acceptance Criteria:**
- After the agent completes, the AgentFix screen shows the local `git diff` using OpenTUI's `<diff>` component
- The screen header shows: which comment is being fixed, agent name, number of files changed
- `a` accepts the changes: stages all files, commits with the configured template message (e.g. `fix: {summary} (PR #{pr_id})`), pushes to the PR branch (if `auto_push: true`), and resolves the comment on Bitbucket
- `r` rejects the changes: runs `git checkout .` to discard all changes
- `e` opens the changes in `$EDITOR` for manual tweaking before accepting
- After accept or reject, the user is returned to CommentQueue and the next unresolved comment is selected
- The commit message includes a reference to the PR

**Implementation:** `src/screens/AgentFix.tsx`, `src/services/git.ts`, `src/hooks/useLocalDiff.ts`

---

#### US-17: Fix all comments in one batch

**As a** PR author,
**I want to** press `F` to fix all unresolved comments in a single agent session,
**so that** I can address all feedback at once.

**Acceptance Criteria:**
- Pressing `F` in CommentQueue generates a batch prompt (US-14) combining all unresolved comments
- A single agent session is spawned to address all comments
- After the agent exits, the combined diff is shown for review
- `a` accepts: single commit with all fixes, pushes, resolves all comments
- `r` rejects: discards all changes
- The commit message mentions the PR and number of comments addressed

**Implementation:** Batch prompt in `src/services/prompt.ts`, batch flow in `src/screens/AgentFix.tsx`

---

### Phase 5 — AI-Assisted Review

> Full epic spec: `docs/epics/EP-01-ai-assisted-review.md`

*Requires Phase 3 (Inline Review) to be complete. Stories US-23, US-24, US-26 can be worked on in parallel.*

#### US-23: Agent service (print mode)

**As a** developer,
**I want** a service that spawns the configured agent CLI and captures its output,
**so that** AI features can query the agent programmatically.

**Acceptance Criteria:**
- `queryAgent(prompt, config)` spawns the agent in print mode and returns stdout as a string
- The command is built from the config template by replacing `{prompt}` with the actual prompt
- The prompt is passed via stdin (piped) to avoid shell escaping issues
- If no agent is configured, `queryAgent` returns `null` (graceful degradation)
- Timeout of 60 seconds — if the agent doesn't respond, the promise rejects

**Implementation:** `src/services/agent.ts`, `src/types/agent.ts`

---

#### US-24: Comment refinement prompt builder

**As a** developer,
**I want** a function that builds a well-structured prompt for comment refinement,
**so that** the agent has all the context it needs to improve a review comment.

**Acceptance Criteria:**
- `buildRefinementPrompt(input)` returns a prompt containing: file path, line number, PR metadata, file diff, existing comments, and the reviewer's draft
- `buildRejectionPrompt(input)` extends the prompt with the previous suggestion and the reviewer's feedback
- Existing comments are formatted readably for the agent

**Implementation:** `src/services/prompt.ts`

---

#### US-25: Comment refinement loop hook

**As a** developer,
**I want** a hook that manages the refinement loop state machine,
**so that** the UI can drive the accept/reject/edit cycle.

**Acceptance Criteria:**
- State machine: idle → loading → suggestion → (accept | skip | edit | reject+feedback → loading → ...)
- Multi-round: each rejection appends to history, prompt includes conversation context
- If no agent configured, immediately returns the original draft (no refinement)

**Implementation:** `src/features/diff-review/hooks/useCommentRefinement.ts`

**Dependencies:** US-23, US-24

---

#### US-26: Comment refinement widget

**As a** reviewer,
**I want to** see my draft comment alongside the AI's suggested refinement,
**so that** I can decide whether to accept, edit, reject, or skip.

**Acceptance Criteria:**
- Shows original draft and AI suggestion vertically stacked
- Loading state while agent processes, error state with fallback to post original
- Keybindings: `a` accept, `s` skip, `e` edit, `r` reject+feedback
- Rejection mode shows an input field for feedback

**Implementation:** `src/features/diff-review/widgets/CommentRefinement.tsx`

---

#### US-27: Wire refinement into DiffNav comment flow

**As a** reviewer,
**I want** the refinement loop to appear automatically after I write a comment,
**so that** I get AI help without extra steps.

**Acceptance Criteria:**
- Submitting a comment triggers refinement instead of posting directly (when agent is configured)
- Accept posts refined text, Skip posts original, Edit loads suggestion back into editor, Reject loops
- If no agent configured, comment posts directly (existing behavior unchanged)
- Esc cancels entirely (no comment posted)

**Implementation:** Modify `DiffNav.tsx` and `useCommentEditor.ts`

**Dependencies:** US-23, US-24, US-25, US-26

---

#### US-18: AI second pass (future — separate epic)

**As a** reviewer,
**I want** the AI to do a second pass after my manual review to catch what I missed,
**so that** reviews are more thorough.

**Note:** This story is deferred to a separate epic that builds on the agent service and prompt builder from US-23/US-24. The previous US-18 (inline AI suggestions) and US-19 (Tab-to-suggest in editor) are superseded by the richer refinement loop in US-25-27.

---

#### US-20: Theme support

**As a** user,
**I want to** choose between different color themes,
**so that** opalite matches my terminal aesthetic.

**Acceptance Criteria:**
- Three themes are available: Tokyo Night (default), GitHub Dark, Catppuccin
- The theme is configurable via `display.theme` in `.opalite.yml` or local config
- All screens and components respect the active theme
- Colors degrade gracefully on terminals with limited color support

**Implementation:** `src/theme/tokyo-night.ts`, `src/theme/github-dark.ts`, `src/theme/catppuccin.ts`

---

#### US-21: Export prompt to clipboard

**As a** PR author,
**I want to** copy the generated agent prompt to my clipboard,
**so that** I can paste it into an agent manually if I prefer.

**Acceptance Criteria:**
- In CommentQueue, pressing `e` on a comment copies the generated prompt to the system clipboard
- A confirmation message is shown: "Prompt copied to clipboard"
- Works on macOS (pbcopy), Linux (xclip/xsel), and WSL

**Implementation:** `src/services/clipboard.ts`
