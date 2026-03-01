# US-22: Integrate TanStack Query for cached data fetching

## User Story

**As a** user navigating between screens,
**I want** API data to be cached and shared across screens,
**so that** switching between dashboard, diff review, and author mode feels instant and doesn't re-fetch data I already have.

## Acceptance Criteria

- A `QueryClient` is created at app startup and provided via `QueryClientProvider` wrapping `<App />`
- All existing data-fetching hooks (`usePRs`, `useDiff`, `useComments`, `useMyPRs`) are refactored to use `useQuery` / `useMutation` instead of manual `useState`/`useEffect`/`useCallback`
- Navigating away from a screen and back does not trigger a new fetch if cached data is still fresh
- `staleTime` defaults are sensible for each query type:
  - PR lists: ~2 minutes (matches current auto-refresh interval)
  - Diffs: ~5 minutes (diffs change less frequently)
  - Comments: ~1 minute (comments are more dynamic)
- Manual refresh (`r` key on dashboard) calls `invalidateQueries` to force a re-fetch
- Auto-refresh on dashboard still works via `refetchInterval` option
- Loading, error, and data states continue to work as before — no UI regressions
- All existing tests pass after migration (test mocking strategy may change)

## Technical Tasks

- [ ] Install `@tanstack/react-query` via `bun add @tanstack/react-query`
- [ ] Create `src/services/queryClient.ts` — export a configured `QueryClient` with sensible defaults (`staleTime`, `retry`, `refetchOnWindowFocus: false`)
- [ ] Wrap `<App />` in `<QueryClientProvider>` in `src/index.tsx`
- [ ] Define query key factories in `src/services/queryKeys.ts` (e.g., `queryKeys.prs(workspace, repos)`, `queryKeys.diff(workspace, repo, prId)`, `queryKeys.comments(workspace, repo, prId)`)
- [ ] Refactor `src/features/dashboard/hooks/usePRs.ts` — replace manual fetch logic with `useQuery` + `refetchInterval` for auto-refresh
- [ ] Refactor `src/features/diff-review/hooks/useDiff.ts` — replace with `useQuery`
- [ ] Refactor `src/features/diff-review/hooks/useComments.ts` — replace with `useQuery` for fetching, `useMutation` for posting comments
- [ ] Refactor `src/features/author-mode/hooks/useMyPRs.ts` — replace with `useQuery`, reuse PR list cache where possible
- [ ] Refactor `src/features/diff-review/hooks/useReviewSubmit.ts` — replace with `useMutation`, invalidate PR queries on success
- [ ] Update dashboard refresh (`r` key) to call `queryClient.invalidateQueries` instead of manual `refresh()`
- [ ] Keep pure logic functions (`groupByRepo`, `formatAge`, `getAgeColor`, `computeSummary`, `parseDiffToFiles`) unchanged — they stay as pure transforms on query data
- [ ] Update all existing hook tests to mock at the `fetch` level or use a test `QueryClient` wrapper
- [ ] Add integration test verifying cache hit (second render does not trigger a new fetch)
- [ ] Verify `bun test` passes, `npx tsc --noEmit` clean

## Files to Create/Modify

- `src/services/queryClient.ts` (create)
- `src/services/queryKeys.ts` (create)
- `src/index.tsx` (modify — add `QueryClientProvider`)
- `src/features/dashboard/hooks/usePRs.ts` (modify)
- `src/features/diff-review/hooks/useDiff.ts` (modify)
- `src/features/diff-review/hooks/useComments.ts` (modify)
- `src/features/author-mode/hooks/useMyPRs.ts` (modify)
- `src/features/diff-review/hooks/useReviewSubmit.ts` (modify)
- `__tests__/features/dashboard/hooks/usePRs.test.ts` (modify)
- `__tests__/features/diff-review/hooks/useDiff.test.ts` (modify)
- `__tests__/features/diff-review/hooks/useComments.test.ts` (modify)

## Dependencies

- US-5 (existing data-fetching hooks)
- US-8 (diff view hooks)
- US-9 (comment hooks)
- US-12 (author mode hooks)

## Phase

Phase 5 — Polish
