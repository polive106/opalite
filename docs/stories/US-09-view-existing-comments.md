# US-9: View existing comments on a PR

## User Story

**As a** reviewer,
**I want to** see existing Bitbucket comments inline in the diff,
**so that** I know what's already been discussed.

## Acceptance Criteria

- Inline comments are fetched from the Bitbucket API and displayed at the relevant lines in the diff
- Each comment shows the author, timestamp, and content
- Comment threads (replies) are shown nested under the parent comment
- General (non-inline) comments are shown in a separate section
- The comment count badge in the file tree reflects per-file comment counts

## Technical Tasks

- [ ] Add comment fetching to `src/services/bitbucket.ts`: `GET /repositories/{workspace}/{repo}/pullrequests/{id}/comments` with auto-pagination
- [ ] Create `src/components/CommentList.tsx` component: display comments with author, timestamp, and content
- [ ] Implement comment thread nesting (replies grouped under parent comment)
- [ ] Integrate inline comments into DiffNav at the relevant diff lines
- [ ] Add a separate section in DiffNav for general (non-inline) comments
- [ ] Update `FileTree.tsx` to show per-file comment count badges

## Files to Create/Modify

- `src/services/bitbucket.ts` (modify — add comment fetching)
- `src/components/CommentList.tsx` (create)
- `src/screens/DiffNav.tsx` (modify — integrate inline and general comments)
- `src/components/FileTree.tsx` (modify — add comment count badges)

## Dependencies

- US-8 (DiffNav screen and file tree must exist)

## Phase

Phase 3 — Inline Review
