# US-10: Leave comments on a PR

## User Story

**As a** reviewer,
**I want to** add inline and general comments on a PR,
**so that** I can give feedback without opening Bitbucket in a browser.

## Acceptance Criteria

- Pressing `c` on a diff line opens a comment editor at that line
- The comment editor uses OpenTUI's `<input>` component for text entry
- `Enter` submits the comment to Bitbucket via `POST /repositories/{workspace}/{repo}/pullrequests/{id}/comments`
- `Esc` cancels without posting
- After posting, the comment appears inline in the diff immediately
- Replying to an existing comment is supported (navigate to comment, press `r`)
- Posted comments include the correct `inline.path` and `inline.to` (line number) for inline comments

## Technical Tasks

- [ ] Create `src/components/CommentEditor.tsx` component: inline text input using OpenTUI's `<input>`
- [ ] Add comment posting to `src/services/bitbucket.ts`: `POST .../comments` with `content.raw`, `inline.path`, `inline.to`
- [ ] Implement `c` keybinding in DiffNav to open CommentEditor at the current diff line
- [ ] Implement `Enter` to submit comment and `Esc` to cancel
- [ ] After posting, refresh comments and display the new comment inline immediately
- [ ] Implement reply support: `r` on an existing comment opens CommentEditor with `parent.id` set
- [ ] Add `Tab` handler stub for AI comment suggestion (Phase 5, US-19)

## Files to Create/Modify

- `src/components/CommentEditor.tsx` (create)
- `src/services/bitbucket.ts` (modify — add comment posting endpoint)
- `src/screens/DiffNav.tsx` (modify — integrate CommentEditor, add `c` and `r` keybindings)

## Dependencies

- US-9 (comment display must work before adding new comments)

## Phase

Phase 3 — Inline Review
