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

- [ ] Create `src/hooks/useDiff.ts` hook: fetch diff from Bitbucket API, parse unified diff into file-level chunks, return `{ files, loading, error }`
- [ ] Create `src/components/FileTree.tsx` component: sidebar listing changed files with +/- counts, highlight selected file
- [ ] Create `src/screens/DiffNav.tsx` with two-panel layout (file tree + diff viewer)
- [ ] Implement PR header showing title, author, source/dest branches, and age
- [ ] Use OpenTUI's `<diff>` component for rendering diffs with `viewMode="split"` and `viewMode="unified"`
- [ ] Implement `Tab` to toggle focus between file tree and diff viewer
- [ ] Implement `j`/`k`/`Up`/`Down` for scrolling the focused panel
- [ ] Implement `n`/`N` for next/previous file navigation
- [ ] Implement `u` to toggle split/unified diff view
- [ ] Implement `Esc`/`b` for back navigation
- [ ] Add KeyBar with DiffNav-specific bindings

## Files to Create/Modify

- `src/hooks/useDiff.ts` (create)
- `src/components/FileTree.tsx` (create)
- `src/screens/DiffNav.tsx` (create)

## Dependencies

- US-5 (Bitbucket API client for fetching diffs)
- US-7 (screen routing to navigate from dashboard to DiffNav)

## Phase

Phase 3 — Inline Review
