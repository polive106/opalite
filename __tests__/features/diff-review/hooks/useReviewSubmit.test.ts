import { describe, expect, it } from "bun:test";
import {
  initReviewState,
  setReviewAction,
  setGeneralComment,
  setSubmitting,
  setError,
  resetState,
  type ReviewAction,
  type ReviewSubmitState,
} from "../../../../src/features/diff-review/hooks/useReviewSubmit";

describe("useReviewSubmit pure functions", () => {
  // ─── initReviewState ──────────────────────────────────────────────────────

  it("should initialize state with the given action", () => {
    const state = initReviewState("approve");

    expect(state.action).toBe("approve");
    expect(state.generalComment).toBe("");
    expect(state.submitting).toBe(false);
    expect(state.error).toBeNull();
    expect(state.submitted).toBe(false);
  });

  it("should initialize with request-changes action", () => {
    const state = initReviewState("request-changes");

    expect(state.action).toBe("request-changes");
  });

  it("should initialize with comment action", () => {
    const state = initReviewState("comment");

    expect(state.action).toBe("comment");
  });

  // ─── setReviewAction ─────────────────────────────────────────────────────

  it("should change the review action", () => {
    const state = initReviewState("approve");
    const updated = setReviewAction(state, "request-changes");

    expect(updated.action).toBe("request-changes");
    expect(updated.generalComment).toBe(state.generalComment);
  });

  // ─── setGeneralComment ───────────────────────────────────────────────────

  it("should update the general comment text", () => {
    const state = initReviewState("approve");
    const updated = setGeneralComment(state, "LGTM, great work!");

    expect(updated.generalComment).toBe("LGTM, great work!");
    expect(updated.action).toBe("approve");
  });

  // ─── setSubmitting ────────────────────────────────────────────────────────

  it("should set submitting to true and clear error", () => {
    let state = initReviewState("approve");
    state = setError(state, "previous error");
    const updated = setSubmitting(state, true);

    expect(updated.submitting).toBe(true);
    expect(updated.error).toBeNull();
  });

  it("should set submitting to false", () => {
    let state = initReviewState("approve");
    state = setSubmitting(state, true);
    const updated = setSubmitting(state, false);

    expect(updated.submitting).toBe(false);
  });

  // ─── setError ─────────────────────────────────────────────────────────────

  it("should set error and stop submitting", () => {
    let state = initReviewState("approve");
    state = setSubmitting(state, true);
    const updated = setError(state, "Network error");

    expect(updated.error).toBe("Network error");
    expect(updated.submitting).toBe(false);
  });

  // ─── resetState ───────────────────────────────────────────────────────────

  it("should reset to initial state with the given action", () => {
    let state = initReviewState("approve");
    state = setGeneralComment(state, "some text");
    state = setError(state, "some error");

    const reset = resetState("request-changes");

    expect(reset.action).toBe("request-changes");
    expect(reset.generalComment).toBe("");
    expect(reset.submitting).toBe(false);
    expect(reset.error).toBeNull();
    expect(reset.submitted).toBe(false);
  });
});
