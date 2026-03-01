---
name: implement-story
description: Workflow for implementing a user story. Use when starting work on a story from docs/stories/, when the user mentions a story ID like US-5, or when asked to implement a feature from the backlog.
---

# Implement Story

Guide for implementing user stories from `docs/stories/` following opalite's architecture.

## Quick Start

1. Read the story from `docs/stories/` using the story ID
2. Check dependencies are completed
3. Follow layer order: Types → Services → Hooks → Components → Screens
4. Verify it compiles and runs

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

Follow opalite's architecture — build from the inside out:

```
1. Types      → TypeScript interfaces and types (src/types/)
2. Services   → Business logic, API calls, git ops (src/services/)
3. Hooks      → React hooks for data fetching & state (src/hooks/)
4. Components → Reusable UI components (src/components/)
5. Screens    → Full-screen views that compose components (src/screens/)
```

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

#### Hooks (`src/hooks/`)
- Custom hooks for data fetching: return `{ data, loading, error, refresh }`
- Use services internally, expose clean state to components

#### Components (`src/components/`)
- Use OpenTUI primitives: `<box>`, `<text>`, `<scroll-box>`, `<diff>`, `<code>`, `<select>`, `<input>`
- Use `useKeyboard()` for keybindings — clean up on unmount
- Use `useTerminalDimensions()` for responsive layout

#### Screens (`src/screens/`)
- Full-screen views composed of components
- Receive `navigate` function from `App.tsx` for screen routing
- `App.tsx` uses `useState<Screen>` with a discriminated union for routing

### 5. Verification

```bash
# Type check
bunx tsc --noEmit

# Run the app
bun run src/index.tsx
```

### 6. Definition of Done

Story is complete when:

- [ ] All acceptance criteria pass
- [ ] TypeScript compiles without errors (`bunx tsc --noEmit`)
- [ ] App runs without crashing (`bun run src/index.tsx`)
- [ ] Technical task checkboxes in the story file are checked off
- [ ] No hardcoded credentials or tokens in code

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

# 3. Follow layer order:
#    - Types: src/types/bitbucket.ts (PR interface, pagination types)
#    - Services: src/services/bitbucket.ts (fetchOpenPRs with pagination)
#    - Hooks: src/hooks/usePRs.ts (data fetching hook)
#    - Components: src/components/PRRow.tsx (single PR row)
#    - Screens: src/screens/Dashboard.tsx (full dashboard view)

# 4. Verify
bunx tsc --noEmit
bun run src/index.tsx

# 5. Check off technical tasks in the story file
```
