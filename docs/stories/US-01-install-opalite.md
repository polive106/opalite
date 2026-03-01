# US-1: Install opalite

## User Story

**As a** developer,
**I want to** install opalite with a single command,
**so that** I can start using it without manual setup steps.

## Acceptance Criteria

- Running `curl -fsSL https://raw.githubusercontent.com/your-org/opalite/main/install.sh | bash` installs opalite globally
- If Bun is not installed, the script offers to install it automatically
- If Bun's global bin directory is not in PATH, the script detects the user's shell (bash/zsh/fish) and appends it to the appropriate rc file
- After install, running `opalite --version` prints the current version
- Running `opalite --help` prints available commands
- The install works on macOS and Linux

## Technical Tasks

- [x] Create `package.json` with name, version, bin entry, and dependencies
- [x] Create `tsconfig.json` with OpenTUI JSX settings
- [x] Create `bunfig.toml` if needed
- [x] Create `src/index.tsx` entry point with CLI arg parsing (`--version`, `--help`, subcommands)
- [x] Implement `--version` flag (reads version from package.json)
- [x] Implement `--help` flag (prints available commands)
- [x] Create `install.sh` that checks for Bun, installs opalite globally, and fixes PATH
- [ ] Verify install works on macOS and Linux

## Files to Create/Modify

- `package.json` (create)
- `tsconfig.json` (create)
- `bunfig.toml` (create)
- `src/index.tsx` (create)
- `install.sh` (create)

## Dependencies

None

## Phase

Phase 1 — Installation & Setup
