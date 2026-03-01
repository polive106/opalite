# US-12: View my open PRs

## User Story

**As a** PR author,
**I want to** see a list of my own open PRs with comment counts,
**so that** I know which PRs need my attention.

## Acceptance Criteria

- Running `opalite my` or pressing `m` from the dashboard shows the MyPRs screen
- Only PRs authored by the logged-in user are shown
- Each PR shows: title, age, comment count (total and unresolved), reviewer statuses (approved, changes requested, pending)
- `Enter` on a PR navigates to the CommentQueue screen (US-13)
- `d` switches back to the dashboard
- `q` quits

## Technical Tasks

- [ ] Create `src/screens/MyPRs.tsx` screen component
- [ ] Filter PRs where `author.nickname === currentUser.username`
- [ ] Display each PR with title, age, total comment count, and unresolved comment count
- [ ] Display reviewer statuses (approved, changes requested, pending) for each PR
- [ ] Implement `j`/`k`/`Up`/`Down` keyboard navigation
- [ ] Implement `Enter` to navigate to CommentQueue for selected PR
- [ ] Implement `d` to switch back to Dashboard
- [ ] Implement `q` to quit
- [ ] Add KeyBar with MyPRs-specific bindings
- [ ] Add `opalite my` subcommand to CLI entry point

## Files to Create/Modify

- `src/screens/MyPRs.tsx` (create)
- `src/index.tsx` (modify — add `my` subcommand)
- `src/App.tsx` (modify — add MyPRs screen to routing)

## Dependencies

- US-5 (Bitbucket API client and PR fetching)
- US-7 (screen routing)

## Phase

Phase 4 — Author Mode
