import { describe, expect, it } from "bun:test";
import { formatDiffHeader } from "../../../../src/features/diff-review/widgets/DiffHeader";
import type { PR } from "../../../../src/types/review";

function makePR(overrides: Partial<PR> = {}): PR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    author: { displayName: "Alice Smith", nickname: "alice" },
    repo: "api",
    commentCount: 3,
    createdOn: new Date("2026-02-27T10:00:00Z"),
    updatedOn: new Date("2026-02-28T14:00:00Z"),
    filesChanged: 5,
    linesAdded: 120,
    linesRemoved: 30,
    url: "https://bitbucket.org/acme/api/pull-requests/42",
    participants: [],
    ...overrides,
  };
}

describe("formatDiffHeader", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  it("should format PR title with ID", () => {
    const pr = makePR();
    const header = formatDiffHeader(pr, now);

    expect(header.title).toBe("Fix auth flow");
    expect(header.prNumber).toBe(42);
  });

  it("should format author name", () => {
    const pr = makePR();
    const header = formatDiffHeader(pr, now);

    expect(header.author).toBe("alice");
  });

  it("should format branch info", () => {
    const pr = makePR();
    const header = formatDiffHeader(pr, now);

    expect(header.sourceBranch).toBe("feature/auth-fix");
    expect(header.destinationBranch).toBe("main");
  });

  it("should format age", () => {
    const pr = makePR({ createdOn: new Date("2026-02-27T10:00:00Z") });
    const header = formatDiffHeader(pr, now);

    expect(header.age).toBe("2d");
  });

  it("should include repo name", () => {
    const pr = makePR({ repo: "frontend" });
    const header = formatDiffHeader(pr, now);

    expect(header.repo).toBe("frontend");
  });
});
