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

describe("useCommentQueueNavigation helpers", () => {
  let helpers: typeof import("../../../../src/features/comment-queue/hooks/useCommentQueueNavigation");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/comment-queue/hooks/useCommentQueueNavigation");
  });

  const comments: Comment[] = [
    makeComment({ id: 1, content: "First comment" }),
    makeComment({ id: 2, content: "Second comment" }),
    makeComment({ id: 3, content: "Third comment" }),
  ];

  describe("handleCommentQueueKey", () => {
    // Navigation: ↑/↓ or j/k
    it("should move selection down with ArrowDown", () => {
      const action = helpers.handleCommentQueueKey("ArrowDown", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection down with j", () => {
      const action = helpers.handleCommentQueueKey("j", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection up with ArrowUp", () => {
      const action = helpers.handleCommentQueueKey("ArrowUp", { selectedIndex: 2, replyMode: false }, comments);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection up with k", () => {
      const action = helpers.handleCommentQueueKey("k", { selectedIndex: 1, replyMode: false }, comments);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    it("should clamp at bottom when pressing down on last item", () => {
      const action = helpers.handleCommentQueueKey("ArrowDown", { selectedIndex: 2, replyMode: false }, comments);
      if (action.action === "select") {
        expect(action.index).toBe(2);
      }
    });

    it("should clamp at top when pressing up on first item", () => {
      const action = helpers.handleCommentQueueKey("ArrowUp", { selectedIndex: 0, replyMode: false }, comments);
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    // f → agent fix flow for selected comment
    it("should trigger fix on f", () => {
      const action = helpers.handleCommentQueueKey("f", { selectedIndex: 1, replyMode: false }, comments);
      expect(action.action).toBe("fix");
      if (action.action === "fix") {
        expect(action.comment.id).toBe(2);
      }
    });

    // F → batch fix flow for all comments
    it("should trigger batch-fix on F (shift+f)", () => {
      const action = helpers.handleCommentQueueKey("F", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("batch-fix");
    });

    // r → reply to selected comment
    it("should trigger reply on r", () => {
      const action = helpers.handleCommentQueueKey("r", { selectedIndex: 1, replyMode: false }, comments);
      expect(action.action).toBe("reply");
      if (action.action === "reply") {
        expect(action.comment.id).toBe(2);
      }
    });

    // v → resolve selected comment
    it("should trigger resolve on v", () => {
      const action = helpers.handleCommentQueueKey("v", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("resolve");
      if (action.action === "resolve") {
        expect(action.comment.id).toBe(1);
      }
    });

    // e → copy prompt to clipboard
    it("should trigger copy-prompt on e", () => {
      const action = helpers.handleCommentQueueKey("e", { selectedIndex: 1, replyMode: false }, comments);
      expect(action.action).toBe("copy-prompt");
      if (action.action === "copy-prompt") {
        expect(action.comment.id).toBe(2);
      }
    });

    // b → back to MyPRs
    it("should trigger back on b", () => {
      const action = helpers.handleCommentQueueKey("b", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("back");
    });

    it("should trigger back on Escape", () => {
      const action = helpers.handleCommentQueueKey("Escape", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("back");
    });

    // q → quit
    it("should quit on q", () => {
      const action = helpers.handleCommentQueueKey("q", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("quit");
    });

    // Unrecognized keys
    it("should return none for unrecognized keys", () => {
      const action = helpers.handleCommentQueueKey("x", { selectedIndex: 0, replyMode: false }, comments);
      expect(action.action).toBe("none");
    });

    // Empty list handling
    it("should return none for navigation keys on empty list", () => {
      expect(helpers.handleCommentQueueKey("ArrowDown", { selectedIndex: 0, replyMode: false }, []).action).toBe("none");
      expect(helpers.handleCommentQueueKey("Enter", { selectedIndex: 0, replyMode: false }, []).action).toBe("none");
      expect(helpers.handleCommentQueueKey("f", { selectedIndex: 0, replyMode: false }, []).action).toBe("none");
    });

    it("should still allow back and quit on empty list", () => {
      expect(helpers.handleCommentQueueKey("q", { selectedIndex: 0, replyMode: false }, []).action).toBe("quit");
      expect(helpers.handleCommentQueueKey("b", { selectedIndex: 0, replyMode: false }, []).action).toBe("back");
    });

    // In reply mode, only Escape works to cancel
    it("should return none for navigation keys in reply mode", () => {
      expect(helpers.handleCommentQueueKey("j", { selectedIndex: 0, replyMode: true }, comments).action).toBe("none");
      expect(helpers.handleCommentQueueKey("k", { selectedIndex: 0, replyMode: true }, comments).action).toBe("none");
      expect(helpers.handleCommentQueueKey("f", { selectedIndex: 0, replyMode: true }, comments).action).toBe("none");
    });

    it("should allow Escape to cancel reply mode", () => {
      const action = helpers.handleCommentQueueKey("Escape", { selectedIndex: 0, replyMode: true }, comments);
      expect(action.action).toBe("cancel-reply");
    });
  });
});
