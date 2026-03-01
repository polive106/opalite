import { describe, expect, it } from "bun:test";
import type { PR } from "../../../../src/types/review";
import {
  formatPRRow,
  type PRRowData,
} from "../../../../src/features/dashboard/widgets/PRRow";

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

describe("formatPRRow", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  it("should format PR data for display", () => {
    const pr = makePR();
    const data = formatPRRow(pr, now, 24, 48);

    expect(data.id).toBe(42);
    expect(data.title).toBe("Fix auth flow");
    expect(data.author).toBe("alice");
    expect(data.age).toBe("2d");
    expect(data.ageColor).toBe("red");
    expect(data.filesChanged).toBe(3);
    expect(data.linesAdded).toBe(50);
    expect(data.linesRemoved).toBe(10);
    expect(data.commentCount).toBe(2);
  });

  it("should show green for recent PRs", () => {
    const pr = makePR({ createdOn: new Date("2026-03-01T06:00:00Z") });
    const data = formatPRRow(pr, now, 24, 48);
    expect(data.ageColor).toBe("green");
  });

  it("should show yellow for warning-age PRs", () => {
    const pr = makePR({ createdOn: new Date("2026-02-28T00:00:00Z") }); // 36h ago
    const data = formatPRRow(pr, now, 24, 48);
    expect(data.ageColor).toBe("yellow");
  });

  it("should truncate long titles", () => {
    const longTitle = "A".repeat(100);
    const pr = makePR({ title: longTitle });
    const data = formatPRRow(pr, now, 24, 48, 60);
    expect(data.displayTitle.length).toBeLessThanOrEqual(60);
  });
});
