# US-5: View open PRs across repos

## User Story

**As a** reviewer,
**I want to** see all open PRs across my configured repos in a single dashboard,
**so that** I can see what needs reviewing without checking Bitbucket or Slack.

## Acceptance Criteria

- Running `opalite` shows a full-screen TUI dashboard
- Open PRs are fetched from all configured repos in parallel
- PRs are grouped by repository, repos sorted alphabetically
- Within each repo, PRs are sorted by age (oldest first)
- Each PR row shows: status color, PR number, title, age, file count, lines added/removed, author, comment count
- PR age is color-coded: green (< `warning` threshold, default 24h), yellow (< `critical`, default 48h), red (>= `critical`)
- A summary line at the bottom shows: total open PRs, oldest PR age, average age
- The timestamp of the last fetch is shown (e.g. "⟳ 2 min ago")
- `q` quits the app
- The dashboard renders correctly at different terminal sizes

## Technical Tasks

- [ ] Create `src/types/bitbucket.ts` with `BitbucketPR`, `BitbucketComment`, and paginated response types
- [ ] Create `src/types/review.ts` with domain types (`PR`, `Comment`, `Review`, etc.)
- [ ] Create `src/services/bitbucket.ts` with API client: list open PRs, auto-pagination, parallel fetching across repos
- [ ] Create `src/hooks/usePRs.ts` hook: fetch PRs from all repos, return `{ prs, loading, error, refresh }`
- [ ] Create `src/theme/tokyo-night.ts` with default color theme
- [ ] Create `src/components/PRRow.tsx` component: render a single PR with status color, title, age, stats
- [ ] Create `src/screens/Dashboard.tsx`: full-screen dashboard with PR list grouped by repo
- [ ] Implement age color-coding based on configurable warning/critical thresholds
- [ ] Implement summary line (total PRs, oldest age, average age)
- [ ] Implement "last fetch" timestamp display
- [ ] Ensure responsive layout using `useTerminalDimensions()`

## Files to Create/Modify

- `src/types/bitbucket.ts` (create)
- `src/types/review.ts` (create)
- `src/services/bitbucket.ts` (create)
- `src/hooks/usePRs.ts` (create)
- `src/theme/tokyo-night.ts` (create)
- `src/components/PRRow.tsx` (create)
- `src/screens/Dashboard.tsx` (create)

## Dependencies

- US-1 (CLI entry point)
- US-2 (authentication for API calls)
- US-3 (config with workspace and repo list)

## Phase

Phase 2 — Review Dashboard
