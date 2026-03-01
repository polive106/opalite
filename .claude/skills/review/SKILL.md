---
name: review
description: Pre-commit and code review checklist for opalite. Use before committing code or when reviewing changes. Covers security, code quality, and TUI best practices.
---

# Review Checklist

Use this checklist before committing or when reviewing code.

## Quick Check (Every Commit)

```
[ ] No secrets in code (API keys, passwords, tokens)
[ ] No console.log/print statements left behind
[ ] No commented-out code blocks
[ ] TypeScript compiles without errors (bunx tsc --noEmit)
```

## Security Checklist

### Credential Safety
- [ ] No API tokens or passwords hardcoded
- [ ] Auth credentials only read from `~/.config/opalite/auth.json`
- [ ] `Authorization` header built from auth service, never inline
- [ ] No credentials logged or printed to terminal

### API Safety
- [ ] All Bitbucket API calls use Basic auth from auth service
- [ ] 401 responses handled — show "Your API token has expired. Run `opalite login` to add a new one."
- [ ] API responses validated before use (check for expected fields)
- [ ] Error messages don't expose raw API responses or tokens

### Process Safety
- [ ] `Bun.spawn()` commands don't include user input without sanitization
- [ ] Git commands use explicit arguments, not string interpolation

## OpenTUI & TUI Quality

### Component Usage
- [ ] Layout uses `<box>` (flexbox), not manual spacing
- [ ] Text content wrapped in `<text>`, not bare strings
- [ ] Scrollable content uses `<scroll-box>`
- [ ] Diff display uses `<diff>` component with proper `viewMode`
- [ ] Code blocks use `<code filetype="...">` for syntax highlighting
- [ ] Forms use `<select>` and `<input>` components

### Keyboard Handling
- [ ] `useKeyboard()` hook used for all keybindings
- [ ] Keybindings cleaned up on component unmount
- [ ] No conflicting key bindings between parent and child components
- [ ] Key bar (`KeyBar` component) shows available actions

### Responsive Layout
- [ ] `useTerminalDimensions()` used for responsive sizing
- [ ] UI doesn't break on small terminal sizes
- [ ] Long text truncated or wrapped appropriately

## Bitbucket API

### Pagination
- [ ] List endpoints implement auto-pagination via `next` URL
- [ ] Pagination doesn't silently drop results (follow all pages)

### Error Handling
- [ ] Network errors caught and shown to user
- [ ] Rate limiting handled gracefully
- [ ] Empty responses handled (no PRs, no comments, etc.)

## Code Quality

### Services (`src/services/`)
- [ ] No UI logic in services — services return data, UI renders it
- [ ] Async functions properly handle errors
- [ ] Git operations use `cwd: getRepoRoot()`

### Hooks (`src/hooks/`)
- [ ] Return `{ data, loading, error, refresh }` pattern
- [ ] Loading and error states handled
- [ ] No direct DOM/terminal manipulation — hooks return state

### Screens & Components
- [ ] Screen receives `navigate` function for routing
- [ ] Components are reusable — no hardcoded screen-specific logic
- [ ] Theme colors from `src/theme/`, not hardcoded hex values

### TypeScript
- [ ] Strict mode — no `any` types
- [ ] No unnecessary `as` casts
- [ ] Discriminated unions for screen routing

## Config

- [ ] Shared config reads from `.opalite.yml`
- [ ] Local config reads from `~/.config/opalite/config.yml`
- [ ] Local overrides shared (merge order correct)
- [ ] Missing config files handled gracefully (sensible defaults)

## Final Steps

```bash
# Type check
bunx tsc --noEmit

# Run the app
bun run src/index.tsx
```
