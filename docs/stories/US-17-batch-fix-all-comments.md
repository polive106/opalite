# US-17: Fix all comments in one batch

## User Story

**As a** PR author,
**I want to** press `F` to fix all unresolved comments in a single agent session,
**so that** I can address all feedback at once.

## Acceptance Criteria

- Pressing `F` in CommentQueue generates a batch prompt (US-14) combining all unresolved comments
- A single agent session is spawned to address all comments
- After the agent exits, the combined diff is shown for review
- `a` accepts: single commit with all fixes, pushes, resolves all comments
- `r` rejects: discards all changes
- The commit message mentions the PR and number of comments addressed

## Technical Tasks

- [ ] Implement batch prompt generation in `src/services/prompt.ts` (combine all unresolved comments into numbered sections)
- [ ] Wire `F` keybinding in CommentQueue to generate batch prompt and spawn agent
- [ ] After agent exits, show combined diff in AgentFix screen
- [ ] Implement batch accept: single commit mentioning PR and comment count, push, resolve all comments
- [ ] Implement batch reject: discard all changes
- [ ] Update commit message template to handle batch fixes (e.g. `fix: address {n} review comments (PR #{pr_id})`)

## Files to Create/Modify

- `src/services/prompt.ts` (modify — add batch prompt generation)
- `src/screens/CommentQueue.tsx` (modify — add `F` keybinding for batch mode)
- `src/screens/AgentFix.tsx` (modify — support batch accept/reject flow)

## Dependencies

- US-14 (prompt generation, including batch variant)
- US-15 (agent spawning)
- US-16 (AgentFix screen for reviewing changes)

## Phase

Phase 4 — Author Mode
