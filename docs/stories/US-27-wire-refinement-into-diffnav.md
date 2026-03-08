# US-27: Wire refinement into DiffNav comment flow

> Part of EP-01: AI-Assisted Review (`docs/epics/EP-01-ai-assisted-review.md`)

## User Story

**As a** reviewer,
**I want** the refinement loop to appear automatically after I write a comment,
**so that** I get AI help without extra steps.

## Acceptance Criteria

- When the user submits a comment (Enter in CommentEditor), the refinement flow starts instead of posting directly
- If no agent is configured, the comment is posted directly (existing behavior, no change)
- The CommentRefinement widget replaces the CommentEditor in the DiffNav layout while active
- Accept: posts the refined comment to Bitbucket, refreshes comments, closes the refinement
- Skip: posts the original draft to Bitbucket, refreshes comments, closes the refinement
- Edit: loads the refined text back into the CommentEditor for manual tweaking
- Reject: shows feedback input, sends feedback to agent, shows new suggestion (loop)
- Esc at any point: cancels entirely (no comment posted, back to diff browsing)
- DiffNav keys are suppressed during refinement (same pattern as `editorOpen` check)
- After posting (accept/skip/edit+submit), a brief success indication, then back to diff

## Technical Tasks

- [x] Modify `DiffNav.tsx`: import and use `useCommentRefinement()` hook
- [x] Modify comment submit flow: `handleSubmit` triggers `refinement.refine(draft, context)` instead of `editor.submit()`
- [x] Build refinement context from DiffNav state: current file diff (`fileDiffs[selectedFileIndex]`), existing comments for current file (`grouped.fileComments[filePath]`), PR metadata
- [x] Add keyboard handler for refinement state: `a` → accept, `s` → skip, `e` → edit, `r` → enter feedback mode, `Esc` → cancel
- [x] Add keyboard handler for feedback sub-state: `Enter` → send feedback, `Esc` → back to suggestion
- [x] Render `CommentRefinement` widget when `refinement.state.status !== 'idle'` (replaces `CommentEditor` in layout)
- [x] On accept: call `postPRComment()` with refined text + original inline/reply metadata, refresh comments, close refinement
- [x] On skip: call `postPRComment()` with original draft + metadata, refresh comments, close refinement
- [x] On edit: set CommentEditor text to refined suggestion, close refinement, re-open editor in edit mode
- [x] Suppress DiffNav and CommentEditor keybindings when refinement is active (add `refinementActive` check alongside existing `editorOpen` check)
- [x] Handle graceful degradation: if `queryAgent()` returns null (no agent), post comment directly (same as current behavior)
- [x] Modify `useCommentEditor.ts`: decouple "submit" from "post to Bitbucket" — expose `getDraft()` that returns the current text + metadata without posting, so DiffNav can pass the draft to refinement
- [x] Write integration test: mock fetch + mock agent → full flow: write draft → refinement shows → accept → comment posted to Bitbucket

## Wiring Diagram

```
DiffNav.tsx
├── useCommentEditor()     — manages draft text + inline/reply metadata
├── useCommentRefinement() — manages refinement loop state
├── useComments()          — existing comments (context for prompt)
├── useDiff()              — file diffs (context for prompt)
│
│  User presses 'c' → editor.openInline(filePath, lineNumber)
│  User types draft → editor.setText(text)
│  User presses Enter:
│    │
│    ├─ Agent configured?
│    │   YES → refinement.refine(editor.getDraft(), {
│    │           fileDiff: fileDiffs[selectedFileIndex],
│    │           existingComments: grouped.fileComments[filePath],
│    │           pr: { id, title, sourceBranch, destinationBranch }
│    │         })
│    │         → CommentRefinement widget shown
│    │         → On accept/skip → postPRComment() → refreshComments() → close
│    │         → On edit → editor.setText(suggestion) → re-open editor
│    │         → On reject → feedback input → refine again
│    │
│    └─ NO agent → postPRComment(draft) directly (existing behavior)
```

## Keyboard State Machine

```
Normal (DiffNav keys active)
  │
  ├── 'c' → Editor open (editor keys active, DiffNav suppressed)
  │           │
  │           ├── Enter → Refinement active (refinement keys active, all others suppressed)
  │           │            │
  │           │            ├── 'a' → post refined → Normal
  │           │            ├── 's' → post original → Normal
  │           │            ├── 'e' → Editor open (with refined text)
  │           │            ├── 'r' → Feedback input (input keys active)
  │           │            │          │
  │           │            │          ├── Enter → Refinement active (new suggestion)
  │           │            │          └── Esc → Refinement active (back to suggestion)
  │           │            │
  │           │            └── Esc → Normal (cancel, no comment posted)
  │           │
  │           └── Esc → Normal (cancel editor)
```

## Files to Create/Modify

- `src/features/diff-review/ui/DiffNav.tsx` (modify — add refinement hook, keyboard handling, render widget)
- `src/features/diff-review/hooks/useCommentEditor.ts` (modify — expose `getDraft()` to decouple submit from post)
- `__tests__/features/diff-review/integration/CommentRefinement.test.ts` (create)

## Dependencies

- US-23 (agent service — `queryAgent()`)
- US-24 (prompt builder — `buildRefinementPrompt()`, `buildRejectionPrompt()`)
- US-25 (refinement hook — `useCommentRefinement()`)
- US-26 (refinement widget — `CommentRefinement`)

## Phase

Phase 5 — AI-Assisted Review (EP-01)
