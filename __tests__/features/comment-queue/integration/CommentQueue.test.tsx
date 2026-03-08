/**
 * Feature-level functional integration test for the Comment Queue.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → fetchPRComments (service — auto-pagination, domain transform)
 *       → filterUnresolved / buildCommentThread (hook logic)
 *         → formatCommentRow (widget data transform)
 *           → handleCommentQueueKey (navigation state machine)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import type { BitbucketComment, PaginatedResponse } from "../../../../src/types/bitbucket";
import { fetchPRComments } from "../../../../src/services/bitbucket";
import {
  filterUnresolved,
  buildCommentThread,
} from "../../../../src/features/comment-queue/hooks/useCommentQueue";
import { formatCommentRow } from "../../../../src/features/comment-queue/widgets/CommentRow";
import {
  handleCommentQueueKey,
  type CommentQueueNavigationState,
} from "../../../../src/features/comment-queue/hooks/useCommentQueueNavigation";
import type { AuthData } from "../../../../src/services/auth";
import type { Comment } from "../../../../src/types/review";
import { formatKeyBindings, type KeyBinding } from "../../../../src/features/shared/widgets/KeyBar";

// ─── Test fixtures: raw Bitbucket API responses ───────────────────────────

const mockAuth: AuthData = {
  email: "author@company.com",
  apiToken: "ATATtoken123",
  displayName: "Author",
  username: "author",
};

function makeBBComment(overrides: Partial<BitbucketComment> = {}): BitbucketComment {
  return {
    id: 1,
    content: { raw: "Fix this", markup: "markdown", html: "<p>Fix this</p>" },
    user: { display_name: "Reviewer", nickname: "reviewer" },
    created_on: "2026-02-28T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    deleted: false,
    ...overrides,
  };
}

// ─── Functional integration tests ─────────────────────────────────────────

describe("CommentQueue functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * Helper: set up fetch mock to return comments for a PR.
   */
  function mockCommentAPI(comments: BitbucketComment[]) {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // Match comments endpoint
      const commentMatch = url.match(/\/pullrequests\/\d+\/comments/);
      if (commentMatch) {
        const response: PaginatedResponse<BitbucketComment> = { values: comments };
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  }

  // ─── AC: "Selecting a PR from MyPRs shows all unresolved comments as a numbered list" ──

  it("should fetch comments and filter to unresolved top-level comments", async () => {
    mockCommentAPI([
      makeBBComment({ id: 1, inline: { path: "src/auth.ts", to: 10 } }),
      makeBBComment({ id: 2, inline: { path: "src/utils.ts", to: 20 }, resolved: true }),
      makeBBComment({ id: 3, inline: { path: "src/main.ts", to: 5 } }),
      makeBBComment({ id: 4, parent: { id: 1 }, content: { raw: "reply", markup: "markdown", html: "" }, inline: { path: "src/auth.ts", to: 10 } }),
    ]);

    const comments = await fetchPRComments(mockAuth, "acme", "repo", 42);
    const unresolved = filterUnresolved(comments);

    // Only top-level unresolved: #1 and #3 (not #2 resolved, not #4 reply)
    expect(unresolved).toHaveLength(2);
    expect(unresolved[0].id).toBe(1);
    expect(unresolved[1].id).toBe(3);
  });

  // ─── AC: "Each comment shows: author, file path and line number, comment text" ──

  it("should format each comment with author, location, and content", async () => {
    const now = new Date("2026-03-01T12:00:00Z");

    mockCommentAPI([
      makeBBComment({
        id: 10,
        content: { raw: "This function needs error handling", markup: "markdown", html: "" },
        user: { display_name: "Alice", nickname: "alice" },
        inline: { path: "src/auth.ts", to: 45 },
        created_on: "2026-02-28T10:00:00Z",
      }),
      makeBBComment({
        id: 20,
        content: { raw: "Add unit tests for this module", markup: "markdown", html: "" },
        user: { display_name: "Bob", nickname: "bob" },
        created_on: "2026-03-01T06:00:00Z",
        // General comment (no inline)
      }),
    ]);

    const comments = await fetchPRComments(mockAuth, "acme", "repo", 42);
    const unresolved = filterUnresolved(comments);
    const rows = unresolved.map((c, i) => formatCommentRow(c, i, now));

    expect(rows[0].number).toBe(1);
    expect(rows[0].author).toBe("alice");
    expect(rows[0].location).toBe("src/auth.ts:45");
    expect(rows[0].content).toBe("This function needs error handling");
    expect(rows[0].age).toBe("1d");

    expect(rows[1].number).toBe(2);
    expect(rows[1].author).toBe("bob");
    expect(rows[1].location).toBe("General");
    expect(rows[1].content).toBe("Add unit tests for this module");
    expect(rows[1].age).toBe("6h");
  });

  // ─── AC: "Reply threads are attached to parent comments" ──

  it("should build reply threads for each comment", async () => {
    mockCommentAPI([
      makeBBComment({ id: 1, content: { raw: "Fix this", markup: "markdown", html: "" } }),
      makeBBComment({ id: 2, parent: { id: 1 }, content: { raw: "On it", markup: "markdown", html: "" } }),
      makeBBComment({ id: 3, parent: { id: 1 }, content: { raw: "Done", markup: "markdown", html: "" } }),
      makeBBComment({ id: 4, content: { raw: "Another issue", markup: "markdown", html: "" } }),
    ]);

    const comments = await fetchPRComments(mockAuth, "acme", "repo", 42);
    const unresolved = filterUnresolved(comments);

    // Comment 1 has 2 replies, comment 4 has 0
    const replies1 = buildCommentThread(comments, 1);
    const replies4 = buildCommentThread(comments, 4);

    expect(replies1).toHaveLength(2);
    expect(replies1[0].content).toBe("On it");
    expect(replies1[1].content).toBe("Done");
    expect(replies4).toHaveLength(0);
  });

  // ─── Full user session: load comments → browse → navigate → actions ──────

  describe("user session: author browses unresolved comments", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    let allComments: Comment[];
    let unresolvedComments: Comment[];

    beforeEach(async () => {
      mockCommentAPI([
        makeBBComment({
          id: 100,
          content: { raw: "Missing null check in handleAuth", markup: "markdown", html: "" },
          user: { display_name: "Alice", nickname: "alice" },
          inline: { path: "src/auth.ts", to: 42 },
          created_on: "2026-02-27T10:00:00Z",
        }),
        makeBBComment({
          id: 101,
          content: { raw: "This variable name is unclear", markup: "markdown", html: "" },
          user: { display_name: "Bob", nickname: "bob" },
          inline: { path: "src/utils.ts", to: 15 },
          created_on: "2026-02-28T06:00:00Z",
        }),
        makeBBComment({
          id: 102,
          content: { raw: "Great improvement!", markup: "markdown", html: "" },
          user: { display_name: "Charlie", nickname: "charlie" },
          resolved: true,
        }),
        makeBBComment({
          id: 103,
          content: { raw: "Consider using a Map here", markup: "markdown", html: "" },
          user: { display_name: "Alice", nickname: "alice" },
          inline: { path: "src/main.ts", to: 88 },
          created_on: "2026-03-01T08:00:00Z",
        }),
        // Reply to comment 100
        makeBBComment({
          id: 200,
          parent: { id: 100 },
          content: { raw: "I'll fix this", markup: "markdown", html: "" },
          user: { display_name: "Author", nickname: "author" },
          created_on: "2026-02-28T12:00:00Z",
        }),
      ]);

      allComments = await fetchPRComments(mockAuth, "acme", "repo", 42);
      unresolvedComments = filterUnresolved(allComments);
    });

    it("should show 3 unresolved comments from the 5 total", () => {
      // All 5 non-deleted comments are returned (including resolved + replies)
      expect(allComments).toHaveLength(5);
      // Only top-level unresolved: #100, #101, #103
      expect(unresolvedComments).toHaveLength(3);
    });

    it("should show first comment selected with correct initial state", () => {
      const firstRow = formatCommentRow(unresolvedComments[0], 0, now);
      expect(firstRow.number).toBe(1);
      expect(firstRow.author).toBe("alice");
      expect(firstRow.location).toBe("src/auth.ts:42");
      expect(firstRow.content).toBe("Missing null check in handleAuth");
    });

    it("should let user navigate down through comments", () => {
      let state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };

      // Comment 1 selected: "Missing null check in handleAuth"
      let row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
      expect(row.author).toBe("alice");
      expect(row.location).toBe("src/auth.ts:42");

      // User presses ↓ → Comment 2: "This variable name is unclear"
      let action = handleCommentQueueKey("ArrowDown", state, unresolvedComments);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        state = { selectedIndex: action.index, replyMode: false };
        row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
        expect(row.author).toBe("bob");
        expect(row.location).toBe("src/utils.ts:15");
      }

      // User presses j → Comment 3: "Consider using a Map here"
      action = handleCommentQueueKey("j", state, unresolvedComments);
      if (action.action === "select") {
        state = { selectedIndex: action.index, replyMode: false };
        row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
        expect(row.author).toBe("alice");
        expect(row.location).toBe("src/main.ts:88");
      }

      // At the bottom, pressing ↓ stays at last
      action = handleCommentQueueKey("ArrowDown", state, unresolvedComments);
      if (action.action === "select") {
        expect(action.index).toBe(2);
      }
    });

    it("should let user navigate up through comments", () => {
      let state: CommentQueueNavigationState = { selectedIndex: 2, replyMode: false };

      // Starting at Comment 3
      let row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
      expect(row.location).toBe("src/main.ts:88");

      // Press k → Comment 2
      let action = handleCommentQueueKey("k", state, unresolvedComments);
      if (action.action === "select") {
        state = { selectedIndex: action.index, replyMode: false };
        row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
        expect(row.location).toBe("src/utils.ts:15");
      }

      // Press ↑ → Comment 1
      action = handleCommentQueueKey("ArrowUp", state, unresolvedComments);
      if (action.action === "select") {
        state = { selectedIndex: action.index, replyMode: false };
        row = formatCommentRow(unresolvedComments[state.selectedIndex], state.selectedIndex, now);
        expect(row.location).toBe("src/auth.ts:42");
      }

      // At the top, pressing ↑ stays
      action = handleCommentQueueKey("ArrowUp", state, unresolvedComments);
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    it("should trigger agent fix on f for selected comment", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 1, replyMode: false };
      const action = handleCommentQueueKey("f", state, unresolvedComments);

      expect(action.action).toBe("fix");
      if (action.action === "fix") {
        expect(action.comment.id).toBe(101);
        expect(action.comment.content).toBe("This variable name is unclear");
      }
    });

    it("should trigger batch fix on F", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      const action = handleCommentQueueKey("F", state, unresolvedComments);
      expect(action.action).toBe("batch-fix");
    });

    it("should trigger reply on r for selected comment", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      const action = handleCommentQueueKey("r", state, unresolvedComments);

      expect(action.action).toBe("reply");
      if (action.action === "reply") {
        expect(action.comment.id).toBe(100);
      }
    });

    it("should trigger resolve on v for selected comment", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 2, replyMode: false };
      const action = handleCommentQueueKey("v", state, unresolvedComments);

      expect(action.action).toBe("resolve");
      if (action.action === "resolve") {
        expect(action.comment.id).toBe(103);
      }
    });

    it("should trigger copy-prompt on e for selected comment", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 1, replyMode: false };
      const action = handleCommentQueueKey("e", state, unresolvedComments);

      expect(action.action).toBe("copy-prompt");
      if (action.action === "copy-prompt") {
        expect(action.comment.id).toBe(101);
      }
    });

    it("should go back on b", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      expect(handleCommentQueueKey("b", state, unresolvedComments).action).toBe("back");
    });

    it("should go back on Escape", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      expect(handleCommentQueueKey("Escape", state, unresolvedComments).action).toBe("back");
    });

    it("should quit on q", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      expect(handleCommentQueueKey("q", state, unresolvedComments).action).toBe("quit");
    });

    it("should show reply threads attached to each comment", () => {
      const replies = buildCommentThread(allComments, 100);
      expect(replies).toHaveLength(1);
      expect(replies[0].content).toBe("I'll fix this");

      // Comment with replies should show in formatted row
      const commentWithReplies = { ...unresolvedComments[0], replies };
      const row = formatCommentRow(commentWithReplies, 0, now);
      expect(row.replyCount).toBe(1);
    });
  });

  // ─── AC: "A keybinding help bar is shown at the bottom of the screen" ──

  it("should show key bindings for comment queue actions", () => {
    const commentQueueBindings: KeyBinding[] = [
      { key: "↑↓", label: "navigate" },
      { key: "f", label: "fix" },
      { key: "F", label: "fix all" },
      { key: "r", label: "reply" },
      { key: "v", label: "resolve" },
      { key: "e", label: "copy prompt" },
      { key: "b", label: "back" },
      { key: "q", label: "quit" },
    ];

    const formatted = formatKeyBindings(commentQueueBindings);
    expect(formatted).toHaveLength(8);
    expect(formatted[0].key).toBe("↑↓");
    expect(formatted[1].key).toBe("f");
    expect(formatted[1].label).toBe("fix");
    expect(formatted[3].key).toBe("r");
    expect(formatted[3].label).toBe("reply");
    expect(formatted[4].key).toBe("v");
    expect(formatted[4].label).toBe("resolve");
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty comment list gracefully", async () => {
      mockCommentAPI([]);

      const comments = await fetchPRComments(mockAuth, "acme", "repo", 42);
      const unresolved = filterUnresolved(comments);

      expect(comments).toHaveLength(0);
      expect(unresolved).toHaveLength(0);

      // Navigation on empty list does nothing
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: false };
      expect(handleCommentQueueKey("ArrowDown", state, []).action).toBe("none");
      expect(handleCommentQueueKey("f", state, []).action).toBe("none");
      // But quit and back still work
      expect(handleCommentQueueKey("q", state, []).action).toBe("quit");
      expect(handleCommentQueueKey("b", state, []).action).toBe("back");
    });

    it("should handle all comments being resolved", async () => {
      mockCommentAPI([
        makeBBComment({ id: 1, resolved: true }),
        makeBBComment({ id: 2, resolved: true }),
      ]);

      const comments = await fetchPRComments(mockAuth, "acme", "repo", 42);
      const unresolved = filterUnresolved(comments);

      expect(comments).toHaveLength(2);
      expect(unresolved).toHaveLength(0);
    });

    it("should handle reply mode blocking navigation", () => {
      const state: CommentQueueNavigationState = { selectedIndex: 0, replyMode: true };
      const comments = [
        { id: 1, author: { displayName: "A", nickname: "a" }, content: "test", createdOn: new Date(), isInline: false, resolved: false, deleted: false, replies: [] } as Comment,
      ];

      // All navigation and action keys are blocked in reply mode
      expect(handleCommentQueueKey("j", state, comments).action).toBe("none");
      expect(handleCommentQueueKey("k", state, comments).action).toBe("none");
      expect(handleCommentQueueKey("f", state, comments).action).toBe("none");
      expect(handleCommentQueueKey("v", state, comments).action).toBe("none");
      expect(handleCommentQueueKey("q", state, comments).action).toBe("none");

      // Only Escape cancels reply mode
      expect(handleCommentQueueKey("Escape", state, comments).action).toBe("cancel-reply");
    });
  });
});
