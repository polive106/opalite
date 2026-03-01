# US-7: Route between screens

## User Story

**As a** user,
**I want to** navigate between different screens (dashboard, diff view, my PRs, etc.),
**so that** I can use all features without restarting the app.

## Acceptance Criteria

- `App.tsx` manages a screen stack using React state
- Navigating to a new screen pushes it onto the stack
- `Esc` or `b` goes back to the previous screen
- `q` from the dashboard quits the app
- Screen transitions are instant (no loading flash)

## Technical Tasks

- [x] Create `src/App.tsx` with screen routing using `useState<Screen>` and a discriminated union type
- [x] Define `Screen` type with all screens: `dashboard`, `diffnav`, `review-submit`, `my-prs`, `comment-queue`, `agent-fix`
- [x] Implement `navigate` function that pushes screens onto a stack
- [x] Implement back navigation (`Esc`/`b`) that pops the screen stack
- [x] Wire up `q` on dashboard to quit the app
- [x] Pass `navigate` function to all screen components
- [x] Update `src/index.tsx` to render `<App />` as the root component

## Files to Create/Modify

- `src/App.tsx` (create)
- `src/index.tsx` (modify — render App component)

## Dependencies

- US-5 (Dashboard screen must exist)
- US-6 (keyboard navigation triggers screen transitions)

## Phase

Phase 2 — Review Dashboard
