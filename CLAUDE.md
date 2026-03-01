# CLAUDE.md — opalite

## What is this project?

opalite is a terminal-based PR review and fix tool for Bitbucket Cloud. Two modes:

1. **Reviewer mode** — Dashboard showing open PRs across repos. Browse diffs, leave comments, approve — all from the terminal.
2. **Author mode** — Shows unresolved comments on your PRs. Spawn an AI agent (Claude Code / Cursor CLI) to fix comments, review the diff, accept & commit+push.

Full spec: `docs/prd.md`

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | **Bun** (>= 1.2.0) | Required by OpenTUI. Use `bun` for all commands. |
| Language | **TypeScript** (strict mode) | JSX via `@opentui/react` |
| TUI framework | **OpenTUI** | `@opentui/core` + `@opentui/react` |
| API | **Bitbucket Cloud REST API v2.0** | Basic auth (email + API token) |
| AI agents | **Claude Code CLI / Cursor CLI** | No API keys — uses the agent CLI directly |
| Config | **YAML** | `.opalite.yml` (shared) + `~/.config/opalite/config.yml` (local) |

## Commands

```bash
bun install          # install deps
bun run src/index.tsx # run the app (or just `opalite` if installed globally)
```

## Project structure

```
src/
├── index.tsx              # Entry point: CLI arg parsing, createCliRenderer + createRoot
├── App.tsx                # Screen router (useState<Screen>, navigate function)
├── screens/               # Full-screen views (Dashboard, DiffNav, MyPRs, etc.)
├── components/            # Reusable UI components (PRRow, FileTree, KeyBar, etc.)
├── services/              # Business logic (auth, bitbucket API, agent, git, config)
├── hooks/                 # React hooks (usePRs, useDiff, useLocalDiff, useAgent)
├── theme/                 # Color themes (tokyo-night default)
└── types/                 # TypeScript types (bitbucket API, agent config, domain)
```

## OpenTUI guidelines

- Entry point pattern: `createCliRenderer()` + `createRoot(renderer).render(<App />)`
- Use `<box>` for layout (flexbox), `<text>` for text, `<scroll-box>` for scrollable areas
- Use `<diff>` for diff display (supports `viewMode="split"` and `viewMode="unified"`)
- Use `<code filetype="...">` for syntax-highlighted code
- Use `<select>` and `<input>` for form elements
- Use `useKeyboard()` for keybinding handling
- Use `useTerminalDimensions()` for responsive layout
- **tsconfig.json** must set `"jsxImportSource": "@opentui/react"`
- Before writing OpenTUI code, ensure the OpenTUI skill is installed: `npx skills add msmps/opentui-skill`

## Coding conventions

- **Bun only** — use `Bun.spawn()` for process spawning, `bun` for package management
- **Strict TypeScript** — no `any`, no `as` casts unless absolutely necessary
- **Minimal changes** — don't refactor unrelated code, don't add extra features
- **No API keys in code** — AI features use the agent CLI the user has installed
- **Two config files** — shared `.opalite.yml` (team) + local `~/.config/opalite/config.yml` (personal). Local overrides shared.
- **Auth file** — `~/.config/opalite/auth.json` (email, api_token, user info). Managed by `opalite login/logout`.
- **Basic HTTP auth** — `Authorization: Basic base64(email:token)` for all Bitbucket API calls
- **Pagination** — Bitbucket uses `next` URL in responses. Always implement auto-pagination.
- **Error handling** — expired tokens return 401, show "Your API token has expired. Run `opalite login` to add a new one."

## Architecture patterns

- **Screen routing**: `App.tsx` uses `useState<Screen>` with a discriminated union. Pass `navigate` function to all screens.
- **Data fetching**: Custom hooks (`usePRs`, `useDiff`, etc.) handle fetch + state. Return `{ data, loading, error, refresh }`.
- **Agent spawning**: Command templates with `{prompt}` placeholder from config. Three modes: interactive (stdio inherited), print (capture stdout), print JSON (parse JSON output).
- **Git operations**: All via `Bun.spawn()` with `cwd: getRepoRoot()`. Wrapped in `src/services/git.ts`.

## Theme

Default: Tokyo Night. Colors:
- bg: `#1a1b26`, fg: `#a9b1d6`, accent: `#7aa2f7`
- green: `#9ece6a`, yellow: `#e0af68`, red: `#f7768e`
- dimmed: `#565f89`, border: `#3b4261`, comment: `#bb9af7`

## User stories

Stories are tracked as individual markdown files under `docs/stories/`. Each contains: user story, acceptance criteria, technical tasks (checkboxes), and files to create/modify. Work through them in phase order.

### Phases
1. **Installation & Setup** (US-1 to US-4): install script, login, init wizard, update check
2. **Review Dashboard** (US-5 to US-7): PR list, navigation, screen routing
3. **Inline Review** (US-8 to US-11): diff view, comments, approve/request changes
4. **Author Mode** (US-12 to US-17): my PRs, comment queue, agent fix, batch fix
5. **Polish** (US-18 to US-21): AI suggestions, themes, clipboard export
