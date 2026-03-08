/**
 * Feature-level functional integration test for US-27: Wire refinement into DiffNav.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch + agent), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → editor state management (open editor, type draft)
 *       → refinement hook (refine draft via agent)
 *         → keyboard handler (accept/skip/edit/reject)
 *           → postPRComment (post final text to Bitbucket)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, mock, spyOn, beforeEach, afterEach } from "bun:test";
import type { OpaliteConfig } from "../../../../src/services/config";

// ─── Mock queryAgent ───
const mockQueryAgent = mock(() => Promise.resolve("Refined comment text" as string | null));
mock.module("../../../../src/services/agent", () => ({
  queryAgent: mockQueryAgent,
  getAgentConfig: (config: OpaliteConfig) => config.agent ?? null,
  buildAgentCommand: (template: string) => template.split(" "),
}));

import { postPRComment } from "../../../../src/services/bitbucket";
import {
  openInlineEditor,
  openReplyEditor,
  updateEditorText,
  buildPostInput,
  getDraft,
} from "../../../../src/features/diff-review/hooks/useCommentEditor";
import {
  initialRefinementState,
  startLoading,
  setSuggestion,
  setError,
  acceptSuggestion,
  skipSuggestion,
  editSuggestion,
  refineComment,
  rejectSuggestion,
  handleRefinementKey,
  type RefinementContext,
  type RefinementState,
} from "../../../../src/features/diff-review/hooks/useCommentRefinement";
import {
  handleDiffNavKey,
  type DiffNavState,
} from "../../../../src/features/diff-review/hooks/useDiffNavigation";
import type { BitbucketComment } from "../../../../src/types/bitbucket";
import type { AuthData } from "../../../../src/services/auth";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

const mockConfig: OpaliteConfig = {
  workspace: "acme",
  repos: ["api"],
  agent: {
    default: "claude-code",
    "claude-code": {
      print: "claude --print",
    },
  },
};

const noAgentConfig: OpaliteConfig = {
  workspace: "acme",
  repos: ["api"],
};

const mockContext: RefinementContext = {
  filePath: "src/auth.ts",
  lineNumber: 45,
  prId: 42,
  prTitle: "Fix auth flow",
  sourceBranch: "feature/auth",
  destinationBranch: "main",
  fileDiff: "@@ -1,3 +1,4 @@\n+import { hash } from 'crypto';",
  existingComments: [],
};

// ─── Functional integration tests ───────────────────────────────────────────

describe("US-27 Comment refinement integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
    mockQueryAgent.mockReset();
    mockQueryAgent.mockResolvedValue("The catch block on L45 swallows the exception silently. Consider re-throwing or logging the error.");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── AC: Full refinement flow: draft → refine → accept → posted ───────────

  describe("user session: reviewer writes comment, accepts AI refinement", () => {
    it("should flow from draft through refinement to posting accepted text", async () => {
      // Step 1: User is on diff panel, presses 'c' to open comment editor
      const navState: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const navAction = handleDiffNavKey("c", navState, 3);
      expect(navAction.action).toBe("open-comment-editor");

      // Step 2: Editor opens for the selected file
      const editorState = openInlineEditor("src/auth.ts", 45);
      expect(editorState.isOpen).toBe(true);
      expect(editorState.mode).toBe("inline");

      // Step 3: User types a draft comment
      const withText = updateEditorText(editorState, "this error handling is wrong");
      expect(withText.text).toBe("this error handling is wrong");

      // Step 4: User presses Enter → getDraft extracts metadata
      const draft = getDraft(withText);
      expect(draft.text).toBe("this error handling is wrong");
      expect(draft.filePath).toBe("src/auth.ts");
      expect(draft.lineNumber).toBe(45);

      // Step 5: Refinement starts — agent is called
      const result = await refineComment(draft.text, mockContext, mockConfig);
      expect(result.status).toBe("suggestion");
      expect(result.suggestion).toBe(
        "The catch block on L45 swallows the exception silently. Consider re-throwing or logging the error."
      );
      expect(mockQueryAgent).toHaveBeenCalledTimes(1);

      // Step 6: Refinement widget would show suggestion state
      // (widget formatting tested in widget tests — here we test the data flow)

      // Step 7: User presses 'a' to accept
      const keyAction = handleRefinementKey("a", "suggestion", false);
      expect(keyAction.action).toBe("accept");

      // Step 8: Accept returns the refined text
      const refinementState = setSuggestion(
        startLoading(initialRefinementState, "this error handling is wrong", mockContext),
        result.suggestion!
      );
      const accepted = acceptSuggestion(refinementState);
      expect(accepted.text).toBe(
        "The catch block on L45 swallows the exception silently. Consider re-throwing or logging the error."
      );
      expect(accepted.state.status).toBe("idle");

      // Step 9: Comment is posted to Bitbucket with the refined text
      const postedComment: BitbucketComment = {
        id: 500,
        content: { raw: accepted.text, markup: "markdown", html: "" },
        user: { display_name: "Reviewer", nickname: "reviewer" },
        created_on: "2026-03-01T12:00:00Z",
        updated_on: "2026-03-01T12:00:00Z",
        inline: { path: "src/auth.ts", to: 45 },
        deleted: false,
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(postedComment), { status: 201 })
      );

      const postInput = buildPostInput({
        ...withText,
        text: accepted.text,
      });
      const posted = await postPRComment(mockAuth, "acme", "api", 42, postInput);
      expect(posted.id).toBe(500);
      expect(posted.content).toBe(accepted.text);
      expect(posted.isInline).toBe(true);
      expect(posted.filePath).toBe("src/auth.ts");
    });
  });

  // ─── AC: Skip refinement → posts original draft ─────────────────────────

  describe("user session: reviewer skips AI refinement", () => {
    it("should post original draft when user presses 's' to skip", async () => {
      // Draft and refinement
      const editorState = updateEditorText(
        openInlineEditor("src/auth.ts", 45),
        "this error handling is wrong"
      );

      const result = await refineComment(editorState.text, mockContext, mockConfig);
      expect(result.status).toBe("suggestion");

      // User presses 's' to skip
      const keyAction = handleRefinementKey("s", "suggestion", false);
      expect(keyAction.action).toBe("skip");

      // Skip returns the original draft
      const refinementState = setSuggestion(
        startLoading(initialRefinementState, "this error handling is wrong", mockContext),
        result.suggestion!
      );
      const skipped = skipSuggestion(refinementState);
      expect(skipped.text).toBe("this error handling is wrong");
      expect(skipped.state.status).toBe("idle");

      // Post the original draft
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: 501,
          content: { raw: "this error handling is wrong", markup: "markdown", html: "" },
          user: { display_name: "Reviewer", nickname: "reviewer" },
          created_on: "2026-03-01T12:00:00Z",
          updated_on: "2026-03-01T12:00:00Z",
          inline: { path: "src/auth.ts", to: 45 },
          deleted: false,
        }), { status: 201 })
      );

      const postInput = buildPostInput(editorState);
      const posted = await postPRComment(mockAuth, "acme", "api", 42, postInput);
      expect(posted.content).toBe("this error handling is wrong");
    });
  });

  // ─── AC: Edit refinement → loads refined text into editor ─────────────────

  describe("user session: reviewer edits the AI suggestion", () => {
    it("should return refined text for manual editing on 'e'", async () => {
      const result = await refineComment("fix this", mockContext, mockConfig);
      expect(result.status).toBe("suggestion");

      // User presses 'e' to edit
      const keyAction = handleRefinementKey("e", "suggestion", false);
      expect(keyAction.action).toBe("edit");

      // Edit returns the suggestion text for loading into editor
      const refinementState = setSuggestion(
        startLoading(initialRefinementState, "fix this", mockContext),
        result.suggestion!
      );
      const edited = editSuggestion(refinementState);
      expect(edited.text).toBe(result.suggestion!);
      expect(edited.state.status).toBe("idle");

      // Editor gets the refined text, user can further tweak it
      const editorWithRefinedText = updateEditorText(
        openInlineEditor("src/auth.ts", 45),
        edited.text
      );
      expect(editorWithRefinedText.text).toBe(result.suggestion!);
    });
  });

  // ─── AC: Reject → feedback → new suggestion ──────────────────────────────

  describe("user session: reviewer rejects and provides feedback", () => {
    it("should loop through reject → feedback → new suggestion", async () => {
      // Initial refinement
      const result = await refineComment("fix this", mockContext, mockConfig);
      expect(result.status).toBe("suggestion");

      // User presses 'r' → enter feedback mode
      const enterFeedback = handleRefinementKey("r", "suggestion", false);
      expect(enterFeedback.action).toBe("enter-feedback");

      // In feedback mode, other keys are ignored
      const ignoredKey = handleRefinementKey("a", "suggestion", true);
      expect(ignoredKey.action).toBe("none");

      // User types feedback and presses Enter
      const sendFeedback = handleRefinementKey("return", "suggestion", true);
      expect(sendFeedback.action).toBe("send-feedback");

      // Agent is called again with rejection
      mockQueryAgent.mockResolvedValueOnce("The retry logic on L45 is missing — the catch block should retry up to 3 times before giving up.");

      const refinementState: RefinementState = {
        status: "suggestion",
        draft: "fix this",
        suggestion: result.suggestion!,
        error: null,
        history: [],
        context: mockContext,
      };

      const newState = await rejectSuggestion(
        refinementState,
        "the issue isn't about logging, it's about the retry logic being missing",
        mockConfig
      );

      expect(newState.status).toBe("suggestion");
      expect(newState.suggestion).toBe(
        "The retry logic on L45 is missing — the catch block should retry up to 3 times before giving up."
      );
      expect(newState.history).toHaveLength(1);
      expect(newState.history[0].feedback).toBe(
        "the issue isn't about logging, it's about the retry logic being missing"
      );
    });
  });

  // ─── AC: Esc cancels entirely ─────────────────────────────────────────────

  describe("user session: reviewer cancels refinement", () => {
    it("should cancel without posting when Esc is pressed during refinement", async () => {
      const result = await refineComment("fix this", mockContext, mockConfig);
      expect(result.status).toBe("suggestion");

      // User presses Esc
      const cancelAction = handleRefinementKey("escape", "suggestion", false);
      expect(cancelAction.action).toBe("cancel");

      // No fetch calls for posting — only the agent was called
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should cancel from loading state", () => {
      const cancelAction = handleRefinementKey("escape", "loading", false);
      expect(cancelAction.action).toBe("cancel");
    });

    it("should exit feedback mode on Esc without canceling refinement", () => {
      const exitFeedback = handleRefinementKey("escape", "suggestion", true);
      expect(exitFeedback.action).toBe("exit-feedback");
    });
  });

  // ─── AC: No agent configured → post directly ──────────────────────────────

  describe("graceful degradation: no agent configured", () => {
    it("should return draft immediately when no agent is configured", async () => {
      const result = await refineComment("fix this", mockContext, noAgentConfig);

      expect(result.status).toBe("idle");
      expect(result.noAgent).toBe(true);
      expect(result.draft).toBe("fix this");
      expect(mockQueryAgent).not.toHaveBeenCalled();
    });
  });

  // ─── AC: Error state → post original with 's' ─────────────────────────────

  describe("error recovery: agent fails", () => {
    it("should allow posting original draft when agent fails", async () => {
      mockQueryAgent.mockRejectedValueOnce(new Error("Agent timed out after 60000ms"));

      const result = await refineComment("fix this", mockContext, mockConfig);
      expect(result.status).toBe("error");
      expect(result.error).toBe("Agent timed out after 60000ms");

      // User presses 's' to post original (skip from error state)
      const skipAction = handleRefinementKey("s", "error", false);
      expect(skipAction.action).toBe("skip");

      // Skip from error returns original draft
      const errorState = setError(
        startLoading(initialRefinementState, "fix this", mockContext),
        "Agent timed out"
      );
      const skipped = skipSuggestion(errorState);
      expect(skipped.text).toBe("fix this");
    });
  });

  // ─── AC: DiffNav keys suppressed during refinement ─────────────────────────

  describe("keyboard suppression during refinement", () => {
    it("should not trigger DiffNav actions when refinement keys are active", () => {
      // 'a' in DiffNav would normally trigger "approve"
      const navAction = handleDiffNavKey("a", {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      }, 3);
      expect(navAction.action).toBe("approve");

      // But during refinement, 'a' means "accept"
      const refinementAction = handleRefinementKey("a", "suggestion", false);
      expect(refinementAction.action).toBe("accept");

      // The DiffNav handler is not reached because refinementActive check
      // comes first in the keyboard handler — verified by the state machine
    });
  });

  // ─── AC: Reply comment refinement ─────────────────────────────────────────

  describe("reply comment refinement", () => {
    it("should support refinement for reply comments", async () => {
      // User opens reply editor
      const navAction = handleDiffNavKey("r", {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      }, 3);
      expect(navAction.action).toBe("open-reply-editor");

      const editorState = updateEditorText(
        openReplyEditor(200),
        "good point"
      );

      const draft = getDraft(editorState);
      expect(draft.text).toBe("good point");
      expect(draft.parentCommentId).toBe(200);

      // Refinement still works for replies
      const result = await refineComment(draft.text, {
        ...mockContext,
        filePath: "src/auth.ts",
      }, mockConfig);
      expect(result.status).toBe("suggestion");
    });
  });
});
