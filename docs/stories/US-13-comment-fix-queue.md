# US-13: View unresolved comments as a fix queue

## User Story

**As a** PR author,
**I want to** see all unresolved comments on my PR in a queue,
**so that** I can work through them one by one.

## Acceptance Criteria

- Selecting a PR from MyPRs shows all unresolved comments as a numbered list
- Each comment shows: author, file path and line number, comment text, and a few lines of code context around the commented line
- `Up`/`Down` or `j`/`k` navigates between comments
- `f` triggers the agent fix flow for the selected comment (US-15)
- `F` triggers the batch fix flow for all comments (US-17)
- `r` opens a reply editor for the selected comment
- `v` marks the selected comment as resolved on Bitbucket
- `e` copies the generated agent prompt to clipboard
- `b` goes back to MyPRs

## Technical Tasks

- [ ] Create `src/screens/CommentQueue.tsx` screen component
- [ ] Fetch unresolved comments for the selected PR from Bitbucket API
- [ ] Display each comment with: number, author, file:line, comment text, code context (~5 lines around the commented line)
- [ ] Implement `j`/`k`/`Up`/`Down` keyboard navigation between comments
- [ ] Implement `f` to trigger single agent fix flow (navigate to AgentFix)
- [ ] Implement `F` to trigger batch fix flow
- [ ] Implement `r` to open reply editor for selected comment
- [ ] Implement `v` to mark comment as resolved via Bitbucket API
- [ ] Implement `e` to copy generated prompt to clipboard
- [ ] Implement `b` to go back to MyPRs
- [ ] Add KeyBar with CommentQueue-specific bindings

## Files to Create/Modify

- `src/screens/CommentQueue.tsx` (create)
- `src/App.tsx` (modify — add CommentQueue to screen routing)

## Dependencies

- US-12 (MyPRs screen to navigate from)
- US-9 (comment fetching from Bitbucket API)

## Phase

Phase 4 — Author Mode
