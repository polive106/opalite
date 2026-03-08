# CLAUDE.md — opalite

## What is this project?

opalite is a terminal-based PR review and fix tool for Bitbucket Cloud. Two modes:

1. **Reviewer mode** — Dashboard showing open PRs across repos. Browse diffs, leave comments, approve — all from the terminal. AI agent (Claude Code / Cursor CLI) refines your review comments through a conversational loop (accept/reject/edit), then does a second pass to catch missed issues.
2. **Author mode** — Shows unresolved comments on your PRs. Spawn an AI agent to fix comments, review the diff, accept & commit+push.

Full spec: `docs/prd.md` | AI review epic: `docs/epics/EP-01-ai-assisted-review.md`

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
- **Data fetching (TanStack Query)**: All data fetching uses `@tanstack/react-query`. See "TanStack Query patterns" section below.
- **Agent spawning**: Command templates with `{prompt}` placeholder from config. Three modes: interactive (stdio inherited), print (capture stdout), print JSON (parse JSON output). Agent CLI is configurable (Claude Code or Cursor CLI). Service: `src/services/agent.ts`.
- **AI comment refinement**: When a reviewer writes a comment, the agent refines it via a conversational loop (draft → suggestion → accept/reject/edit). Hook: `useCommentRefinement`. Widget: `CommentRefinement`. Prompts: `src/services/prompt.ts`. Full spec: `docs/epics/EP-01-ai-assisted-review.md`.
- **Git operations**: All via `Bun.spawn()` with `cwd: getRepoRoot()`. Wrapped in `src/services/git.ts`.

## TanStack Query patterns

All data fetching uses `@tanstack/react-query` v5. The `QueryClientProvider` wraps `<App />` in `src/index.tsx`.

### Key files

| File | Purpose |
|------|---------|
| `src/services/queryClient.ts` | Singleton `QueryClient` with production defaults |
| `src/services/queryKeys.ts` | Query key factory — ensures consistent, sortable keys |
| `__tests__/test-utils/createTestQueryClient.ts` | Test-specific `QueryClient` (no retries, no stale caching) |

### Adding a new query

1. **Add a query key** to `src/services/queryKeys.ts`:
   ```ts
   export const queryKeys = {
     // ... existing keys
     myNewData: (workspace: string, id: number) =>
       ["myNewData", workspace, id] as const,
   };
   ```

2. **Use `useQuery` in your hook** (`src/features/{feature}/hooks/`):
   ```ts
   import { useQuery, keepPreviousData } from "@tanstack/react-query";
   import { queryKeys } from "../../../services/queryKeys";

   export function useMyNewData(auth: AuthData, workspace: string, id: number) {
     const { data, isLoading, error } = useQuery({
       queryKey: queryKeys.myNewData(workspace, id),
       queryFn: () => fetchMyNewData(auth, workspace, id),
       staleTime: 2 * 60 * 1000, // tune per feature
       placeholderData: keepPreviousData, // smooth transitions
     });
     // ... return backward-compatible { data, loading, error, refresh }
   }
   ```

3. **For mutations**, use `useMutation` with optimistic updates:
   ```ts
   const mutation = useMutation({
     mutationFn: (vars) => postData(vars),
     onMutate: async (vars) => {
       await queryClient.cancelQueries({ queryKey });
       const previous = queryClient.getQueryData(queryKey);
       queryClient.setQueryData(queryKey, optimisticData);
       return { previous };
     },
     onError: (_err, _vars, context) => {
       queryClient.setQueryData(queryKey, context?.previous);
     },
     onSettled: () => {
       queryClient.invalidateQueries({ queryKey });
     },
   });
   ```

### Stale times by query type

| Query | Stale time | Rationale |
|-------|-----------|-----------|
| PR lists | 2 min | Matches auto-refresh interval |
| Diffs | 5 min | Diffs change infrequently |
| Comments | 1 min | Comments need fresher data |
| My PRs | 2 min | Same as PR lists |

### Testing queries

- Use `createTestQueryClient()` from `__tests__/test-utils/` — disables retries and stale caching
- Test cache behavior with `queryClient.fetchQuery()` + `queryClient.getQueryData()`
- Test optimistic updates by manipulating `queryClient.setQueryData()` directly
- Mock at `globalThis.fetch` level, not at the query layer
- Count `fetchSpy.mock.calls.length` to verify cache hits vs misses

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

#### 3. Feature-level functional integration tests (`__tests__/features/{feature}/integration/`)

Mock at the **external boundary** (`globalThis.fetch`), then exercise the **full production pipeline**:

```
fetch mock (Bitbucket API responses)
  → service (auto-pagination, parallel fetch, domain transform)
    → hook logic (grouping, sorting, summary)
      → widget formatting (age colors, display data)
        → key handler (navigation state machine)
```

Tests read like acceptance criteria / user scenarios:

```tsx
// __tests__/features/dashboard/integration/Dashboard.test.tsx
it('should let user navigate down through the PR list', async () => {
  mockBitbucketAPI({ api: [...], frontend: [...] })

  // Full pipeline: fetch → group → format → navigate
  const prs = await fetchOpenPRsForAllRepos(mockAuth, 'acme', ['api', 'frontend'])
  const groups = groupByRepo(prs)
  const flatPRs = groups.flatMap(g => g.prs)

  let state = { selectedIndex: 0 }
  let row = formatPRRow(flatPRs[0], now, 24, 48)
  expect(row.title).toBe('Fix auth token refresh')

  // User presses ↓
  const action = handleDashboardKey('ArrowDown', state, flatPRs)
  if (action.action === 'select') {
    state = { selectedIndex: action.index }
    row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48)
    expect(row.title).toBe('Add rate limiting')
    expect(row.ageColor).toBe('yellow')
  }
})
```

**To replicate for another feature:**
1. Mock `globalThis.fetch` with raw API responses for your feature
2. Call the service function to get domain objects
3. Run hook logic (grouping, filtering, etc.) on the result
4. Format for display using widget helpers
5. Simulate user interactions through the key handler
6. Assert both the data and the UI state at each step

See `__tests__/features/dashboard/integration/Dashboard.test.tsx` as the reference implementation.

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
5. **AI-Assisted Review** (US-23 to US-27): agent service, comment refinement loop, AI second pass. See `docs/epics/EP-01-ai-assisted-review.md`
6. **Polish** (US-20 to US-21): themes, clipboard export
