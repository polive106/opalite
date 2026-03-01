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

```
src/
├── index.tsx              # Entry point: CLI arg parsing, createCliRenderer + createRoot
├── App.tsx                # Screen router (useState<Screen>, navigate function)
├── screens/               # Full-screen views — compose widgets + hooks
├── widgets/               # Pure presentational components (NO business logic)
├── hooks/                 # Business logic as React hooks (testable in isolation)
├── services/              # External integrations (auth, bitbucket API, agent, git, config)
├── theme/                 # Color themes (tokyo-night default)
└── types/                 # TypeScript types (bitbucket API, agent config, domain)

__tests__/
├── unit/
│   ├── hooks/             # Hook tests — business logic in isolation
│   └── services/          # Service tests — external integrations
├── widgets/               # Widget tests — pure rendering, no logic
└── integration/           # Integration tests — inject hook + widget, test UI behavior
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

- **Red-Green-Refactor** — all development follows TDD. Write a failing test first (red), make it pass with minimal code (green), then refactor. No production code without a failing test first.
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

## Testing architecture

Development follows **Red-Green-Refactor** (TDD). Every feature starts with a failing test. This architecture uses **feature sliced design** to separate concerns into testable units, creating a natural testing pyramid and reducing the cognitive load of writing tests.

### Three testing layers

#### 1. Widgets (`src/widgets/`) → Component tests (`__tests__/widgets/`)

Widgets are pure presentational components built on OpenTUI primitives. They receive data and callbacks as props — **zero business logic**. Stateless, well-defined props, isolated rendering.

```tsx
// __tests__/widgets/PRRow.test.tsx
it('should render PR title, author, and age', () => {
  render(<PRRow pr={mockPR} onSelect={mockOnSelect} />)
  expect(screen.getByText('#42 Fix auth flow')).toBeInTheDocument()
  expect(screen.getByText('alice')).toBeInTheDocument()
})
```

- Tests are purely about rendering behavior
- No business logic or state management concerns
- Easy to mock props and verify output
- Quick to write, quick to run

#### 2. Hooks (`src/hooks/`) → Unit tests (`__tests__/unit/hooks/`)

Hooks contain **all business logic**. Test them in isolation without any UI rendering. State management is centralized, complex operations tested without UI concerns, edge cases easy to cover.

```tsx
// __tests__/unit/hooks/usePRs.test.ts
it('should transition from loading to data on successful fetch', () => {
  const { result } = renderHook(() => usePRs(mockConfig))
  expect(result.current.loading).toBe(true)
  await waitFor(() => {
    expect(result.current.data).toHaveLength(3)
    expect(result.current.loading).toBe(false)
  })
})
```

- Business rules tested in isolation
- Services/API calls mocked
- State transitions verified (loading → data → error)
- Can be written before UI implementation

#### 3. Screens (`src/screens/`) → Integration tests (`__tests__/integration/`)

Screens compose hooks + widgets. Integration tests verify complete user flows — initial state, interactions, and resulting UI updates.

```tsx
// __tests__/integration/Dashboard.test.tsx
it('allows user to browse PRs and open a review', async () => {
  render(<Dashboard navigate={mockNavigate} />)
  // 1. Shows loading state
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  // 2. Shows PR list after fetch
  await waitFor(() => expect(screen.getByText('#42 Fix auth flow')).toBeInTheDocument())
  // 3. Navigate on Enter
  fireEvent.keyPress(screen.getByText('#42'), { key: 'Enter' })
  expect(mockNavigate).toHaveBeenCalledWith({ name: 'diffnav', pr: expect.any(Object) })
})
```

- Tests complete user flows end-to-end
- Verifies integration between hooks and widgets
- Catches wiring issues
- Provides confidence in feature functionality

### Separation rules

| Layer | Contains | Does NOT contain |
|-------|----------|-----------------|
| **Hooks** (`src/hooks/`) | State management, data fetching, business logic | JSX, rendering, UI concerns |
| **Widgets** (`src/widgets/`) | JSX, layout, display logic, props-driven rendering | `useState`, `useEffect`, data fetching, API calls |
| **Screens** (`src/screens/`) | Composition of widgets + hooks, wiring callbacks | Complex business logic (delegate to hooks) |

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
3. Combine in **screens** (wiring) — integration test with user flows

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
