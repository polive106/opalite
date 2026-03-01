import { useState, useCallback } from "react";
import { postPRComment, type PostCommentInput } from "../../../services/bitbucket";
import type { AuthData } from "../../../services/auth";
import type { Comment } from "../../../types/review";

export type CommentEditorMode = "inline" | "reply";

export interface CommentEditorState {
  isOpen: boolean;
  mode: CommentEditorMode;
  text: string;
  filePath?: string;
  lineNumber?: number;
  parentCommentId?: number;
  submitting: boolean;
  error: string | null;
}

export const initialCommentEditorState: CommentEditorState = {
  isOpen: false,
  mode: "inline",
  text: "",
  submitting: false,
  error: null,
};

export function openInlineEditor(filePath: string, lineNumber: number): CommentEditorState {
  return {
    isOpen: true,
    mode: "inline",
    text: "",
    filePath,
    lineNumber,
    submitting: false,
    error: null,
  };
}

export function openReplyEditor(parentCommentId: number): CommentEditorState {
  return {
    isOpen: true,
    mode: "reply",
    text: "",
    parentCommentId,
    submitting: false,
    error: null,
  };
}

export function closeEditor(): CommentEditorState {
  return { ...initialCommentEditorState };
}

export function updateEditorText(state: CommentEditorState, text: string): CommentEditorState {
  return { ...state, text };
}

export function setEditorSubmitting(state: CommentEditorState, submitting: boolean): CommentEditorState {
  return { ...state, submitting, error: submitting ? null : state.error };
}

export function setEditorError(state: CommentEditorState, error: string): CommentEditorState {
  return { ...state, error, submitting: false };
}

export function buildPostInput(state: CommentEditorState): PostCommentInput {
  const input: PostCommentInput = {
    content: state.text,
  };

  if (state.filePath !== undefined && state.lineNumber !== undefined) {
    input.inline = { path: state.filePath, to: state.lineNumber };
  }

  if (state.parentCommentId !== undefined) {
    input.parentId = state.parentCommentId;
  }

  return input;
}

export type CommentEditorKeyAction =
  | { action: "close" }
  | { action: "ai-suggest" }
  | { action: "none" };

export function handleCommentEditorKey(keyName: string): CommentEditorKeyAction {
  if (keyName === "escape") {
    return { action: "close" };
  }

  if (keyName === "tab") {
    return { action: "ai-suggest" };
  }

  return { action: "none" };
}

export interface UseCommentEditorResult {
  editorState: CommentEditorState;
  openInline: (filePath: string, lineNumber: number) => void;
  openReply: (parentCommentId: number) => void;
  close: () => void;
  setText: (text: string) => void;
  submit: () => Promise<Comment | null>;
}

export function useCommentEditor(
  auth: AuthData,
  workspace: string,
  repo: string,
  prId: number
): UseCommentEditorResult {
  const [editorState, setEditorState] = useState<CommentEditorState>(initialCommentEditorState);

  const openInline = useCallback((filePath: string, lineNumber: number) => {
    setEditorState(openInlineEditor(filePath, lineNumber));
  }, []);

  const openReply = useCallback((parentCommentId: number) => {
    setEditorState(openReplyEditor(parentCommentId));
  }, []);

  const close = useCallback(() => {
    setEditorState(closeEditor());
  }, []);

  const setText = useCallback((text: string) => {
    setEditorState((prev) => updateEditorText(prev, text));
  }, []);

  const submit = useCallback(async (): Promise<Comment | null> => {
    setEditorState((prev) => setEditorSubmitting(prev, true));

    try {
      const input = buildPostInput(editorState);
      const comment = await postPRComment(auth, workspace, repo, prId, input);
      setEditorState(closeEditor());
      return comment;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post comment";
      setEditorState((prev) => setEditorError(prev, message));
      return null;
    }
  }, [auth, workspace, repo, prId, editorState]);

  return { editorState, openInline, openReply, close, setText, submit };
}
