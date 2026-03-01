# US-4: Check for updates on startup

## User Story

**As a** developer,
**I want to** be notified when a new version of opalite is available,
**so that** I always have the latest features and bug fixes.

## Acceptance Criteria

- On every launch, opalite checks the GitHub releases API for the latest version (non-blocking, 2s timeout)
- If a newer version exists, a single line is printed before the TUI renders: `opalite v0.2.0 available (current: v0.1.3) — run 'opalite update' to upgrade`
- If the check fails (offline, rate limited, timeout), nothing is shown — startup is not delayed
- Running `opalite update` re-runs the install script and prints the new version on success

## Technical Tasks

- [ ] Create `src/services/update.ts` with `checkForUpdate()` function
- [ ] Implement version check against GitHub releases API (`GET /repos/{org}/opalite/releases/latest`) with 2s timeout via `AbortSignal.timeout(2000)`
- [ ] Compare latest version with current version from `package.json`
- [ ] Print update notice before TUI renders if a newer version exists
- [ ] Implement `opalite update` subcommand: re-run install script via `Bun.spawn()`
- [ ] Add `update` subcommand to CLI entry point (`src/index.tsx`)
- [ ] Ensure update check is non-blocking (does not delay startup)

## Files to Create/Modify

- `src/services/update.ts` (create)
- `src/index.tsx` (modify — add update subcommand, call checkForUpdate on startup)

## Dependencies

- US-1 (CLI entry point and package.json must exist)

## Phase

Phase 1 — Installation & Setup
