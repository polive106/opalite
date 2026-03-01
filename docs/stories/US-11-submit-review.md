# US-11: Submit a review (approve / request changes)

## User Story

**As a** reviewer,
**I want to** approve a PR or request changes from within opalite,
**so that** I can complete the entire review workflow without leaving the terminal.

## Acceptance Criteria

- Pressing `a` from DiffNav approves the PR via `POST .../approve`
- Pressing `x` from DiffNav requests changes via `POST .../request-changes`
- Both actions show a confirmation before posting
- After submitting, the user is taken back to the dashboard
- The PR's status in the dashboard updates on the next refresh

## Technical Tasks

- [x] Add approve endpoint to `src/services/bitbucket.ts`: `POST /repositories/{workspace}/{repo}/pullrequests/{id}/approve`
- [x] Add request-changes endpoint to `src/services/bitbucket.ts`: `POST /repositories/{workspace}/{repo}/pullrequests/{id}/request-changes`
- [x] Add unapprove endpoint: `DELETE /repositories/{workspace}/{repo}/pullrequests/{id}/approve`
- [x] Create `src/features/diff-review/ui/ReviewSubmit.tsx` with confirmation dialog using `<select>` (Comment / Request Changes / Approve) and optional general comment via `<input>`
- [x] Implement `a` keybinding in DiffNav to show approval confirmation
- [x] Implement `x` keybinding in DiffNav to show request-changes confirmation
- [x] After submission, navigate back to dashboard

## Files to Create/Modify

- `src/services/bitbucket.ts` (modify — add approve, request-changes, unapprove endpoints)
- `src/screens/ReviewSubmit.tsx` (create)
- `src/screens/DiffNav.tsx` (modify — add `a` and `x` keybindings)

## Dependencies

- US-8 (DiffNav screen must exist)
- US-10 (comment posting for the optional general comment)

## Phase

Phase 3 — Inline Review
