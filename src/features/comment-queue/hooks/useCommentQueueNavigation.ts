import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { Comment } from "../../../types/review";

export interface CommentQueueNavigationState {
  selectedIndex: number;
  replyMode: boolean;
}

export type CommentQueueKeyAction =
  | { action: "select"; index: number }
  | { action: "fix"; comment: Comment }
  | { action: "batch-fix" }
  | { action: "reply"; comment: Comment }
  | { action: "resolve"; comment: Comment }
  | { action: "copy-prompt"; comment: Comment }
  | { action: "back" }
  | { action: "quit" }
  | { action: "cancel-reply" }
  | { action: "none" };

export function handleCommentQueueKey(
  keyName: string,
  state: CommentQueueNavigationState,
  comments: Comment[]
): CommentQueueKeyAction {
  // In reply mode, only Escape cancels
  if (state.replyMode) {
    if (keyName === "Escape") {
      return { action: "cancel-reply" };
    }
    return { action: "none" };
  }

  if (keyName === "q") {
    return { action: "quit" };
  }
  if (keyName === "b" || keyName === "Escape") {
    return { action: "back" };
  }

  if (comments.length === 0) {
    return { action: "none" };
  }

  if (keyName === "ArrowDown" || keyName === "j") {
    return {
      action: "select",
      index: Math.min(state.selectedIndex + 1, comments.length - 1),
    };
  }
  if (keyName === "ArrowUp" || keyName === "k") {
    return {
      action: "select",
      index: Math.max(state.selectedIndex - 1, 0),
    };
  }
  if (keyName === "f") {
    return { action: "fix", comment: comments[state.selectedIndex] };
  }
  if (keyName === "F") {
    return { action: "batch-fix" };
  }
  if (keyName === "r") {
    return { action: "reply", comment: comments[state.selectedIndex] };
  }
  if (keyName === "v") {
    return { action: "resolve", comment: comments[state.selectedIndex] };
  }
  if (keyName === "e") {
    return { action: "copy-prompt", comment: comments[state.selectedIndex] };
  }

  return { action: "none" };
}

export interface UseCommentQueueNavigationResult {
  selectedIndex: number;
  replyMode: boolean;
  replyTarget: Comment | null;
}

export function useCommentQueueNavigation(
  comments: Comment[],
  handlers: {
    goBack: () => void;
    onFix: (comment: Comment) => void;
    onBatchFix: () => void;
    onResolve: (commentId: number) => Promise<void>;
    onCopyPrompt: (comment: Comment) => void;
  }
): UseCommentQueueNavigationResult {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [replyMode, setReplyMode] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);

  useKeyboard((e) => {
    const result = handleCommentQueueKey(
      e.name,
      { selectedIndex, replyMode },
      comments
    );

    switch (result.action) {
      case "select":
        setSelectedIndex(result.index);
        break;
      case "fix":
        handlers.onFix(result.comment);
        break;
      case "batch-fix":
        handlers.onBatchFix();
        break;
      case "reply":
        setReplyMode(true);
        setReplyTarget(result.comment);
        break;
      case "resolve":
        handlers.onResolve(result.comment.id);
        break;
      case "copy-prompt":
        handlers.onCopyPrompt(result.comment);
        break;
      case "back":
        handlers.goBack();
        break;
      case "cancel-reply":
        setReplyMode(false);
        setReplyTarget(null);
        break;
      case "quit":
        process.exit(0);
        break;
    }
  });

  return { selectedIndex, replyMode, replyTarget };
}
