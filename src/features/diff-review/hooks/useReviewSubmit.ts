import { useState, useCallback } from "react";
import {
  approvePR,
  requestChangesPR,
  postPRComment,
} from "../../../services/bitbucket";
import type { AuthData } from "../../../services/auth";

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

  const changeAction = useCallback((action: ReviewAction) => {
    setState((prev) => setReviewAction(prev, action));
  }, []);

  const changeComment = useCallback((text: string) => {
    setState((prev) => setGeneralComment(prev, text));
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    setState((prev) => setSubmitting(prev, true));

    try {
      if (state.generalComment.trim() !== "") {
        await postPRComment(auth, workspace, repo, prId, {
          content: state.generalComment,
        });
      }

      if (state.action === "approve") {
        await approvePR(auth, workspace, repo, prId);
      } else if (state.action === "request-changes") {
        await requestChangesPR(auth, workspace, repo, prId);
      }

      setState((prev) => ({ ...prev, submitting: false, submitted: true }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit review";
      setState((prev) => setError(prev, message));
      return false;
    }
  }, [auth, workspace, repo, prId, state]);

  return { state, changeAction, changeComment, submit };
}
