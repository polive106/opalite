# opalite

## 0.5.0

### Minor Changes

- a8c142a: Add agent service for spawning configured AI CLI agents in print mode. Includes `queryAgent()` to capture agent output, `buildAgentCommand()` for template parsing, and `getAgentConfig()` for reading agent configuration. Handles timeout, ENOENT, non-zero exit, and empty output edge cases.
- 151c274: Add comment refinement prompt builder service (US-24) with buildRefinementPrompt, buildRejectionPrompt, and formatCommentsForPrompt functions.
- d8c7f29: Add comment refinement loop hook (useCommentRefinement) with state machine for AI-assisted comment refinement, multi-round rejection with history truncation, and graceful no-agent degradation.
- 4642c06: Add CommentRefinement widget for AI-assisted review comment refinement loop.
- a665eff: Wire AI comment refinement into the DiffNav comment flow. When a reviewer submits a comment and an agent is configured, the draft is refined through a conversational AI loop (accept/skip/edit/reject) before posting to Bitbucket. Gracefully degrades to direct posting when no agent is configured.

### Patch Changes

- fc0a8f7: Polish TanStack Query integration: add keepPreviousData for smooth transitions, optimistic comment updates with rollback, test QueryClient utility, cache-hit tests, and query pattern docs.

## 0.4.0

### Minor Changes

- 99163d9: Add comment fix queue screen for PR authors to view and manage unresolved comments. Includes keyboard navigation (j/k), resolve (v), reply (r), agent fix (f/F), and clipboard export (e).
- 06e77f7: Integrate TanStack Query for cached data fetching, eliminating loading flicker on screen transitions.

### Patch Changes

- 4063b84: Add project README with installation instructions, usage guide, and configuration docs.
- f73a9e1: Fix `c` and `r` keys not working on diff review screen when file tree is focused.

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
