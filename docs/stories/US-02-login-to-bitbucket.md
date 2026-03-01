# US-2: Log in to Bitbucket

## User Story

**As a** developer,
**I want to** authenticate with Bitbucket by running `opalite login`,
**so that** opalite can access my PRs and repos.

## Acceptance Criteria

- Running `opalite login` prints instructions with a link to https://id.atlassian.com/manage-profile/security/api-tokens
- The CLI prompts for Atlassian email and API token (token input is hidden)
- If the token does not start with `ATAT`, an error is shown explaining the expected format
- The credentials are validated by calling `GET /2.0/user` — if auth fails, a clear error is shown
- On success, the user's display name and username are printed
- Credentials are saved to `~/.config/opalite/auth.json`
- Running `opalite logout` deletes `~/.config/opalite/auth.json` and prints confirmation
- If `opalite` is run without being logged in, it shows "Run `opalite login` first" and exits

## Technical Tasks

- [x] Create `src/services/auth.ts` with `loadAuthFile()`, `saveAuthFile()`, `deleteAuthFile()`, `getAuthHeader()`, and `bbFetch()` functions
- [x] Implement login flow: print instructions, prompt for email and token (hidden input), validate ATAT prefix
- [x] Validate credentials against Bitbucket API (`GET /2.0/user`) using Basic auth
- [x] On success, fetch user info (username, display_name) and save to `~/.config/opalite/auth.json`
- [x] Implement logout: delete auth.json and print confirmation
- [x] Add `login` and `logout` subcommands to CLI entry point (`src/index.tsx`)
- [x] Add auth guard: block all commands except `login`, `--help`, `--version` if not authenticated
- [x] Handle expired tokens: detect 401 responses and show "Your API token has expired. Run `opalite login` to add a new one."

## Files to Create/Modify

- `src/services/auth.ts` (create)
- `src/index.tsx` (modify — add login/logout subcommands)

## Dependencies

- US-1 (CLI entry point must exist)

## Phase

Phase 1 — Installation & Setup
