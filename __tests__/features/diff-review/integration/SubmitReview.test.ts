/**
 * Feature-level functional integration test for US-11: Submit a review.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → approvePR / requestChangesPR / postPRComment (service endpoints)
 *       → initReviewState / setReviewAction / setGeneralComment (hook state)
 *         → formatReviewTitle / formatReviewStatus / formatActionLabel (widget formatting)
 *           → handleDiffNavKey (a/x keybindings trigger navigation to review screen)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import {
  approvePR,
  requestChangesPR,
  unapprovePR,
  postPRComment,
} from "../../../../src/services/bitbucket";
import {
  initReviewState,
  setReviewAction,
  setGeneralComment,
  setSubmitting,
  setError,
  type ReviewSubmitState,
} from "../../../../src/features/diff-review/hooks/useReviewSubmit";
import {
  handleDiffNavKey,
  type DiffNavState,
} from "../../../../src/features/diff-review/hooks/useDiffNavigation";
import {
  formatReviewTitle,
  formatReviewStatus,
  formatActionLabel,
  REVIEW_ACTION_OPTIONS,
} from "../../../../src/features/diff-review/widgets/ReviewConfirmation";
import {
  pushScreen,
  popScreen,
  currentScreen,
} from "../../../../src/features/shared/hooks/useScreenStack";
import type { Screen } from "../../../../src/App";
import type { AuthData } from "../../../../src/services/auth";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

const mockPR = {
  id: 42,
  title: "Fix auth token refresh",
  description: "Fixes token refresh",
  sourceBranch: "feature/auth-fix",
  destinationBranch: "main",
  author: { displayName: "Alice", nickname: "alice" },
  repo: "api",
  commentCount: 3,
  createdOn: new Date("2026-02-27T10:00:00Z"),
  updatedOn: new Date("2026-02-28T10:00:00Z"),
  filesChanged: 5,
  linesAdded: 50,
  linesRemoved: 10,
  url: "https://bitbucket.org/acme/api/pull-requests/42",
  participants: [],
};

// ─── Functional integration tests ───────────────────────────────────────────

describe("US-11 Submit review functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── AC: "Pressing a from DiffNav approves the PR" ────────────────────

  describe("user session: reviewer approves a PR", () => {
    it("should navigate to review-submit on 'a', confirm, and approve", async () => {
      // Step 1: User presses 'a' while viewing diff
      const navState: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("a", navState, 3);
      expect(action.action).toBe("approve");

      // Step 2: DiffNav navigates to review-submit screen with approve pre-selected
      let stack: Screen[] = [
        { name: "dashboard" },
        { name: "diffnav", pr: mockPR },
      ];
      stack = pushScreen(stack, {
        name: "review-submit",
        pr: mockPR,
        initialAction: "approve",
      });
      expect(currentScreen(stack).name).toBe("review-submit");

      // Step 3: ReviewSubmit initializes state with approve action
      const state = initReviewState("approve");
      expect(state.action).toBe("approve");

      // Step 4: Widget formats the title and status
      const title = formatReviewTitle("approve", mockPR.title, mockPR.id);
      expect(title).toContain("PR #42");
      expect(title).toContain("Fix auth token refresh");

      const label = formatActionLabel("approve");
      expect(label).toBe("Approve");

      const status = formatReviewStatus(false, null);
      expect(status.text).toBe("Enter submit · Esc cancel");

      // Step 5: User presses Enter → submit starts
      const submitting = setSubmitting(state, true);
      expect(submitting.submitting).toBe(true);
      const submittingStatus = formatReviewStatus(true, null);
      expect(submittingStatus.text).toBe("Submitting...");

      // Step 6: Approve API call succeeds
      fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await approvePR(mockAuth, "acme", "api", 42);

      // Step 7: Verify the correct endpoint was called
      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/pullrequests/42/approve");
      expect(options.method).toBe("POST");

      // Step 8: After success, user is taken back (pop review-submit → diffnav → dashboard)
      stack = popScreen(stack); // back from review-submit
      expect(currentScreen(stack).name).toBe("diffnav");
    });
  });

  // ─── AC: "Pressing x from DiffNav requests changes" ───────────────────

  describe("user session: reviewer requests changes", () => {
    it("should navigate to review-submit on 'x', confirm, and request changes", async () => {
      // Step 1: User presses 'x' while viewing diff
      const navState: DiffNavState = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("x", navState, 3);
      expect(action.action).toBe("request-changes");

      // Step 2: DiffNav navigates to review-submit
      let stack: Screen[] = [
        { name: "dashboard" },
        { name: "diffnav", pr: mockPR },
      ];
      stack = pushScreen(stack, {
        name: "review-submit",
        pr: mockPR,
        initialAction: "request-changes",
      });

      // Step 3: State initialized with request-changes
      const state = initReviewState("request-changes");
      expect(state.action).toBe("request-changes");

      const label = formatActionLabel("request-changes");
      expect(label).toBe("Request Changes");

      // Step 4: User adds a general comment explaining what needs changes
      const withComment = setGeneralComment(
        state,
        "Please add error handling for 401 responses"
      );
      expect(withComment.generalComment).toBe(
        "Please add error handling for 401 responses"
      );

      // Step 5: Submit — first post the general comment, then request changes
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 600,
            content: {
              raw: "Please add error handling for 401 responses",
              markup: "markdown",
              html: "",
            },
            user: { display_name: "Reviewer", nickname: "reviewer" },
            created_on: "2026-03-01T12:00:00Z",
            updated_on: "2026-03-01T12:00:00Z",
            deleted: false,
          }),
          { status: 201 }
        )
      );
      fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));

      // Post comment
      const comment = await postPRComment(mockAuth, "acme", "api", 42, {
        content: withComment.generalComment,
      });
      expect(comment.content).toBe(
        "Please add error handling for 401 responses"
      );

      // Request changes
      await requestChangesPR(mockAuth, "acme", "api", 42);

      // Step 6: Verify request-changes endpoint was called
      const [reqUrl, reqOptions] = fetchSpy.mock.calls[1] as [
        string,
        RequestInit,
      ];
      expect(reqUrl).toContain("/pullrequests/42/request-changes");
      expect(reqOptions.method).toBe("POST");

      // Step 7: Navigate back
      stack = popScreen(stack);
      expect(currentScreen(stack).name).toBe("diffnav");
    });
  });

  // ─── AC: "Both actions show a confirmation before posting" ─────────────

  describe("confirmation dialog", () => {
    it("should show confirmation with action options before submitting", () => {
      // Review submit screen initializes with confirmation dialog
      const state = initReviewState("approve");

      // Widget shows 3 options: Approve, Request Changes, Comment
      expect(REVIEW_ACTION_OPTIONS).toHaveLength(3);

      const title = formatReviewTitle("approve", mockPR.title, mockPR.id);
      expect(title).toContain("Submit Review");

      // User can change action before submitting
      const changed = setReviewAction(state, "comment");
      expect(changed.action).toBe("comment");
      expect(formatActionLabel("comment")).toBe("Comment");
    });

    it("should cancel and go back on Esc without submitting", () => {
      // User opens review-submit
      let stack: Screen[] = [
        { name: "dashboard" },
        { name: "diffnav", pr: mockPR },
        { name: "review-submit", pr: mockPR, initialAction: "approve" },
      ];

      // User presses Esc → goes back without submitting
      stack = popScreen(stack);
      expect(currentScreen(stack).name).toBe("diffnav");

      // No fetch calls were made
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ─── AC: "Comment-only review" ────────────────────────────────────────

  describe("user session: comment-only review", () => {
    it("should change action to comment and submit with just a general comment", async () => {
      // Start with approve, but change to comment-only
      let state = initReviewState("approve");
      state = setReviewAction(state, "comment");
      state = setGeneralComment(state, "Overall LGTM, minor nits only");

      expect(state.action).toBe("comment");
      expect(state.generalComment).toBe("Overall LGTM, minor nits only");

      // Submit just posts the comment, no approve or request-changes
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 700,
            content: {
              raw: "Overall LGTM, minor nits only",
              markup: "markdown",
              html: "",
            },
            user: { display_name: "Reviewer", nickname: "reviewer" },
            created_on: "2026-03-01T12:00:00Z",
            updated_on: "2026-03-01T12:00:00Z",
            deleted: false,
          }),
          { status: 201 }
        )
      );

      const result = await postPRComment(mockAuth, "acme", "api", 42, {
        content: state.generalComment,
      });
      expect(result.content).toBe("Overall LGTM, minor nits only");

      // Only one fetch call (comment), no approve/request-changes
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should show error and allow retry on API failure", async () => {
      let state = initReviewState("approve");
      state = setSubmitting(state, true);

      const submittingStatus = formatReviewStatus(state.submitting, state.error);
      expect(submittingStatus.text).toBe("Submitting...");

      // API fails
      fetchSpy.mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 })
      );

      try {
        await approvePR(mockAuth, "acme", "api", 42);
      } catch (err) {
        state = setError(state, (err as Error).message);
      }

      // Error state shows in status
      expect(state.submitting).toBe(false);
      expect(state.error).toContain("Failed to approve PR");

      const errorStatus = formatReviewStatus(state.submitting, state.error);
      expect(errorStatus.isError).toBe(true);
      expect(errorStatus.text).toContain("Failed to approve PR");
      expect(errorStatus.text).toContain("Enter retry");
    });

    it("should handle 401 expired token error", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      try {
        await approvePR(mockAuth, "acme", "api", 42);
        expect(true).toBe(false);
      } catch (err) {
        expect((err as Error).message).toBe(
          "Your API token has expired. Run `opalite login` to add a new one."
        );
      }
    });
  });

  // ─── Unapprove endpoint ──────────────────────────────────────────────────

  describe("unapprove", () => {
    it("should call DELETE on the approve endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("", { status: 204 }));

      await unapprovePR(mockAuth, "acme", "api", 42);

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/pullrequests/42/approve");
      expect(options.method).toBe("DELETE");
    });
  });

  // ─── Keybindings are available from both panels ──────────────────────────

  describe("keybinding context", () => {
    it("should trigger approve from tree panel", () => {
      const state: DiffNavState = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("a", state, 3);
      expect(action.action).toBe("approve");
    });

    it("should trigger approve from diff panel", () => {
      const state: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const action = handleDiffNavKey("a", state, 3);
      expect(action.action).toBe("approve");
    });

    it("should trigger request-changes from both panels", () => {
      const treeState: DiffNavState = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      const diffState: DiffNavState = {
        focusPanel: "diff",
        selectedFileIndex: 0,
        viewMode: "split",
      };

      expect(handleDiffNavKey("x", treeState, 3).action).toBe(
        "request-changes"
      );
      expect(handleDiffNavKey("x", diffState, 3).action).toBe(
        "request-changes"
      );
    });
  });
});
