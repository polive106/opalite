# US-16: Review and accept agent changes

## User Story

**As a** PR author,
**I want to** review the diff the agent produced and accept or reject it,
**so that** I stay in control of what gets committed.

## Acceptance Criteria

- After the agent completes, the AgentFix screen shows the local `git diff` using OpenTUI's `<diff>` component
- The screen header shows: which comment is being fixed, agent name, number of files changed
- `a` accepts the changes: stages all files, commits with the configured template message (e.g. `fix: {summary} (PR #{pr_id})`), pushes to the PR branch (if `auto_push: true`), and resolves the comment on Bitbucket
- `r` rejects the changes: runs `git checkout .` to discard all changes
- `e` opens the changes in `$EDITOR` for manual tweaking before accepting
- After accept or reject, the user is returned to CommentQueue and the next unresolved comment is selected
- The commit message includes a reference to the PR

## Technical Tasks

- [ ] Create `src/services/git.ts` with functions: `getRepoRoot()`, `getDiff()`, `getChangedFiles()`, `stageAll()`, `commit()`, `push()`, `discardChanges()`, `getCurrentBranch()`
- [ ] Create `src/hooks/useLocalDiff.ts` hook: run `git diff` and `git diff --name-only`, return `{ diff, files, hasChanges }`
- [ ] Create `src/screens/AgentFix.tsx` screen: display local git diff using `<diff>` component
- [ ] Implement screen header: comment being fixed, agent name, file count
- [ ] Implement `a` (accept): stage all, commit with template message, push if `auto_push: true`, resolve comment on Bitbucket
- [ ] Implement `r` (reject): `git checkout .` to discard changes
- [ ] Implement `e` (edit): open changes in `$EDITOR` for manual tweaking
- [ ] After accept/reject, navigate back to CommentQueue with next unresolved comment selected
- [ ] Add KeyBar with AgentFix-specific bindings

## Files to Create/Modify

- `src/services/git.ts` (create)
- `src/hooks/useLocalDiff.ts` (create)
- `src/screens/AgentFix.tsx` (create)
- `src/App.tsx` (modify — add AgentFix to screen routing)

## Dependencies

- US-15 (agent must have run and produced changes)
- US-13 (CommentQueue to return to after accept/reject)

## Phase

Phase 4 — Author Mode
