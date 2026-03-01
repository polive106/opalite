---
name: implement-story
description: Workflow for implementing a user story. Use when starting work on a story from docs/stories/, when the user mentions a story ID like US-5, or when asked to implement a feature from the backlog.
---

# Implement Story

Guide for implementing user stories from `docs/stories/` following opalite's feature-sliced architecture.

## Quick Start

1. Read the story from `docs/stories/` using the story ID
2. Check dependencies are completed
3. Follow layer order: Types → Services → Feature Hooks → Feature Widgets → Feature UI
4. For each layer, follow **Red-Green-Refactor**: write a failing test first, make it pass, then refactor
5. Verify all tests pass, it compiles, and runs

## Workflow

### 1. Load the Story

Read the target story from `docs/stories/`. Stories are individual markdown files (e.g., `docs/stories/US-05-view-open-prs.md`). Each story contains:

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

Follow opalite's **feature-sliced architecture** — build from the inside out, using **Red-Green-Refactor** at each layer:

```
1. Types      → TypeScript interfaces and types (src/types/)
2. Services   → External integrations (src/services/)
                 TEST: __tests__/unit/services/ — mock external deps, test logic
3. Hooks      → Business logic as React hooks (src/features/{feature}/hooks/)
                 TEST: __tests__/features/{feature}/hooks/ — test state transitions, data flow
4. Widgets    → Pure presentational components (src/features/{feature}/widgets/)
                 TEST: __tests__/features/{feature}/widgets/ — test rendering with mock props
5. UI         → Compose widgets + hooks (src/features/{feature}/ui/)
                 TEST: __tests__/features/{feature}/integration/ — inject hook into widget, test UI behavior
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

#### Feature Hooks (`src/features/{feature}/hooks/`)
- Custom hooks for data fetching: return `{ data, loading, error, refresh }`
- Use services internally, expose clean state to widgets
- **All business logic lives here** — hooks are the brain, widgets are the body
- **Test in** `__tests__/features/{feature}/hooks/` — mock services, assert state transitions and data flow

#### Feature Widgets (`src/features/{feature}/widgets/`)
- **Pure presentational components** — props in, JSX out, **NO business logic**
- Use OpenTUI primitives: `<box>`, `<text>`, `<scrollbox>`, `<diff>`, `<code>`, `<select>`, `<input>`
- Use `useTerminalDimensions()` for responsive layout
- Do NOT call hooks for data fetching — receive data and callbacks via props
- **Test in** `__tests__/features/{feature}/widgets/` — render with mock props, assert output

#### Feature UI (`src/features/{feature}/ui/`)
- Compose widgets + hooks — this is the wiring layer
- Call hooks to get data, pass data and callbacks down to widgets as props
- Receive `navigate` function from `App.tsx` for screen routing
- Use `useKeyboard()` for screen-level keybindings — clean up on unmount
- `App.tsx` uses `useState<Screen>` with a discriminated union for routing
- **Test in** `__tests__/features/{feature}/integration/` — inject hook + widget, simulate user interactions, assert UI behavior

#### Shared (`src/features/shared/`)
- Logic or widgets shared between two or more features
- Contains `hooks/` and `widgets/` subfolders
- **Test in** `__tests__/features/shared/hooks/` or `__tests__/features/shared/widgets/`

### 5. Create a Changeset

Before committing, create a changeset file to document the version bump:

```bash
# Create .changeset/<descriptive-name>.md with:
---
"opalite": minor   # minor for features, patch for fixes, major for breaking
---

Brief description of what the story adds or changes.
```

Name the file after the story (e.g., `.changeset/us-05-pr-dashboard.md`).

### 6. Verification

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Run the app
bun run src/index.tsx
```

### 7. Definition of Done

Story is complete when:

- [ ] All tests pass (`bun test`) — unit, widget, and integration
- [ ] All acceptance criteria pass
- [ ] TypeScript compiles without errors (`bunx tsc --noEmit`)
- [ ] App runs without crashing (`bun run src/index.tsx`)
- [ ] Technical task checkboxes in the story file are checked off
- [ ] No hardcoded credentials or tokens in code
- [ ] Business logic is in hooks, not in widgets or UI screens
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
# Read docs/stories/US-05-view-open-prs.md

# 2. Check dependencies — US-1 through US-4 must be done

# 3. Follow layer order with Red-Green-Refactor at each step:
#
#    Types: src/types/bitbucket.ts (PR interface, pagination types)
#
#    Services: src/services/bitbucket.ts (fetchOpenPRs with pagination)
#      RED:   write __tests__/unit/services/bitbucket.test.ts
#      GREEN: implement fetchOpenPRs in src/services/bitbucket.ts
#      REFACTOR: clean up
#
#    Hooks: src/features/dashboard/hooks/usePRs.ts (data fetching hook)
#      RED:   write __tests__/features/dashboard/hooks/usePRs.test.ts
#      GREEN: implement usePRs
#      REFACTOR: clean up
#
#    Widgets: src/features/dashboard/widgets/PRRow.tsx (single PR row)
#      RED:   write __tests__/features/dashboard/widgets/PRRow.test.tsx
#      GREEN: implement PRRow
#      REFACTOR: clean up
#
#    UI: src/features/dashboard/ui/Dashboard.tsx (wire hook to widget)
#      RED:   write __tests__/features/dashboard/integration/Dashboard.test.tsx
#      GREEN: implement Dashboard composing hook + widget
#      REFACTOR: clean up

# 4. Verify
bun test
bunx tsc --noEmit
bun run src/index.tsx

# 5. Check off technical tasks in the story file
```
