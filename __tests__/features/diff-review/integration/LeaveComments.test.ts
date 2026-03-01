/**
 * Feature-level functional integration test for US-10: Leave comments on a PR.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → postPRComment (service — POST comment to API)
 *       → buildPostInput (hook logic — build request payload)
 *         → openInlineEditor / openReplyEditor / closeEditor (editor state management)
 *           → formatEditorHeader / formatEditorStatus (widget formatting)
 *             → handleDiffNavKey (c/r keybindings trigger editor)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import { postPRComment, fetchPRComments } from "../../../../src/services/bitbucket";
import {
  openInlineEditor,
  openReplyEditor,
  closeEditor,
  updateEditorText,
  setEditorSubmitting,
  setEditorError,
  buildPostInput,
  type CommentEditorState,
} from "../../../../src/features/diff-review/hooks/useCommentEditor";
import {
  buildCommentThreads,
  groupCommentsByFile,
} from "../../../../src/features/diff-review/hooks/useComments";
import {
  handleDiffNavKey,
  type DiffNavState,
} from "../../../../src/features/diff-review/hooks/useDiffNavigation";
import {
  formatEditorHeader,
  formatEditorStatus,
} from "../../../../src/features/diff-review/widgets/CommentEditor";
import {
  formatCommentThread,
} from "../../../../src/features/diff-review/widgets/CommentThread";
import type { AuthData } from "../../../../src/services/auth";
import type { BitbucketComment, PaginatedResponse } from "../../../../src/types/bitbucket";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

const now = new Date("2026-03-01T12:00:00Z");

function makeBBComment(overrides: Partial<BitbucketComment> = {}): BitbucketComment {
  return {
    id: 1,
    content: { raw: "Looks good!", markup: "markdown", html: "<p>Looks good!</p>" },
    user: { display_name: "Alice Smith", nickname: "alice" },
    created_on: "2026-02-28T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    deleted: false,
    ...overrides,
  };
}

// Existing comments on the PR
const existingCommentsResponse: PaginatedResponse<BitbucketComment> = {
  values: [
    makeBBComment({
      id: 200,
      content: { raw: "Should we add error handling here?", markup: "markdown", html: "" },
      user: { display_name: "Alice Smith", nickname: "alice" },
      inline: { path: "src/auth.ts", to: 45 },
    }),
    makeBBComment({
      id: 300,
      content: { raw: "Overall LGTM", markup: "markdown", html: "" },
      user: { display_name: "Bob", nickname: "bob" },
    }),
  ],
};

// ─── Functional integration tests ───────────────────────────────────────────

describe("US-10 Leave comments functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── AC: "Pressing c opens a comment editor at that line" ─────────────────

  describe("user session: reviewer adds an inline comment", () => {
    it("should open editor on c, compose and post inline comment", async () => {
      // Step 1: User is viewing diff with focus on diff panel, presses 'c'
      const navState: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("c", navState, 3);
      expect(action.action).toBe("open-comment-editor");

      // Step 2: Editor opens for the selected file
      const editorState = openInlineEditor("src/auth.ts", 45);
      expect(editorState.isOpen).toBe(true);
      expect(editorState.mode).toBe("inline");

      // Step 3: Widget formats the header
      const header = formatEditorHeader(editorState.mode, editorState.filePath, editorState.lineNumber);
      expect(header).toBe("Comment on src/auth.ts:45");

      // Step 4: Status bar shows submit/cancel hints
      const status = formatEditorStatus(editorState.submitting, editorState.error);
      expect(status.text).toBe("Enter submit · Esc cancel");
      expect(status.isError).toBe(false);

      // Step 5: User types a comment
      const withText = updateEditorText(editorState, "This needs error handling for 401 responses");
      expect(withText.text).toBe("This needs error handling for 401 responses");

      // Step 6: User presses Enter → build payload and submit
      const input = buildPostInput(withText);
      expect(input.content).toBe("This needs error handling for 401 responses");
      expect(input.inline).toEqual({ path: "src/auth.ts", to: 45 });
      expect(input.parentId).toBeUndefined();

      // Step 7: API call succeeds
      const postedComment: BitbucketComment = {
        id: 500,
        content: { raw: "This needs error handling for 401 responses", markup: "markdown", html: "" },
        user: { display_name: "Reviewer", nickname: "reviewer" },
        created_on: "2026-03-01T12:00:00Z",
        updated_on: "2026-03-01T12:00:00Z",
        inline: { path: "src/auth.ts", to: 45 },
        deleted: false,
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(postedComment), { status: 201 })
      );

      const result = await postPRComment(mockAuth, "acme", "api", 42, input);
      expect(result.id).toBe(500);
      expect(result.content).toBe("This needs error handling for 401 responses");
      expect(result.isInline).toBe(true);
      expect(result.filePath).toBe("src/auth.ts");
      expect(result.lineNumber).toBe(45);

      // Step 8: Editor closes after successful post
      const closedState = closeEditor();
      expect(closedState.isOpen).toBe(false);
      expect(closedState.text).toBe("");

      // Step 9: Comment appears immediately after refresh
      const updatedComments: PaginatedResponse<BitbucketComment> = {
        values: [
          ...existingCommentsResponse.values,
          postedComment,
        ],
      };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedComments), { status: 200 })
      );

      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
      const threads = buildCommentThreads(comments);
      const grouped = groupCommentsByFile(threads);

      // New comment should appear in src/auth.ts inline comments
      const authComments = grouped.fileComments["src/auth.ts"];
      expect(authComments).toBeDefined();
      expect(authComments.length).toBe(2);

      const newThread = authComments.find((t) => t.id === 500);
      expect(newThread).toBeDefined();

      const formatted = formatCommentThread(newThread!, now);
      expect(formatted.parent.content).toBe("This needs error handling for 401 responses");
      expect(formatted.parent.author).toBe("reviewer");
    });
  });

  // ─── AC: "Replying to an existing comment is supported" ───────────────────

  describe("user session: reviewer replies to an existing comment", () => {
    it("should open reply editor on r and post reply with parent.id", async () => {
      // Step 1: User presses 'r' on diff panel
      const navState: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("r", navState, 3);
      expect(action.action).toBe("open-reply-editor");

      // Step 2: Editor opens in reply mode with parent comment id
      const editorState = openReplyEditor(200);
      expect(editorState.isOpen).toBe(true);
      expect(editorState.mode).toBe("reply");
      expect(editorState.parentCommentId).toBe(200);

      // Step 3: Widget formats the header
      const header = formatEditorHeader(editorState.mode);
      expect(header).toBe("Reply to comment");

      // Step 4: User types reply
      const withText = updateEditorText(editorState, "Good catch, will add error handling");

      // Step 5: Build payload includes parent.id
      const input = buildPostInput(withText);
      expect(input.content).toBe("Good catch, will add error handling");
      expect(input.parentId).toBe(200);
      expect(input.inline).toBeUndefined();

      // Step 6: API call posts reply
      const postedReply: BitbucketComment = {
        id: 501,
        content: { raw: "Good catch, will add error handling", markup: "markdown", html: "" },
        user: { display_name: "Reviewer", nickname: "reviewer" },
        created_on: "2026-03-01T12:00:00Z",
        updated_on: "2026-03-01T12:00:00Z",
        inline: { path: "src/auth.ts", to: 45 },
        parent: { id: 200 },
        deleted: false,
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(postedReply), { status: 201 })
      );

      const result = await postPRComment(mockAuth, "acme", "api", 42, input);
      expect(result.id).toBe(501);
      expect(result.parentId).toBe(200);

      // Step 7: After refresh, reply appears nested under parent
      const updatedComments: PaginatedResponse<BitbucketComment> = {
        values: [
          ...existingCommentsResponse.values,
          postedReply,
        ],
      };
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(updatedComments), { status: 200 })
      );

      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
      const threads = buildCommentThreads(comments);
      const grouped = groupCommentsByFile(threads);

      const authComments = grouped.fileComments["src/auth.ts"];
      expect(authComments).toBeDefined();

      // Parent thread should now have the reply nested
      const parentThread = authComments.find((t) => t.id === 200);
      expect(parentThread).toBeDefined();
      expect(parentThread!.replies).toHaveLength(1);
      expect(parentThread!.replies[0].id).toBe(501);

      const formatted = formatCommentThread(parentThread!, now);
      expect(formatted.replyCount).toBe(1);
      expect(formatted.replies[0].content).toBe("Good catch, will add error handling");
    });
  });

  // ─── AC: "Esc cancels without posting" ────────────────────────────────────

  describe("user session: reviewer cancels comment", () => {
    it("should close editor without posting when Esc is pressed", () => {
      // Open editor, type some text
      let editorState = openInlineEditor("src/auth.ts", 45);
      editorState = updateEditorText(editorState, "Draft comment");
      expect(editorState.text).toBe("Draft comment");

      // User presses Esc → editor closes, no API call
      const closed = closeEditor();
      expect(closed.isOpen).toBe(false);
      expect(closed.text).toBe("");

      // No fetch calls were made (except setup)
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ─── AC: "c is only active on diff panel" ────────────────────────────────

  describe("c and r keybindings context", () => {
    it("should not open comment editor when tree panel is focused", () => {
      const navState: DiffNavState = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };

      const cAction = handleDiffNavKey("c", navState, 3);
      expect(cAction.action).toBe("none");

      const rAction = handleDiffNavKey("r", navState, 3);
      expect(rAction.action).toBe("none");
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should show error and keep editor open on API failure", async () => {
      // Open editor and type comment
      let editorState = openInlineEditor("src/auth.ts", 45);
      editorState = updateEditorText(editorState, "Test comment");

      // Set submitting state
      editorState = setEditorSubmitting(editorState, true);
      const submittingStatus = formatEditorStatus(editorState.submitting, editorState.error);
      expect(submittingStatus.text).toBe("Posting...");

      // API returns error
      fetchSpy.mockResolvedValueOnce(
        new Response("Server Error", { status: 500 })
      );

      try {
        await postPRComment(mockAuth, "acme", "api", 42, buildPostInput(editorState));
      } catch (err) {
        // Set error state
        editorState = setEditorError(editorState, (err as Error).message);
      }

      // Editor stays open with error
      expect(editorState.isOpen).toBe(true);
      expect(editorState.error).toContain("Failed to post comment");
      expect(editorState.submitting).toBe(false);

      const errorStatus = formatEditorStatus(editorState.submitting, editorState.error);
      expect(errorStatus.isError).toBe(true);
      expect(errorStatus.text).toContain("Failed to post comment");
      expect(errorStatus.text).toContain("Enter retry");
    });

    it("should handle 401 expired token error", async () => {
      const editorState = updateEditorText(
        openInlineEditor("src/auth.ts", 45),
        "Test comment"
      );

      fetchSpy.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

      try {
        await postPRComment(mockAuth, "acme", "api", 42, buildPostInput(editorState));
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toBe(
          "Your API token has expired. Run `opalite login` to add a new one."
        );
      }
    });
  });

  // ─── General comment (no file context) ────────────────────────────────────

  describe("general comment posting", () => {
    it("should post a general comment without inline context", async () => {
      const editorState: CommentEditorState = {
        isOpen: true,
        mode: "inline",
        text: "Overall the PR looks great!",
        submitting: false,
        error: null,
      };

      const input = buildPostInput(editorState);
      expect(input.content).toBe("Overall the PR looks great!");
      expect(input.inline).toBeUndefined();
      expect(input.parentId).toBeUndefined();

      const postedComment: BitbucketComment = {
        id: 600,
        content: { raw: "Overall the PR looks great!", markup: "markdown", html: "" },
        user: { display_name: "Reviewer", nickname: "reviewer" },
        created_on: "2026-03-01T12:00:00Z",
        updated_on: "2026-03-01T12:00:00Z",
        deleted: false,
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(postedComment), { status: 201 })
      );

      const result = await postPRComment(mockAuth, "acme", "api", 42, input);
      expect(result.id).toBe(600);
      expect(result.isInline).toBe(false);
      expect(result.content).toBe("Overall the PR looks great!");
    });
  });
});
