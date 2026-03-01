---
name: implement-story
description: Workflow for implementing a user story. Use when starting work on a story from docs/stories/, when the user mentions a story ID like US-5, or when asked to implement a feature from the backlog.
---

# Implement Story

Guide for implementing user stories from `docs/stories/` following opalite's architecture.

## Quick Start

1. Read the story from `docs/stories/` using the story ID
2. Check dependencies are completed
3. Follow layer order: Types → Services → Hooks → Widgets → Screens
4. For each layer, follow **Red-Green-Refactor**: write a failing test first, make it pass, then refactor
5. Verify all tests pass, it compiles, and runs

## Workflow

### 1. Load the Story

Read the target story from `docs/stories/`. Stories are individual markdown files (e.g., `docs/stories/US-05-pr-dashboard.md`). Each story contains:

- **User Story**: The requirement
- **Acceptance Criteria**: Testable conditions (checklist)
- **Technical Tasks**: Layer-by-layer breakdown with file paths
- **Dependencies**: Prerequisite stories
- **Complexity**: T-shirt size (XS/S/M/L/XL)

### 2. Pre-Implementation Checklist

Before writing code:

- [ ] Dependencies completed? Check the "Dependencies" field
- [ ] Acceptance criteria understood?
- [ ] Technical tasks identified per layer?
- [ ] OpenTUI skill installed? (`npx skills add msmps/opentui-skill`)

### 3. Implementation Order

Follow opalite's architecture — build from the inside out, using **Red-Green-Refactor** at each layer:

```
1. Types      → TypeScript interfaces and types (src/types/)
2. Services   → External integrations (src/services/)
                 TEST: __tests__/unit/services/ — mock external deps, test logic
3. Hooks      → Business logic as React hooks (src/hooks/)
                 TEST: __tests__/unit/hooks/ — test state transitions, data flow
4. Widgets    → Pure presentational components (src/widgets/)
                 TEST: __tests__/widgets/ — test rendering with mock props
5. Screens    → Compose widgets + hooks (src/screens/)
                 TEST: __tests__/integration/ — inject hook into widget, test UI behavior
```

**At each layer, follow this cycle:**
1. **RED** — Write a failing test that describes the behavior you want
2. **GREEN** — Write the minimum production code to make the test pass
3. **REFACTOR** — Clean up while keeping all tests green

### 4. Layer Guidelines

#### Types (`src/types/`)
- Define interfaces for Bitbucket API responses, domain models, config
- No runtime dependencies — pure TypeScript types

#### Services (`src/services/`)
- `bitbucket.ts` — API calls with Basic auth, auto-pagination via `next` URL
- `git.ts` — Git operations via `Bun.spawn()` with `cwd: getRepoRoot()`
- `auth.ts` — Read/write `~/.config/opalite/auth.json`
- `config.ts` — Merge `.opalite.yml` (shared) + `~/.config/opalite/config.yml` (local)
- Handle 401 errors: show "Your API token has expired. Run `opalite login` to add a new one."
- **Test in** `__tests__/unit/services/` — mock external deps (network, filesystem, processes)

#### Hooks (`src/hooks/`)
- Custom hooks for data fetching: return `{ data, loading, error, refresh }`
- Use services internally, expose clean state to widgets
- **All business logic lives here** — hooks are the brain, widgets are the body
- **Test in** `__tests__/unit/hooks/` — mock services, assert state transitions and data flow

#### Widgets (`src/widgets/`)
- **Pure presentational components** — props in, JSX out, **NO business logic**
- Use OpenTUI primitives: `<box>`, `<text>`, `<scroll-box>`, `<diff>`, `<code>`, `<select>`, `<input>`
- Use `useTerminalDimensions()` for responsive layout
- Do NOT call hooks for data fetching — receive data and callbacks via props
- **Test in** `__tests__/widgets/` — render with mock props, assert output

#### Screens (`src/screens/`)
- Compose widgets + hooks — this is the wiring layer
- Call hooks to get data, pass data and callbacks down to widgets as props
- Receive `navigate` function from `App.tsx` for screen routing
- Use `useKeyboard()` for screen-level keybindings — clean up on unmount
- `App.tsx` uses `useState<Screen>` with a discriminated union for routing
- **Test in** `__tests__/integration/` — inject hook + widget, simulate user interactions, assert UI behavior

### 5. Verification

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Run the app
bun run src/index.tsx
```

### 6. Definition of Done

Story is complete when:

- [ ] All tests pass (`bun test`) — unit, widget, and integration
- [ ] All acceptance criteria pass
- [ ] TypeScript compiles without errors (`bunx tsc --noEmit`)
- [ ] App runs without crashing (`bun run src/index.tsx`)
- [ ] Technical task checkboxes in the story file are checked off
- [ ] No hardcoded credentials or tokens in code
- [ ] Business logic is in hooks, not in widgets or screens
- [ ] Widgets are pure presentational — no data fetching, no business logic

## Complexity Reference

| Size | Files | Scope |
|------|-------|-------|
| XS | 1 file, <50 lines | ~1 hour |
| S | 2-3 files | ~2-4 hours |
| M | 4-6 files, cross-layer | ~1 day |
| L | 7-10 files | ~2-3 days |
| XL | 10+ files | ~1 week |

## Example

Implementing US-5 (PR Dashboard):

```bash
# 1. Read the story
# Read docs/stories/US-05-pr-dashboard.md

# 2. Check dependencies — US-1 through US-4 must be done

# 3. Follow layer order with Red-Green-Refactor at each step:
#
#    Types: src/types/bitbucket.ts (PR interface, pagination types)
#
#    Services: src/services/bitbucket.ts (fetchOpenPRs with pagination)
#      RED:   write __tests__/unit/services/bitbucket.test.ts — test pagination, error handling
#      GREEN: implement fetchOpenPRs in src/services/bitbucket.ts
#      REFACTOR: clean up
#
#    Hooks: src/hooks/usePRs.ts (data fetching hook)
#      RED:   write __tests__/unit/hooks/usePRs.test.ts — test loading/data/error states
#      GREEN: implement usePRs in src/hooks/usePRs.ts
#      REFACTOR: clean up
#
#    Widgets: src/widgets/PRRow.tsx (single PR row — pure presentational)
#      RED:   write __tests__/widgets/PRRow.test.tsx — test renders title, author, age from props
#      GREEN: implement PRRow in src/widgets/PRRow.tsx
#      REFACTOR: clean up
#
#    Screens: src/screens/Dashboard.tsx (wire usePRs hook to PRRow widget)
#      RED:   write __tests__/integration/Dashboard.test.tsx — test loading → list → navigation
#      GREEN: implement Dashboard composing hook + widget
#      REFACTOR: clean up

# 4. Verify
bun test
bunx tsc --noEmit
bun run src/index.tsx

# 5. Check off technical tasks in the story file
```
