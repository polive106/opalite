/**
 * Feature-level functional integration test for the Dashboard.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → fetchOpenPRsForAllRepos (service — auto-pagination, parallel fetch)
 *       → groupByRepo / sortPRsByAge / computeSummary (hook logic)
 *         → formatPRRow (widget data transform)
 *           → handleDashboardKey (navigation state machine)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 * To replicate this pattern for another feature:
 *   1. Mock globalThis.fetch with API responses for your feature
 *   2. Call the service function to get domain objects
 *   3. Run hook logic (grouping, filtering, etc.) on the result
 *   4. Format for display using widget helpers
 *   5. Simulate user interactions through the key handler
 *   6. Assert both the data and the UI state at each step
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import type { BitbucketPR, PaginatedResponse } from "../../../../src/types/bitbucket";
import type { DiffStatEntry } from "../../../../src/services/bitbucket";
import { fetchOpenPRsForAllRepos } from "../../../../src/services/bitbucket";
import {
  groupByRepo,
  computeSummary,
  formatLastFetch,
  DEFAULT_AUTO_REFRESH_INTERVAL,
} from "../../../../src/features/dashboard/hooks/usePRs";
import { formatPRRow } from "../../../../src/features/dashboard/widgets/PRRow";
import {
  handleDashboardKey,
  type DashboardNavigationState,
} from "../../../../src/features/dashboard/hooks/useDashboardNavigation";
import type { AuthData } from "../../../../src/services/auth";
import type { PR } from "../../../../src/types/review";
import { theme } from "../../../../src/theme/tokyo-night";
import { formatKeyBindings, type KeyBinding } from "../../../../src/features/shared/widgets/KeyBar";

// ─── Test fixtures: raw Bitbucket API responses ───────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

function makeBitbucketPR(overrides: Partial<BitbucketPR> = {}): BitbucketPR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    state: "OPEN",
    source: {
      branch: { name: "feature/auth-fix" },
      repository: { full_name: "acme/api" },
    },
    destination: { branch: { name: "main" } },
    author: { display_name: "Alice Smith", nickname: "alice" },
    participants: [
      {
        user: { display_name: "Bob Jones", nickname: "bob" },
        role: "REVIEWER",
        approved: false,
        state: null,
      },
    ],
    comment_count: 3,
    created_on: "2026-02-27T10:00:00Z",
    updated_on: "2026-02-28T14:00:00Z",
    links: {
      diff: { href: "https://api.bitbucket.org/2.0/repositories/acme/api/pullrequests/42/diff" },
      html: { href: "https://bitbucket.org/acme/api/pull-requests/42" },
    },
    ...overrides,
  };
}

function makeDiffStatResponse(entries: DiffStatEntry[]): PaginatedResponse<DiffStatEntry> {
  return { values: entries };
}

// ─── Functional integration tests ─────────────────────────────────────────

describe("Dashboard functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * Helper: set up fetch mock to return PRs for multiple repos.
   * Each repo gets a PR list response + a diffstat response per PR.
   */
  function mockBitbucketAPI(
    repos: Record<string, BitbucketPR[]>,
    diffStats?: Record<number, DiffStatEntry[]>
  ) {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // Match PR list endpoint: /repositories/{workspace}/{repo}/pullrequests?state=OPEN
      const prListMatch = url.match(/\/repositories\/\w+\/(\w[\w-]*)\/pullrequests\?state=OPEN/);
      if (prListMatch) {
        const repo = prListMatch[1];
        const prs = repos[repo] ?? [];
        const response: PaginatedResponse<BitbucketPR> = { values: prs };
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      // Match diffstat endpoint: /repositories/{workspace}/{repo}/pullrequests/{id}/diffstat
      const diffStatMatch = url.match(/\/pullrequests\/(\d+)\/diffstat/);
      if (diffStatMatch) {
        const prId = parseInt(diffStatMatch[1], 10);
        const entries = diffStats?.[prId] ?? [
          { lines_added: 10, lines_removed: 5, status: "modified" },
        ];
        const response = makeDiffStatResponse(entries);
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  }

  // ─── AC: "Open PRs are fetched from all configured repos in parallel" ───

  it("should fetch PRs from Bitbucket API and transform to domain objects", async () => {
    mockBitbucketAPI({
      api: [
        makeBitbucketPR({ id: 1, title: "Fix endpoint", author: { display_name: "Alice", nickname: "alice" } }),
      ],
      frontend: [
        makeBitbucketPR({ id: 2, title: "Add button", author: { display_name: "Bob", nickname: "bob" } }),
      ],
    });

    const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);

    // Service transforms BitbucketPR → domain PR
    expect(prs).toHaveLength(2);
    expect(prs[0].repo).toBe("api");
    expect(prs[0].author.displayName).toBe("Alice");
    expect(prs[1].repo).toBe("frontend");
    expect(prs[1].author.displayName).toBe("Bob");
    // Diffstat enrichment
    expect(prs[0].linesAdded).toBe(10);
    expect(prs[0].linesRemoved).toBe(5);
    expect(prs[0].filesChanged).toBe(1);
  });

  // ─── AC: "PRs are grouped by repository, repos sorted alphabetically" ──
  // ─── AC: "Within each repo, PRs are sorted by age (oldest first)" ──────

  it("should group by repo (alphabetical) and sort by age (oldest first)", async () => {
    mockBitbucketAPI({
      frontend: [
        makeBitbucketPR({ id: 10, title: "New PR", created_on: "2026-03-01T06:00:00Z" }),
      ],
      api: [
        makeBitbucketPR({ id: 20, title: "Old PR", created_on: "2026-02-25T10:00:00Z" }),
        makeBitbucketPR({ id: 21, title: "Recent PR", created_on: "2026-02-28T10:00:00Z" }),
      ],
    });

    const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["frontend", "api"]);
    const groups = groupByRepo(prs);

    // Repos sorted alphabetically
    expect(groups[0].repo).toBe("api");
    expect(groups[1].repo).toBe("frontend");

    // Within api, oldest first
    expect(groups[0].prs[0].title).toBe("Old PR");
    expect(groups[0].prs[1].title).toBe("Recent PR");
  });

  // ─── AC: "Each PR row shows: status color, PR number, title, age, ..." ─
  // ─── AC: "PR age is color-coded: green < warning, yellow < critical, red >= critical" ─

  it("should format each PR row with correct age color-coding", async () => {
    const now = new Date("2026-03-01T12:00:00Z");

    mockBitbucketAPI({
      api: [
        makeBitbucketPR({ id: 1, title: "Fresh PR", created_on: "2026-03-01T06:00:00Z", comment_count: 0 }),
        makeBitbucketPR({ id: 2, title: "Aging PR", created_on: "2026-02-28T00:00:00Z", comment_count: 5 }),
        makeBitbucketPR({ id: 3, title: "Stale PR", created_on: "2026-02-27T00:00:00Z", comment_count: 12 }),
      ],
    }, {
      1: [{ lines_added: 5, lines_removed: 2, status: "modified" }],
      2: [
        { lines_added: 100, lines_removed: 50, status: "modified" },
        { lines_added: 20, lines_removed: 10, status: "added" },
      ],
      3: [{ lines_added: 3, lines_removed: 1, status: "modified" }],
    });

    const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]);
    const groups = groupByRepo(prs);
    const rows = groups[0].prs.map((pr) => formatPRRow(pr, now, 24, 48));

    // Oldest first after sorting
    expect(rows[0].title).toBe("Stale PR");
    expect(rows[0].age).toBe("2d");
    expect(rows[0].ageColor).toBe("red");       // 60h >= 48h critical
    expect(rows[0].commentCount).toBe(12);
    expect(rows[0].filesChanged).toBe(1);

    expect(rows[1].title).toBe("Aging PR");
    expect(rows[1].age).toBe("1d");
    expect(rows[1].ageColor).toBe("yellow");     // 36h >= 24h warning
    expect(rows[1].linesAdded).toBe(120);         // 100 + 20 from 2 files
    expect(rows[1].linesRemoved).toBe(60);
    expect(rows[1].filesChanged).toBe(2);

    expect(rows[2].title).toBe("Fresh PR");
    expect(rows[2].age).toBe("6h");
    expect(rows[2].ageColor).toBe("green");      // 6h < 24h warning
  });

  // ─── AC: "A summary line at the bottom shows: total open PRs, oldest, avg" ─

  it("should compute summary stats from fetched PRs", async () => {
    const now = new Date("2026-03-01T12:00:00Z");

    mockBitbucketAPI({
      api: [
        makeBitbucketPR({ id: 1, created_on: "2026-02-27T12:00:00Z" }),  // 2d old
        makeBitbucketPR({ id: 2, created_on: "2026-03-01T00:00:00Z" }),  // 12h old
      ],
      frontend: [
        makeBitbucketPR({ id: 3, created_on: "2026-02-28T12:00:00Z" }),  // 1d old
      ],
    });

    const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);
    const summary = computeSummary(prs, now);

    expect(summary.total).toBe(3);
    expect(summary.oldestAge).toBe("2d");
    expect(summary.averageAge).toBe("1d");
  });

  // ─── AC: "The timestamp of the last fetch is shown" ────────────────────

  it("should format last fetch timestamp", () => {
    const now = new Date("2026-03-01T12:05:00Z");
    const fetchTime = new Date("2026-03-01T12:02:00Z");
    expect(formatLastFetch(fetchTime, now)).toBe("3 min ago");

    const recentFetch = new Date("2026-03-01T12:04:45Z");
    expect(formatLastFetch(recentFetch, now)).toBe("just now");
  });

  // ─── Full user session: load → browse → navigate → select → enter ──────

  describe("user session: reviewer browses PRs and opens a review", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    let flatPRs: PR[];
    let groups: ReturnType<typeof groupByRepo>;

    beforeEach(async () => {
      mockBitbucketAPI({
        api: [
          makeBitbucketPR({
            id: 101,
            title: "Fix auth token refresh",
            author: { display_name: "Alice", nickname: "alice" },
            created_on: "2026-02-27T10:00:00Z",
            comment_count: 4,
          }),
          makeBitbucketPR({
            id: 102,
            title: "Add rate limiting",
            author: { display_name: "Charlie", nickname: "charlie" },
            created_on: "2026-02-28T06:00:00Z",
            comment_count: 1,
          }),
        ],
        frontend: [
          makeBitbucketPR({
            id: 201,
            title: "Dark mode toggle",
            author: { display_name: "Bob", nickname: "bob" },
            created_on: "2026-03-01T08:00:00Z",
            comment_count: 0,
          }),
        ],
      });

      // Step 1: Service fetches from Bitbucket API
      const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);

      // Step 2: Hook groups and sorts
      groups = groupByRepo(prs);

      // Step 3: Dashboard builds flat list for navigation
      flatPRs = [];
      for (const group of groups) {
        for (const pr of group.prs) {
          flatPRs.push(pr);
        }
      }
    });

    it("should show PRs grouped by repo with correct initial state", () => {
      // api group first (alphabetical), then frontend
      expect(groups).toHaveLength(2);
      expect(groups[0].repo).toBe("api");
      expect(groups[1].repo).toBe("frontend");

      // 3 PRs total in the flat list
      expect(flatPRs).toHaveLength(3);

      // First PR is selected by default (index 0)
      const firstRow = formatPRRow(flatPRs[0], now, 24, 48);
      expect(firstRow.title).toBe("Fix auth token refresh");
      expect(firstRow.author).toBe("alice");
      expect(firstRow.ageColor).toBe("red");  // 2d+ old
    });

    it("should let user navigate down through the PR list", () => {
      let state: DashboardNavigationState = { selectedIndex: 0 };

      // User sees "Fix auth token refresh" selected (red, oldest in api)
      let row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
      expect(row.title).toBe("Fix auth token refresh");
      expect(row.ageColor).toBe("red");

      // User presses ↓ → "Add rate limiting" (yellow, second in api)
      let action = handleDashboardKey("ArrowDown", state, flatPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        state = { selectedIndex: action.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Add rate limiting");
        expect(row.author).toBe("charlie");
        expect(row.ageColor).toBe("yellow");
      }

      // User presses j → "Dark mode toggle" (green, crosses into frontend group)
      action = handleDashboardKey("j", state, flatPRs);
      if (action.action === "select") {
        state = { selectedIndex: action.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Dark mode toggle");
        expect(row.author).toBe("bob");
        expect(row.ageColor).toBe("green");
        expect(row.commentCount).toBe(0);
      }

      // User presses ↓ at the bottom → stays on last item
      action = handleDashboardKey("ArrowDown", state, flatPRs);
      if (action.action === "select") {
        expect(action.index).toBe(2); // still last
      }
    });

    it("should let user navigate up back through the list", () => {
      let state: DashboardNavigationState = { selectedIndex: 2 };

      // Starting at bottom: "Dark mode toggle"
      let row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
      expect(row.title).toBe("Dark mode toggle");

      // Press k → "Add rate limiting"
      let action = handleDashboardKey("k", state, flatPRs);
      if (action.action === "select") {
        state = { selectedIndex: action.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Add rate limiting");
      }

      // Press ↑ → "Fix auth token refresh"
      action = handleDashboardKey("ArrowUp", state, flatPRs);
      if (action.action === "select") {
        state = { selectedIndex: action.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Fix auth token refresh");
      }

      // Press ↑ at the top → stays on first
      action = handleDashboardKey("ArrowUp", state, flatPRs);
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    it("should open diff review when user presses Enter", () => {
      // User navigated to "Add rate limiting" (index 1)
      const state: DashboardNavigationState = { selectedIndex: 1 };
      const action = handleDashboardKey("Enter", state, flatPRs);

      expect(action.action).toBe("navigate");
      if (action.action === "navigate") {
        expect(action.pr.id).toBe(102);
        expect(action.pr.title).toBe("Add rate limiting");
        expect(action.pr.repo).toBe("api");
      }
    });

    it("should refresh PRs when user presses r", () => {
      const state: DashboardNavigationState = { selectedIndex: 0 };
      const action = handleDashboardKey("r", state, flatPRs);
      expect(action.action).toBe("refresh");
    });

    it("should navigate to my-prs when user presses m", () => {
      const state: DashboardNavigationState = { selectedIndex: 0 };
      const action = handleDashboardKey("m", state, flatPRs);
      expect(action.action).toBe("my-prs");
    });

    it("should quit when user presses q", () => {
      const state: DashboardNavigationState = { selectedIndex: 0 };
      const action = handleDashboardKey("q", state, flatPRs);
      expect(action.action).toBe("quit");
    });

    it("should show correct summary for the session", () => {
      const summary = computeSummary(flatPRs, now);
      expect(summary.total).toBe(3);
      expect(summary.oldestAge).toBe("2d");
    });
  });

  // ─── AC: "A keybinding help bar is shown at the bottom of the screen" ──

  it("should show key bindings including navigate, review, my-prs, refresh, quit", () => {
    const dashboardBindings: KeyBinding[] = [
      { key: "↑↓", label: "navigate" },
      { key: "⏎", label: "review" },
      { key: "m", label: "my PRs" },
      { key: "r", label: "refresh" },
      { key: "q", label: "quit" },
    ];

    const formatted = formatKeyBindings(dashboardBindings);
    expect(formatted).toHaveLength(5);
    expect(formatted[0].key).toBe("↑↓");
    expect(formatted[2].key).toBe("m");
    expect(formatted[2].label).toBe("my PRs");
  });

  // ─── AC: "PRs auto-refresh every 2 minutes (interval configurable)" ────

  it("should have a default auto-refresh interval of 2 minutes", () => {
    expect(DEFAULT_AUTO_REFRESH_INTERVAL).toBe(120);
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty repos gracefully", async () => {
      mockBitbucketAPI({ api: [], frontend: [] });

      const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);
      const groups = groupByRepo(prs);
      const summary = computeSummary(prs, new Date());

      expect(prs).toHaveLength(0);
      expect(groups).toHaveLength(0);
      expect(summary.total).toBe(0);

      // Navigation on empty list does nothing
      const state: DashboardNavigationState = { selectedIndex: 0 };
      expect(handleDashboardKey("ArrowDown", state, []).action).toBe("none");
      expect(handleDashboardKey("Enter", state, []).action).toBe("none");
      // But quit still works
      expect(handleDashboardKey("q", state, []).action).toBe("quit");
    });

    it("should handle partial repo failure (one repo 404s)", async () => {
      // api returns PRs, frontend returns 404
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url.includes("/api/pullrequests")) {
          const response: PaginatedResponse<BitbucketPR> = {
            values: [makeBitbucketPR({ id: 1, title: "API PR" })],
          };
          return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
        }
        if (url.includes("/diffstat")) {
          return Promise.resolve(
            new Response(JSON.stringify(makeDiffStatResponse([{ lines_added: 5, lines_removed: 2, status: "modified" }])), { status: 200 })
          );
        }
        // frontend 404s
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });

      const prs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);

      // Only api PRs come through, frontend silently fails
      expect(prs).toHaveLength(1);
      expect(prs[0].title).toBe("API PR");
    });
  });
});
