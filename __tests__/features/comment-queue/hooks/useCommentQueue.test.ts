import { describe, expect, it, beforeEach } from "bun:test";
import type { Comment } from "../../../../src/types/review";

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

describe("useCommentQueue helpers", () => {
  let helpers: typeof import("../../../../src/features/comment-queue/hooks/useCommentQueue");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/comment-queue/hooks/useCommentQueue");
  });

  describe("filterUnresolved", () => {
    it("should return only unresolved top-level comments", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: true }),
        makeComment({ id: 3, resolved: false }),
      ];

      const result = helpers.filterUnresolved(comments);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it("should exclude replies (comments with parentId)", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: false, parentId: 1 }),
        makeComment({ id: 3, resolved: false, parentId: 1 }),
      ];

      const result = helpers.filterUnresolved(comments);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should return empty array for empty input", () => {
      expect(helpers.filterUnresolved([])).toHaveLength(0);
    });

    it("should return empty array when all comments are resolved", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: true }),
        makeComment({ id: 2, resolved: true }),
      ];

      expect(helpers.filterUnresolved(comments)).toHaveLength(0);
    });

    it("should exclude resolved replies too", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: true, parentId: 1 }),
      ];

      const result = helpers.filterUnresolved(comments);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("buildCommentThread", () => {
    it("should attach replies to their parent comment", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: false, parentId: 1, content: "reply 1" }),
        makeComment({ id: 3, resolved: false, parentId: 1, content: "reply 2" }),
      ];

      const threads = helpers.buildCommentThread(comments, 1);

      expect(threads).toHaveLength(2);
      expect(threads[0].content).toBe("reply 1");
      expect(threads[1].content).toBe("reply 2");
    });

    it("should return empty array when no replies exist", () => {
      const comments: Comment[] = [
        makeComment({ id: 1, resolved: false }),
        makeComment({ id: 2, resolved: false }),
      ];

      const threads = helpers.buildCommentThread(comments, 1);
      expect(threads).toHaveLength(0);
    });
  });

  describe("truncateContent", () => {
    it("should return content unchanged if shorter than max", () => {
      expect(helpers.truncateContent("short text", 100)).toBe("short text");
    });

    it("should truncate long content and add ellipsis", () => {
      const longText = "a".repeat(200);
      const result = helpers.truncateContent(longText, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith("…")).toBe(true);
    });

    it("should handle empty content", () => {
      expect(helpers.truncateContent("", 50)).toBe("");
    });
  });
});
