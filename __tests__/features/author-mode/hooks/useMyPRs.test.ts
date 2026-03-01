import { describe, expect, it, beforeEach } from "bun:test";
import type { PR, Participant } from "../../../../src/types/review";
import type { Comment } from "../../../../src/types/review";

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

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { displayName: "Bob", nickname: "bob" },
    content: "Fix this",
    createdOn: new Date("2026-02-28T10:00:00Z"),
    isInline: true,
    filePath: "src/index.ts",
    lineNumber: 10,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

describe("useMyPRs helpers", () => {
  let helpers: typeof import("../../../../src/features/author-mode/hooks/useMyPRs");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/author-mode/hooks/useMyPRs");
  });

  describe("filterMyPRs", () => {
    it("should return only PRs authored by the given username", () => {
      const prs: PR[] = [
        makePR({ id: 1, author: { displayName: "Alice", nickname: "alice" } }),
        makePR({ id: 2, author: { displayName: "Bob", nickname: "bob" } }),
        makePR({ id: 3, author: { displayName: "Alice", nickname: "alice" } }),
      ];

      const myPRs = helpers.filterMyPRs(prs, "alice");

      expect(myPRs).toHaveLength(2);
      expect(myPRs[0].id).toBe(1);
      expect(myPRs[1].id).toBe(3);
    });

    it("should return empty array when no PRs match the username", () => {
      const prs: PR[] = [
        makePR({ id: 1, author: { displayName: "Bob", nickname: "bob" } }),
      ];

      const myPRs = helpers.filterMyPRs(prs, "alice");

      expect(myPRs).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      const myPRs = helpers.filterMyPRs([], "alice");
      expect(myPRs).toHaveLength(0);
    });
  });

  describe("countUnresolved", () => {
    it("should count top-level unresolved comments", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: true }),
        makeComment({ id: 3, resolved: false }),
      ];

      expect(helpers.countUnresolved(comments)).toBe(2);
    });

    it("should exclude replies (comments with parentId)", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: false, parentId: 1 }),
      ];

      expect(helpers.countUnresolved(comments)).toBe(1);
    });

    it("should return 0 for empty array", () => {
      expect(helpers.countUnresolved([])).toBe(0);
    });

    it("should return 0 when all comments are resolved", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: true }),
        makeComment({ id: 2, resolved: true }),
      ];

      expect(helpers.countUnresolved(comments)).toBe(0);
    });
  });

  describe("getReviewerSummary", () => {
    it("should count approved, changes requested, and pending reviewers", () => {
      const participants: Participant[] = [
        { displayName: "Bob", nickname: "bob", role: "REVIEWER", approved: true, state: "approved" },
        { displayName: "Charlie", nickname: "charlie", role: "REVIEWER", approved: false, state: "changes_requested" },
        { displayName: "Dave", nickname: "dave", role: "REVIEWER", approved: false, state: null },
      ];
      const pr = makePR({ participants });

      const summary = helpers.getReviewerSummary(pr);

      expect(summary.approved).toBe(1);
      expect(summary.changesRequested).toBe(1);
      expect(summary.pending).toBe(1);
    });

    it("should exclude non-reviewer participants", () => {
      const participants: Participant[] = [
        { displayName: "Alice", nickname: "alice", role: "AUTHOR", approved: false, state: null },
        { displayName: "Bob", nickname: "bob", role: "REVIEWER", approved: true, state: "approved" },
        { displayName: "Charlie", nickname: "charlie", role: "PARTICIPANT", approved: false, state: null },
      ];
      const pr = makePR({ participants });

      const summary = helpers.getReviewerSummary(pr);

      expect(summary.approved).toBe(1);
      expect(summary.changesRequested).toBe(0);
      expect(summary.pending).toBe(0);
    });

    it("should return all zeros for PR with no reviewers", () => {
      const pr = makePR({ participants: [] });

      const summary = helpers.getReviewerSummary(pr);

      expect(summary.approved).toBe(0);
      expect(summary.changesRequested).toBe(0);
      expect(summary.pending).toBe(0);
    });
  });
});
