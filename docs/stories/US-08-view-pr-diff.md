# US-8: View PR diff with file tree

## User Story

**As a** reviewer,
**I want to** view a PR's diff with a file tree sidebar and side-by-side diff,
**so that** I can review code changes in my terminal.

## Acceptance Criteria

- Pressing `Enter` on a PR in the dashboard opens the DiffNav screen
- The screen has two panels: file tree sidebar (left) and diff viewer (right)
- The file tree lists all changed files with their change counts (+/-)
- The currently selected file is highlighted in the file tree
- The diff viewer shows the selected file's changes using OpenTUI's `<diff>` component
- The PR title, author, branches, and age are shown in a header
- `Tab` toggles focus between file tree and diff viewer
- `Up`/`Down` or `j`/`k` scrolls the focused panel
- `n`/`N` jumps to the next/previous changed file
- `u` toggles between split (side-by-side) and unified diff view
- `Esc` or `b` goes back to the dashboard

## Technical Tasks

- [x] Create `src/features/diff-review/hooks/useDiff.ts` hook: fetch diff from Bitbucket API, parse unified diff into file-level chunks, return `{ files, fileDiffs, loading, error }`
- [x] Create `src/features/diff-review/widgets/FileTree.tsx` component: sidebar listing changed files with +/- counts, highlight selected file
- [x] Create `src/features/diff-review/ui/DiffNav.tsx` with two-panel layout (file tree + diff viewer)
- [x] Implement PR header showing title, author, source/dest branches, and age (`src/features/diff-review/widgets/DiffHeader.tsx`)
- [x] Use OpenTUI's `<diff>` component for rendering diffs with `view="split"` and `view="unified"`
- [x] Implement `Tab` to toggle focus between file tree and diff viewer
- [x] Implement `j`/`k`/`Up`/`Down` for scrolling the focused panel
- [x] Implement `n`/`N` for next/previous file navigation
- [x] Implement `u` to toggle split/unified diff view
- [x] Implement `Esc`/`b` for back navigation
- [x] Add KeyBar with DiffNav-specific bindings
- [x] Add `fetchDiffStatFiles` and `fetchPRDiff` to `src/services/bitbucket.ts`
- [x] Wire DiffNav into `src/App.tsx` screen router

## Files to Create/Modify

- `src/services/bitbucket.ts` (modify — add `fetchDiffStatFiles`, `fetchPRDiff`)
- `src/features/diff-review/hooks/useDiff.ts` (create)
- `src/features/diff-review/hooks/useDiffNavigation.ts` (create)
- `src/features/diff-review/widgets/FileTree.tsx` (create)
- `src/features/diff-review/widgets/DiffHeader.tsx` (create)
- `src/features/diff-review/ui/DiffNav.tsx` (create)
- `src/App.tsx` (modify — wire DiffNav screen)

## Dependencies

- US-5 (Bitbucket API client for fetching diffs)
- US-7 (screen routing to navigate from dashboard to DiffNav)

## Phase

Phase 3 — Inline Review
