# opalite

## 0.3.0

### Minor Changes

- 2b19ccc: Add review submission: approve, request changes, or comment on PRs from the terminal. Press `a` to approve or `x` to request changes from the DiffNav screen, with confirmation dialog and optional general comment.
- 3cb556a: Add MyPRs screen (author mode) showing the logged-in user's open PRs with comment counts, unresolved counts, and reviewer statuses. Navigate with j/k/arrows, Enter to open comment queue, d to return to dashboard.

### Patch Changes

- 6e7c62b: Fix `c` and `r` keys not working on diff review screen when file tree is focused.
- 993487a: Add Tab handler stub in comment editor for future AI comment suggestion (US-19).

## 0.2.0

### Minor Changes

- f7e90a9: Add login/logout commands with Bitbucket Cloud authentication via Basic auth (email + API token).
- b159c5f: Add `opalite init` command: workspace selection, repo selection, AI agent detection, and config file management.
- 351475c: Add update checking on startup and `opalite update` command. Non-blocking version check against GitHub releases API with 2s timeout.
- 6cad159: Add PR review dashboard with full-screen TUI showing open PRs across configured repos, grouped by repository with age color-coding, summary stats, and keyboard navigation.
- e517260: Add dashboard keyboard navigation, auto-refresh, and keybinding help bar (US-6).
- db66514: Add screen stack routing with back navigation (Esc/b) between screens.
- 10f374a: Add DiffNav screen for viewing PR diffs with file tree sidebar and side-by-side diff viewer.
- c7aae62: Add ability to view existing PR comments inline in the diff review screen. Comments are fetched from the Bitbucket API, threaded with nested replies, grouped by file for inline display, and shown in a separate section for general comments. File tree shows per-file comment count badges.
- 9e134b5: Add inline comment and reply support on PR diffs. Press `c` to leave a new comment and `r` to reply to an existing thread, with Enter to submit and Esc to cancel.

### Patch Changes

- 01a1d57: Add changeset enforcement via PreToolUse hook, skill updates, and CLAUDE.md docs.
- a34ed12: Fix release action failure by removing hardcoded version in CLI test.
