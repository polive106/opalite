import { describe, expect, it, mock, spyOn, beforeEach } from "bun:test";
import type { PR } from "../../../../src/types/review";
import {
  groupByRepo,
  computeSummary,
  formatLastFetch,
} from "../../../../src/features/dashboard/hooks/usePRs";
import { formatPRRow } from "../../../../src/features/dashboard/widgets/PRRow";
import {
  handleDashboardKey,
  type DashboardNavigationState,
} from "../../../../src/features/dashboard/hooks/useDashboardNavigation";

function makeDomainPR(overrides: Partial<PR> = {}): PR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    author: { displayName: "Alice", nickname: "alice" },
    repo: "semble-api",
    commentCount: 2,
    createdOn: new Date("2026-02-27T10:00:00Z"),
    updatedOn: new Date("2026-02-28T10:00:00Z"),
    filesChanged: 3,
    linesAdded: 50,
    linesRemoved: 10,
    url: "https://bitbucket.org/workspace/semble-api/pull-requests/42",
    participants: [],
    ...overrides,
  };
}

describe("Dashboard integration", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  describe("data pipeline: fetch → group → format → display", () => {
    it("should group PRs by repo and format rows for display", () => {
      const prs: PR[] = [
        makeDomainPR({ id: 1, repo: "frontend", title: "Add button" }),
        makeDomainPR({ id: 2, repo: "api", title: "Fix endpoint" }),
        makeDomainPR({ id: 3, repo: "frontend", title: "Update styles" }),
      ];

      const groups = groupByRepo(prs);

      expect(groups).toHaveLength(2);
      expect(groups[0].repo).toBe("api");
      expect(groups[1].repo).toBe("frontend");

      const firstPRRow = formatPRRow(groups[0].prs[0], now, 24, 48);
      expect(firstPRRow.title).toBe("Fix endpoint");
      expect(firstPRRow.ageColor).toBe("red");
    });

    it("should compute summary from all PRs", () => {
      const prs: PR[] = [
        makeDomainPR({ id: 1, createdOn: new Date("2026-02-27T12:00:00Z") }),
        makeDomainPR({ id: 2, createdOn: new Date("2026-03-01T00:00:00Z") }),
      ];

      const summary = computeSummary(prs, now);
      expect(summary.total).toBe(2);
      expect(summary.oldestAge).toBe("2d");
    });

    it("should format last fetch time", () => {
      const fetchTime = new Date("2026-03-01T11:58:00Z");
      expect(formatLastFetch(fetchTime, now)).toBe("2 min ago");
    });

    it("should handle empty state", () => {
      const groups = groupByRepo([]);
      const summary = computeSummary([], now);
      expect(groups).toHaveLength(0);
      expect(summary.total).toBe(0);
    });
  });

  describe("keyboard navigation with mocked usePRs data", () => {
    // Simulate what Dashboard does: usePRs returns data, we build flatPRs, then handle keys
    const mockUsePRsResult = {
      prs: [
        makeDomainPR({ id: 1, repo: "api", title: "Fix endpoint", createdOn: new Date("2026-02-27T10:00:00Z") }),
        makeDomainPR({ id: 2, repo: "api", title: "Add validation", createdOn: new Date("2026-02-28T10:00:00Z") }),
        makeDomainPR({ id: 3, repo: "frontend", title: "Add button", createdOn: new Date("2026-03-01T06:00:00Z") }),
      ],
      loading: false,
      error: null,
      lastFetch: new Date("2026-03-01T11:58:00Z"),
    };

    // Dashboard builds groups and flatPRs from usePRs result
    const groups = groupByRepo(mockUsePRsResult.prs);
    const flatPRs: PR[] = [];
    for (const group of groups) {
      for (const pr of group.prs) {
        flatPRs.push(pr);
      }
    }
    const summary = computeSummary(mockUsePRsResult.prs, now);

    it("should build flat PR list from grouped data", () => {
      // Groups: api (2 PRs), frontend (1 PR)
      expect(groups).toHaveLength(2);
      expect(flatPRs).toHaveLength(3);
      // api PRs first (sorted alphabetically), sorted by age (oldest first)
      expect(flatPRs[0].repo).toBe("api");
      expect(flatPRs[1].repo).toBe("api");
      expect(flatPRs[2].repo).toBe("frontend");
    });

    it("should move cursor down through PR list on ArrowDown", () => {
      let state: DashboardNavigationState = { selectedIndex: 0 };

      // Start at first PR
      let row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
      expect(row.title).toBe("Fix endpoint");

      // Press ArrowDown → moves to second PR
      let result = handleDashboardKey("ArrowDown", state, flatPRs);
      expect(result.action).toBe("select");
      if (result.action === "select") {
        state = { selectedIndex: result.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Add validation");
      }

      // Press j → moves to third PR (crosses repo boundary)
      result = handleDashboardKey("j", state, flatPRs);
      if (result.action === "select") {
        state = { selectedIndex: result.index };
        row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Add button");
        expect(row.ageColor).toBe("green"); // frontend PR is recent
      }
    });

    it("should move cursor up through PR list on ArrowUp", () => {
      let state: DashboardNavigationState = { selectedIndex: 2 };

      // Press ArrowUp → moves from third to second
      let result = handleDashboardKey("ArrowUp", state, flatPRs);
      if (result.action === "select") {
        state = { selectedIndex: result.index };
        const row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Add validation");
      }

      // Press k → moves from second to first
      result = handleDashboardKey("k", state, flatPRs);
      if (result.action === "select") {
        state = { selectedIndex: result.index };
        const row = formatPRRow(flatPRs[state.selectedIndex], now, 24, 48);
        expect(row.title).toBe("Fix endpoint");
      }
    });

    it("should clamp cursor at list boundaries", () => {
      // Can't go above 0
      let state: DashboardNavigationState = { selectedIndex: 0 };
      let result = handleDashboardKey("ArrowUp", state, flatPRs);
      if (result.action === "select") {
        expect(result.index).toBe(0);
      }

      // Can't go below last
      state = { selectedIndex: flatPRs.length - 1 };
      result = handleDashboardKey("ArrowDown", state, flatPRs);
      if (result.action === "select") {
        expect(result.index).toBe(flatPRs.length - 1);
      }
    });

    it("should navigate to selected PR on Enter", () => {
      const state: DashboardNavigationState = { selectedIndex: 1 };
      const result = handleDashboardKey("Enter", state, flatPRs);

      expect(result.action).toBe("navigate");
      if (result.action === "navigate") {
        expect(result.pr.id).toBe(flatPRs[1].id);
        expect(result.pr.title).toBe("Add validation");
      }
    });

    it("should trigger refresh on r key", () => {
      const state: DashboardNavigationState = { selectedIndex: 0 };
      const result = handleDashboardKey("r", state, flatPRs);
      expect(result.action).toBe("refresh");
    });

    it("should trigger quit on q key", () => {
      const state: DashboardNavigationState = { selectedIndex: 0 };
      const result = handleDashboardKey("q", state, flatPRs);
      expect(result.action).toBe("quit");
    });

    it("should display correct summary line", () => {
      expect(summary.total).toBe(3);
      expect(summary.oldestAge).toBe("2d");
    });

    it("should display correct last fetch time", () => {
      const lastFetchText = formatLastFetch(mockUsePRsResult.lastFetch, now);
      expect(lastFetchText).toBe("2 min ago");
    });

    it("should color-code each PR age correctly", () => {
      const rows = flatPRs.map((pr) => formatPRRow(pr, now, 24, 48));

      // api/Fix endpoint: 2d old → red
      expect(rows[0].ageColor).toBe("red");
      // api/Add validation: 1d old → yellow
      expect(rows[1].ageColor).toBe("yellow");
      // frontend/Add button: 6h old → green
      expect(rows[2].ageColor).toBe("green");
    });
  });
});
