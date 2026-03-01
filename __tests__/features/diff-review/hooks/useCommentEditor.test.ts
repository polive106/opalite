import { describe, expect, it } from "bun:test";
import {
  type CommentEditorState,
  initialCommentEditorState,
  openInlineEditor,
  openReplyEditor,
  closeEditor,
  updateEditorText,
  setEditorSubmitting,
  setEditorError,
  buildPostInput,
  handleCommentEditorKey,
} from "../../../../src/features/diff-review/hooks/useCommentEditor";

describe("CommentEditor state management", () => {
  // ─── Initial state ───

  it("should start with editor closed", () => {
    const state = initialCommentEditorState;

    expect(state.isOpen).toBe(false);
    expect(state.mode).toBe("inline");
    expect(state.text).toBe("");
    expect(state.filePath).toBeUndefined();
    expect(state.lineNumber).toBeUndefined();
    expect(state.parentCommentId).toBeUndefined();
    expect(state.submitting).toBe(false);
    expect(state.error).toBeNull();
  });

  // ─── Opening inline comment editor ───

  it("should open inline editor with file path and line number", () => {
    const state = openInlineEditor("src/auth.ts", 45);

    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("inline");
    expect(state.text).toBe("");
    expect(state.filePath).toBe("src/auth.ts");
    expect(state.lineNumber).toBe(45);
    expect(state.parentCommentId).toBeUndefined();
    expect(state.submitting).toBe(false);
    expect(state.error).toBeNull();
  });

  // ─── Opening reply editor ───

  it("should open reply editor with parent comment id", () => {
    const state = openReplyEditor(200);

    expect(state.isOpen).toBe(true);
    expect(state.mode).toBe("reply");
    expect(state.text).toBe("");
    expect(state.parentCommentId).toBe(200);
    expect(state.submitting).toBe(false);
    expect(state.error).toBeNull();
  });

  // ─── Closing editor ───

  it("should close editor and reset state", () => {
    const openState = openInlineEditor("src/auth.ts", 45);
    const closedState = closeEditor();

    expect(closedState.isOpen).toBe(false);
    expect(closedState.text).toBe("");
    expect(closedState.filePath).toBeUndefined();
    expect(closedState.lineNumber).toBeUndefined();
    expect(closedState.parentCommentId).toBeUndefined();
    expect(closedState.error).toBeNull();
  });

  // ─── Updating text ───

  it("should update editor text", () => {
    const state = openInlineEditor("src/auth.ts", 45);
    const updated = updateEditorText(state, "This needs a fix");

    expect(updated.text).toBe("This needs a fix");
    expect(updated.isOpen).toBe(true);
    expect(updated.filePath).toBe("src/auth.ts");
  });

  // ─── Submitting state ───

  it("should set submitting state", () => {
    const state = openInlineEditor("src/auth.ts", 45);
    const submitting = setEditorSubmitting(state, true);

    expect(submitting.submitting).toBe(true);
    expect(submitting.error).toBeNull();
  });

  it("should clear submitting state", () => {
    const state = setEditorSubmitting(openInlineEditor("src/auth.ts", 45), true);
    const done = setEditorSubmitting(state, false);

    expect(done.submitting).toBe(false);
  });

  // ─── Error state ───

  it("should set error and clear submitting", () => {
    const state = setEditorSubmitting(openInlineEditor("src/auth.ts", 45), true);
    const errored = setEditorError(state, "Network error");

    expect(errored.error).toBe("Network error");
    expect(errored.submitting).toBe(false);
    expect(errored.isOpen).toBe(true);
  });

  // ─── Building post input ───

  it("should build post input for inline comment", () => {
    const state: CommentEditorState = {
      ...openInlineEditor("src/auth.ts", 45),
      text: "Please fix this",
    };

    const input = buildPostInput(state);

    expect(input.content).toBe("Please fix this");
    expect(input.inline).toEqual({ path: "src/auth.ts", to: 45 });
    expect(input.parentId).toBeUndefined();
  });

  it("should build post input for reply comment", () => {
    const state: CommentEditorState = {
      ...openReplyEditor(200),
      text: "Good point, fixing now",
    };

    const input = buildPostInput(state);

    expect(input.content).toBe("Good point, fixing now");
    expect(input.parentId).toBe(200);
    expect(input.inline).toBeUndefined();
  });

  it("should build post input for general comment (no inline, no parent)", () => {
    const state: CommentEditorState = {
      isOpen: true,
      mode: "inline",
      text: "Overall LGTM",
      submitting: false,
      error: null,
    };

    const input = buildPostInput(state);

    expect(input.content).toBe("Overall LGTM");
    expect(input.inline).toBeUndefined();
    expect(input.parentId).toBeUndefined();
  });
});

describe("handleCommentEditorKey", () => {
  // ─── Tab returns ai-suggest action (stub for Phase 5, US-19) ───

  it("should return ai-suggest action on Tab", () => {
    const action = handleCommentEditorKey("Tab");
    expect(action.action).toBe("ai-suggest");
  });

  // ─── Escape closes editor ───

  it("should return close action on Escape", () => {
    const action = handleCommentEditorKey("Escape");
    expect(action.action).toBe("close");
  });

  // ─── Other keys are ignored (handled by input component) ───

  it("should return none for unrecognized keys", () => {
    const action = handleCommentEditorKey("a");
    expect(action.action).toBe("none");
  });

  it("should return none for Enter (handled by onSubmit callback)", () => {
    const action = handleCommentEditorKey("Enter");
    expect(action.action).toBe("none");
  });
});
