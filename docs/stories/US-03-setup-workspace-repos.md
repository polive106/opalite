# US-3: Set up workspace and repos

## User Story

**As a** developer,
**I want to** run `opalite init` to select my workspace and repos,
**so that** opalite knows which PRs to show me.

## Acceptance Criteria

- Running `opalite init` without being logged in prompts the user to run `opalite login` first
- The wizard fetches the user's workspaces via `GET /2.0/workspaces`
- If the user belongs to one workspace, it is auto-selected. If multiple, the user picks one
- All repos in the workspace are listed and the user selects which to watch (checkbox-style)
- The wizard detects AI agents in PATH (`claude`, `agent`, `cursor-agent`) and either auto-selects or asks the user to choose
- If no agent is found, the wizard offers to install Claude Code or Cursor CLI (with the install command), or skip
- Config is saved to `~/.config/opalite/config.yml`
- If a `.opalite.yml` exists in the current directory, its values are merged (shared config takes precedence for team settings, local config for personal settings)

## Technical Tasks

- [x] Create `src/services/config.ts` with config loading, merging (shared `.opalite.yml` + local `~/.config/opalite/config.yml`), and saving
- [x] Implement workspace selection: fetch workspaces via API, auto-select if only one, prompt if multiple
- [x] Implement repo selection: list all repos in workspace, checkbox-style selection
- [x] Implement agent detection: check PATH for `claude`, `agent`, `cursor-agent` using `Bun.which()`
- [x] Handle agent scenarios: both found (ask user), one found (auto-select), none found (offer install or skip)
- [x] Save config to `~/.config/opalite/config.yml`
- [x] Add `init` subcommand to CLI entry point (`src/index.tsx`)
- [x] Ensure auth guard blocks `init` if not logged in

## Files to Create/Modify

- `src/services/config.ts` (create)
- `src/index.tsx` (modify — add init subcommand)
- `.opalite.yml` (create — example shared config)

## Dependencies

- US-2 (authentication must work before init can fetch workspaces)

## Phase

Phase 1 — Installation & Setup
