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
bun test             # run all tests
bun test --watch     # run tests in watch mode (TDD)
```

## Project structure

Feature-sliced architecture — each feature lives in its own folder with `hooks/`, `widgets/`, and `ui/` subfolders. Shared services, types, and theme remain at the top level.

```
src/
├── index.tsx              # Entry point: CLI arg parsing, createCliRenderer + createRoot
├── App.tsx                # Screen router (useState<Screen>, navigate function)
├── features/              # Feature slices — each feature is a self-contained folder
│   ├── dashboard/         # PR review dashboard feature
│   │   ├── hooks/         # Business logic hooks for this feature
│   │   ├── widgets/       # Pure presentational components for this feature
│   │   └── ui/            # Full-screen views (compose widgets + hooks)
│   └── shared/            # Shared hooks and widgets used across features
│       ├── hooks/         # Shared business logic hooks
│       └── widgets/       # Shared presentational components
├── commands/              # CLI commands (login, logout, init, update)
├── services/              # External integrations (auth, bitbucket API, agent, git, config)
├── theme/                 # Color themes (tokyo-night default)
└── types/                 # TypeScript types (bitbucket API, agent config, domain)

__tests__/
├── unit/
│   ├── commands/          # Command tests
│   └── services/          # Service tests — external integrations
└── features/              # Feature slice tests mirror src/features/
    ├── dashboard/
    │   ├── hooks/         # Hook tests — business logic in isolation
    │   ├── widgets/       # Widget tests — pure rendering, no logic
    │   └── integration/   # Integration tests — hook + widget wired together
    └── shared/
        ├── hooks/         # Shared hook tests
        └── widgets/       # Shared widget tests
```

### Feature slice rules

- Each feature gets its own folder under `src/features/` (e.g., `dashboard/`, `diff-review/`, `author-mode/`)
- Feature folders contain `hooks/`, `widgets/`, and `ui/` subfolders
- Logic shared between two or more features goes in `src/features/shared/hooks/` or `src/features/shared/widgets/`
- Services, types, and theme are NOT feature-specific — they stay at the top level
- Tests mirror the feature structure under `__tests__/features/`

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

- **Red-Green-Refactor** — all development follows TDD. Write a failing test first (red), make it pass with minimal code (green), then refactor. No production code without a failing test first.
- **Bun only** — use `Bun.spawn()` for process spawning, `bun` for package management
- **Use `bun add` for dependencies** — never manually edit `package.json` to add dependencies. Use `bun add <pkg>` (or `bun add -d <pkg>` for dev deps) so Bun manages versions and the lockfile
- **Strict TypeScript** — no `any`, no `as` casts unless absolutely necessary
- **Minimal changes** — don't refactor unrelated code, don't add extra features
- **No API keys in code** — AI features use the agent CLI the user has installed
- **Two config files** — shared `.opalite.yml` (team) + local `~/.config/opalite/config.yml` (personal). Local overrides shared.
- **Auth file** — `~/.config/opalite/auth.json` (email, api_token, user info). Managed by `opalite login/logout`.
- **Basic HTTP auth** — `Authorization: Basic base64(email:token)` for all Bitbucket API calls
- **Pagination** — Bitbucket uses `next` URL in responses. Always implement auto-pagination.
- **Error handling** — expired tokens return 401, show "Your API token has expired. Run `opalite login` to add a new one."
- **Changesets required** — every commit must include a changeset file. See the Changesets section below.

## Changesets (versioning)

Every commit that changes production code must include a changeset file. A **PreToolUse hook** blocks `git commit` if none exists.

**To create a changeset**, add a markdown file to `.changeset/` (any descriptive name, e.g., `.changeset/add-login-command.md`):

```md
---
"opalite": patch
---

Add login command with Basic auth support.
```

**Bump types:**
- `patch` — bug fixes, small tweaks
- `minor` — new features, new user stories
- `major` — breaking changes

After merging, `npx changeset version` consumes changeset files and bumps `package.json` version.

## Architecture patterns

- **Screen routing**: `App.tsx` uses `useState<Screen>` with a discriminated union. Pass `navigate` function to all screens.
- **Data fetching**: Custom hooks (`usePRs`, `useDiff`, etc.) handle fetch + state. Return `{ data, loading, error, refresh }`.
- **Agent spawning**: Command templates with `{prompt}` placeholder from config. Three modes: interactive (stdio inherited), print (capture stdout), print JSON (parse JSON output).
- **Git operations**: All via `Bun.spawn()` with `cwd: getRepoRoot()`. Wrapped in `src/services/git.ts`.

## Testing architecture

Development follows **Red-Green-Refactor** (TDD). Every feature starts with a failing test. This architecture uses **feature sliced design** to separate concerns into testable units, creating a natural testing pyramid and reducing the cognitive load of writing tests.

### Three testing layers

#### 1. Widgets (`src/features/{feature}/widgets/`) → Component tests (`__tests__/features/{feature}/widgets/`)

Widgets are pure presentational components built on OpenTUI primitives. They receive data and callbacks as props — **zero business logic**. Stateless, well-defined props, isolated rendering.

```tsx
// __tests__/features/dashboard/widgets/PRRow.test.tsx
it('should format PR data for display', () => {
  const data = formatPRRow(mockPR, now, 24, 48)
  expect(data.title).toBe('Fix auth flow')
  expect(data.author).toBe('alice')
  expect(data.ageColor).toBe('red')
})
```

- Tests are purely about rendering behavior
- No business logic or state management concerns
- Easy to mock props and verify output
- Quick to write, quick to run

#### 2. Hooks (`src/features/{feature}/hooks/`) → Unit tests (`__tests__/features/{feature}/hooks/`)

Hooks contain **all business logic**. Test them in isolation without any UI rendering. State management is centralized, complex operations tested without UI concerns, edge cases easy to cover.

```tsx
// __tests__/features/dashboard/hooks/usePRs.test.ts
it('should group PRs by repo and sort alphabetically', () => {
  const groups = groupByRepo(mockPRs)
  expect(groups[0].repo).toBe('alpha-repo')
  expect(groups[1].repo).toBe('beta-repo')
})
```

- Business rules tested in isolation
- Services/API calls mocked
- State transitions verified (loading → data → error)
- Can be written before UI implementation

#### 3. UI screens (`src/features/{feature}/ui/`) → Integration tests (`__tests__/features/{feature}/integration/`)

Screens compose hooks + widgets. Integration tests verify complete user flows — initial state, interactions, and resulting UI updates.

```tsx
// __tests__/features/dashboard/integration/Dashboard.test.tsx
it('should group PRs by repo and format rows for display', () => {
  const groups = groupByRepo(prs)
  expect(groups).toHaveLength(2)
  const firstPRRow = formatPRRow(groups[0].prs[0], now, 24, 48)
  expect(firstPRRow.title).toBe('Fix endpoint')
})
```

- Tests complete user flows end-to-end
- Verifies integration between hooks and widgets
- Catches wiring issues
- Provides confidence in feature functionality

### Separation rules

| Layer | Contains | Does NOT contain |
|-------|----------|-----------------|
| **Hooks** (`src/features/{feature}/hooks/`) | State management, data fetching, business logic | JSX, rendering, UI concerns |
| **Widgets** (`src/features/{feature}/widgets/`) | JSX, layout, display logic, props-driven rendering | `useState`, `useEffect`, data fetching, API calls |
| **UI** (`src/features/{feature}/ui/`) | Composition of widgets + hooks, wiring callbacks | Complex business logic (delegate to hooks) |
| **Shared** (`src/features/shared/`) | Hooks and widgets used across multiple features | Feature-specific logic |

### Development workflow

Each feature follows this order — every step has a clear testing strategy:

```
1. RED    — Write a failing test for the behavior you want
2. GREEN  — Write the minimum code to make it pass
3. REFACTOR — Clean up while keeping tests green
```

Implementation order per feature:
1. Start with **hooks** (business logic) — unit test in isolation
2. Build **widgets** (UI components) — component test with mock props
3. Combine in **UI screens** (wiring) — integration test with user flows

This creates a natural testing pyramid: many fast hook/widget tests, fewer integration tests. Tests serve as documentation. Layers can be developed in parallel.

Run tests: `bun test` or `bun test --watch` for continuous feedback.

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
