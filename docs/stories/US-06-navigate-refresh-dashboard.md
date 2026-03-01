# US-6: Navigate and refresh the dashboard

## User Story

**As a** reviewer,
**I want to** navigate the PR list with keyboard shortcuts and refresh the data,
**so that** I can efficiently browse PRs without using a mouse.

## Acceptance Criteria

- `Up`/`Down` or `j`/`k` moves the selection cursor between PRs
- The selected PR is visually highlighted
- `Enter` on a selected PR navigates to the DiffNav screen (US-8)
- `m` switches to the MyPRs screen (US-12)
- `r` manually refreshes all PR data and updates the "last fetch" timestamp
- PRs auto-refresh every 2 minutes (interval configurable in `.opalite.yml`)
- A keybinding help bar is shown at the bottom of the screen

## Technical Tasks

- [x] Create `src/features/shared/widgets/KeyBar.tsx` component: bottom bar with keybinding hints
- [x] Add keyboard navigation to `Dashboard.tsx` using `useKeyboard()`: `j`/`k`/`Up`/`Down` for cursor movement
- [x] Implement visual highlighting of the selected PR row
- [x] Add `Enter` handler to navigate to DiffNav screen with selected PR
- [x] Add `m` handler to navigate to MyPRs screen
- [x] Add `r` handler for manual refresh
- [x] Implement auto-refresh with configurable interval (default 2 minutes)
- [x] Integrate `KeyBar` into Dashboard with correct bindings

## Files to Create/Modify

- `src/components/KeyBar.tsx` (create)
- `src/screens/Dashboard.tsx` (modify — add keyboard navigation, auto-refresh, KeyBar)

## Dependencies

- US-5 (dashboard must exist to add navigation)

## Phase

Phase 2 — Review Dashboard
