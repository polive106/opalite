import { describe, expect, it, beforeEach } from "bun:test";
import type { PR } from "../../../../src/types/review";
import type { ReviewerSummary } from "../../../../src/features/author-mode/hooks/useMyPRs";

function makePR(overrides: Partial<PR> = {}): PR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    author: { displayName: "Alice", nickname: "alice" },
    repo: "repo-a",
    commentCount: 5,
    createdOn: new Date("2026-02-27T10:00:00Z"),
    updatedOn: new Date("2026-02-28T10:00:00Z"),
    filesChanged: 3,
    linesAdded: 50,
    linesRemoved: 10,
    url: "https://bitbucket.org/workspace/repo-a/pull-requests/42",
    participants: [
      { displayName: "Bob", nickname: "bob", role: "REVIEWER", approved: true, state: "approved" },
      { displayName: "Charlie", nickname: "charlie", role: "REVIEWER", approved: false, state: "changes_requested" },
      { displayName: "Dave", nickname: "dave", role: "REVIEWER", approved: false, state: null },
    ],
    ...overrides,
  };
}

describe("MyPRRow widget helpers", () => {
  let helpers: typeof import("../../../../src/features/author-mode/widgets/MyPRRow");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/author-mode/widgets/MyPRRow");
  });

  describe("formatMyPRRow", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const reviewerSummary: ReviewerSummary = { approved: 1, changesRequested: 1, pending: 1 };

    it("should format PR data for display", () => {
      const pr = makePR();
      const data = helpers.formatMyPRRow(pr, now, 2, reviewerSummary, 24, 48);

      expect(data.id).toBe(42);
      expect(data.title).toBe("Fix auth flow");
      expect(data.displayTitle).toBe("Fix auth flow");
      expect(data.repo).toBe("repo-a");
      expect(data.age).toBe("2d");
      expect(data.ageColor).toBe("red"); // 60h+ >= 48h critical
      expect(data.commentCount).toBe(5);
      expect(data.unresolvedCount).toBe(2);
    });

    it("should include reviewer summary counts", () => {
      const pr = makePR();
      const data = helpers.formatMyPRRow(pr, now, 0, reviewerSummary, 24, 48);

      expect(data.reviewerSummary.approved).toBe(1);
      expect(data.reviewerSummary.changesRequested).toBe(1);
      expect(data.reviewerSummary.pending).toBe(1);
    });

    it("should truncate long titles", () => {
      const pr = makePR({ title: "This is a very long title that should be truncated" });
      const data = helpers.formatMyPRRow(pr, now, 0, reviewerSummary, 24, 48, 20);

      expect(data.displayTitle).toHaveLength(20);
      expect(data.displayTitle.endsWith("\u2026")).toBe(true); // ellipsis
    });

    it("should not truncate short titles", () => {
      const pr = makePR({ title: "Short" });
      const data = helpers.formatMyPRRow(pr, now, 0, reviewerSummary, 24, 48, 50);

      expect(data.displayTitle).toBe("Short");
    });

    it("should use green color for fresh PRs", () => {
      const pr = makePR({ createdOn: new Date("2026-03-01T06:00:00Z") }); // 6h ago
      const data = helpers.formatMyPRRow(pr, now, 0, reviewerSummary, 24, 48);

      expect(data.ageColor).toBe("green");
      expect(data.age).toBe("6h");
    });

    it("should use yellow color for warning-age PRs", () => {
      const pr = makePR({ createdOn: new Date("2026-02-28T00:00:00Z") }); // 36h ago
      const data = helpers.formatMyPRRow(pr, now, 0, reviewerSummary, 24, 48);

      expect(data.ageColor).toBe("yellow");
    });

    it("should format reviewer status text", () => {
      const pr = makePR();
      const summary: ReviewerSummary = { approved: 2, changesRequested: 1, pending: 0 };
      const data = helpers.formatMyPRRow(pr, now, 3, summary, 24, 48);

      expect(data.reviewerStatusText).toContain("2");
      expect(data.reviewerStatusText).toContain("1");
    });

    it("should handle zero unresolved comments", () => {
      const pr = makePR({ commentCount: 3 });
      const summary: ReviewerSummary = { approved: 0, changesRequested: 0, pending: 0 };
      const data = helpers.formatMyPRRow(pr, now, 0, summary, 24, 48);

      expect(data.unresolvedCount).toBe(0);
      expect(data.commentCount).toBe(3);
    });
  });
});
