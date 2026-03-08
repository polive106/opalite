import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  approvePR,
  requestChangesPR,
  postPRComment,
} from "../../../services/bitbucket";
import { queryClient } from "../../../services/queryClient";
import { queryKeys } from "../../../services/queryKeys";
import type { AuthData } from "../../../services/auth";
import type { Comment } from "../../../types/review";

export type ReviewAction = "approve" | "request-changes" | "comment";

export interface ReviewSubmitState {
  action: ReviewAction;
  generalComment: string;
  submitting: boolean;
  error: string | null;
  submitted: boolean;
}

export function initReviewState(action: ReviewAction): ReviewSubmitState {
  return {
    action,
    generalComment: "",
    submitting: false,
    error: null,
    submitted: false,
  };
}

export function setReviewAction(
  state: ReviewSubmitState,
  action: ReviewAction
): ReviewSubmitState {
  return { ...state, action };
}

export function setGeneralComment(
  state: ReviewSubmitState,
  generalComment: string
): ReviewSubmitState {
  return { ...state, generalComment };
}

export function setSubmitting(
  state: ReviewSubmitState,
  submitting: boolean
): ReviewSubmitState {
  return { ...state, submitting, error: submitting ? null : state.error };
}

export function setError(
  state: ReviewSubmitState,
  error: string
): ReviewSubmitState {
  return { ...state, error, submitting: false };
}

export function resetState(action: ReviewAction): ReviewSubmitState {
  return initReviewState(action);
}

export function createOptimisticComment(
  auth: AuthData,
  content: string,
  now: Date = new Date()
): Comment {
  return {
    id: -now.getTime(),
    author: { displayName: auth.displayName, nickname: auth.username },
    content,
    createdOn: now,
    isInline: false,
    resolved: false,
    deleted: false,
    replies: [],
  };
}

export interface UseReviewSubmitResult {
  state: ReviewSubmitState;
  changeAction: (action: ReviewAction) => void;
  changeComment: (text: string) => void;
  submit: () => Promise<boolean>;
}

export function useReviewSubmit(
  auth: AuthData,
  workspace: string,
  repo: string,
  prId: number,
  initialAction: ReviewAction
): UseReviewSubmitResult {
  const [state, setState] = useState<ReviewSubmitState>(
    initReviewState(initialAction)
  );

  const commentsKey = queryKeys.comments(workspace, repo, prId);

  const mutation = useMutation({
    mutationFn: async ({ action, comment }: { action: ReviewAction; comment: string }) => {
      if (comment.trim() !== "") {
        await postPRComment(auth, workspace, repo, prId, {
          content: comment,
        });
      }

      if (action === "approve") {
        await approvePR(auth, workspace, repo, prId);
      } else if (action === "request-changes") {
        await requestChangesPR(auth, workspace, repo, prId);
      }
    },
    onMutate: async ({ comment }) => {
      if (comment.trim() === "") return;

      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: commentsKey });

      // Snapshot the previous comments for rollback
      const previousComments = queryClient.getQueryData<Comment[]>(commentsKey);

      // Optimistically add the new comment to the cache
      if (previousComments) {
        queryClient.setQueryData<Comment[]>(commentsKey, [
          ...previousComments,
          createOptimisticComment(auth, comment),
        ]);
      }

      return { previousComments };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the previous comments on error
      if (context?.previousComments) {
        queryClient.setQueryData<Comment[]>(commentsKey, context.previousComments);
      }
    },
    onSettled: () => {
      // Always refetch after mutation to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.prs(workspace, [repo]) });
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
  });

  const changeAction = useCallback((action: ReviewAction) => {
    setState((prev) => setReviewAction(prev, action));
  }, []);

  const changeComment = useCallback((text: string) => {
    setState((prev) => setGeneralComment(prev, text));
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    setState((prev) => setSubmitting(prev, true));

    try {
      await mutation.mutateAsync({
        action: state.action,
        comment: state.generalComment,
      });
      setState((prev) => ({ ...prev, submitting: false, submitted: true }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit review";
      setState((prev) => setError(prev, message));
      return false;
    }
  }, [mutation, state.action, state.generalComment]);

  return { state, changeAction, changeComment, submit };
}
