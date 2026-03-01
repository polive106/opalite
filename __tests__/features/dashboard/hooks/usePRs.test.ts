import { describe, expect, it, beforeEach, afterEach, spyOn, mock } from "bun:test";
import type { AuthData } from "../../../../src/services/auth";
import type { PR } from "../../../../src/types/review";
import type { BitbucketPR, PaginatedResponse } from "../../../../src/types/bitbucket";

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

function makePR(overrides: Partial<PR> = {}): PR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    author: { displayName: "Alice", nickname: "alice" },
    repo: "repo-a",
    commentCount: 2,
    createdOn: new Date("2026-02-27T10:00:00Z"),
    updatedOn: new Date("2026-02-28T10:00:00Z"),
    filesChanged: 3,
    linesAdded: 50,
    linesRemoved: 10,
    url: "https://bitbucket.org/workspace/repo-a/pull-requests/42",
    participants: [],
    ...overrides,
  };
}

// We test the pure logic functions exported from usePRs
// (groupByRepo, sortPRsByAge, formatAge, getAgeColor)
// The hook itself is a React hook that uses these functions internally.

describe("usePRs helpers", () => {
  let helpers: typeof import("../../../../src/features/dashboard/hooks/usePRs");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/dashboard/hooks/usePRs");
  });

  describe("groupByRepo", () => {
    it("should group PRs by repository and sort repos alphabetically", () => {
      const prs: PR[] = [
        makePR({ id: 1, repo: "beta-repo" }),
        makePR({ id: 2, repo: "alpha-repo" }),
        makePR({ id: 3, repo: "beta-repo" }),
      ];

      const groups = helpers.groupByRepo(prs);

      expect(groups).toHaveLength(2);
      expect(groups[0].repo).toBe("alpha-repo");
      expect(groups[0].prs).toHaveLength(1);
      expect(groups[1].repo).toBe("beta-repo");
      expect(groups[1].prs).toHaveLength(2);
    });

    it("should return empty array for no PRs", () => {
      const groups = helpers.groupByRepo([]);
      expect(groups).toHaveLength(0);
    });
  });

  describe("sortPRsByAge", () => {
    it("should sort PRs by createdOn date, oldest first", () => {
      const prs: PR[] = [
        makePR({ id: 1, createdOn: new Date("2026-03-01T10:00:00Z") }),
        makePR({ id: 2, createdOn: new Date("2026-02-25T10:00:00Z") }),
        makePR({ id: 3, createdOn: new Date("2026-02-28T10:00:00Z") }),
      ];

      const sorted = helpers.sortPRsByAge(prs);

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe("formatAge", () => {
    it("should format age in hours for less than 24 hours", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const created = new Date("2026-03-01T06:00:00Z");
      expect(helpers.formatAge(created, now)).toBe("6h");
    });

    it("should format age in days for 24+ hours", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const created = new Date("2026-02-27T12:00:00Z");
      expect(helpers.formatAge(created, now)).toBe("2d");
    });

    it("should format age in minutes for less than 1 hour", () => {
      const now = new Date("2026-03-01T12:30:00Z");
      const created = new Date("2026-03-01T12:00:00Z");
      expect(helpers.formatAge(created, now)).toBe("30m");
    });
  });

  describe("getAgeColor", () => {
    it("should return green for PRs younger than warning threshold", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const created = new Date("2026-03-01T00:00:00Z"); // 12 hours ago
      expect(helpers.getAgeColor(created, now, 24, 48)).toBe("green");
    });

    it("should return yellow for PRs between warning and critical thresholds", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const created = new Date("2026-02-28T00:00:00Z"); // 36 hours ago
      expect(helpers.getAgeColor(created, now, 24, 48)).toBe("yellow");
    });

    it("should return red for PRs older than critical threshold", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const created = new Date("2026-02-27T00:00:00Z"); // 60 hours ago
      expect(helpers.getAgeColor(created, now, 24, 48)).toBe("red");
    });
  });

  describe("computeSummary", () => {
    it("should compute total PRs, oldest age, and average age", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const prs: PR[] = [
        makePR({ id: 1, createdOn: new Date("2026-02-27T12:00:00Z") }), // 2 days
        makePR({ id: 2, createdOn: new Date("2026-02-28T12:00:00Z") }), // 1 day
        makePR({ id: 3, createdOn: new Date("2026-03-01T00:00:00Z") }), // 12 hours
      ];

      const summary = helpers.computeSummary(prs, now);

      expect(summary.total).toBe(3);
      expect(summary.oldestAge).toBe("2d");
      expect(summary.averageAge).toBe("1d");
    });

    it("should handle empty PR list", () => {
      const now = new Date("2026-03-01T12:00:00Z");
      const summary = helpers.computeSummary([], now);

      expect(summary.total).toBe(0);
      expect(summary.oldestAge).toBe("0m");
      expect(summary.averageAge).toBe("0m");
    });
  });

  describe("DEFAULT_AUTO_REFRESH_INTERVAL", () => {
    it("should default to 120 seconds (2 minutes)", () => {
      expect(helpers.DEFAULT_AUTO_REFRESH_INTERVAL).toBe(120);
    });
  });

  describe("formatLastFetch", () => {
    it("should format recent fetch as 'just now'", () => {
      const now = new Date("2026-03-01T12:00:30Z");
      const fetchTime = new Date("2026-03-01T12:00:00Z");
      expect(helpers.formatLastFetch(fetchTime, now)).toBe("just now");
    });

    it("should format fetch time in minutes ago", () => {
      const now = new Date("2026-03-01T12:05:00Z");
      const fetchTime = new Date("2026-03-01T12:02:00Z");
      expect(helpers.formatLastFetch(fetchTime, now)).toBe("3 min ago");
    });
  });
});
