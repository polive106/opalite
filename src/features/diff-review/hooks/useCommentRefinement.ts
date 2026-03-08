import { useState, useCallback } from "react";
import { queryAgent, getAgentConfig } from "../../../services/agent";
import {
  buildRefinementPrompt,
  buildRejectionPrompt,
  type RefinementPromptInput,
  type RejectionPromptInput,
} from "../../../services/prompt";
import type { OpaliteConfig } from "../../../services/config";
import type { Comment } from "../../../types/review";

// ─── Types ───

export type RefinementStatus = "idle" | "loading" | "suggestion" | "error";

export interface RefinementHistoryEntry {
  suggestion: string;
  feedback: string;
}

export interface RefinementContext {
  filePath: string;
  lineNumber?: number;
  prId: number;
  prTitle: string;
  sourceBranch: string;
  destinationBranch: string;
  fileDiff: string;
  existingComments: Comment[];
}

export interface RefinementState {
  status: RefinementStatus;
  draft: string | null;
  suggestion: string | null;
  error: string | null;
  history: RefinementHistoryEntry[];
  context: RefinementContext | null;
}

export interface RefinementResult {
  text: string;
  state: RefinementState;
}

export interface RefineCommentResult {
  status: "suggestion" | "error" | "idle";
  suggestion?: string | null;
  error?: string | null;
  draft: string;
  noAgent?: boolean;
  history?: RefinementHistoryEntry[];
}

export const MAX_HISTORY_ROUNDS = 3;

// ─── Initial state ───

export const initialRefinementState: RefinementState = {
  status: "idle",
  draft: null,
  suggestion: null,
  error: null,
  history: [],
  context: null,
};

// ─── Pure state transition functions ───

export function startLoading(
  state: RefinementState,
  draft: string,
  context: RefinementContext
): RefinementState {
  return {
    ...state,
    status: "loading",
    draft,
    context,
    suggestion: null,
    error: null,
  };
}

export function setSuggestion(
  state: RefinementState,
  suggestion: string
): RefinementState {
  return {
    ...state,
    status: "suggestion",
    suggestion,
    error: null,
  };
}

export function setError(
  state: RefinementState,
  error: string
): RefinementState {
  return {
    ...state,
    status: "error",
    error,
    suggestion: null,
  };
}

export function acceptSuggestion(state: RefinementState): RefinementResult {
  return {
    text: state.suggestion ?? state.draft ?? "",
    state: { ...initialRefinementState },
  };
}

export function skipSuggestion(state: RefinementState): RefinementResult {
  return {
    text: state.draft ?? "",
    state: { ...initialRefinementState },
  };
}

export function editSuggestion(state: RefinementState): RefinementResult {
  return {
    text: state.suggestion ?? state.draft ?? "",
    state: { ...initialRefinementState },
  };
}

export function startReject(
  state: RefinementState,
  feedback: string
): RefinementState {
  const entry: RefinementHistoryEntry = {
    suggestion: state.suggestion ?? "",
    feedback,
  };

  return {
    ...state,
    status: "loading",
    suggestion: null,
    error: null,
    history: [...state.history, entry],
  };
}

export function resetToIdle(_state: RefinementState): RefinementState {
  return { ...initialRefinementState };
}

export function truncateHistory(
  history: RefinementHistoryEntry[]
): RefinementHistoryEntry[] {
  if (history.length <= MAX_HISTORY_ROUNDS) {
    return history;
  }
  return history.slice(history.length - MAX_HISTORY_ROUNDS);
}

// ─── Async operations ───

export async function refineComment(
  draft: string,
  context: RefinementContext,
  config: OpaliteConfig
): Promise<RefineCommentResult> {
  const agentConfig = getAgentConfig(config);
  if (!agentConfig) {
    return { status: "idle", draft, noAgent: true };
  }

  const promptInput: RefinementPromptInput = {
    filePath: context.filePath,
    lineNumber: context.lineNumber,
    prId: context.prId,
    prTitle: context.prTitle,
    sourceBranch: context.sourceBranch,
    destinationBranch: context.destinationBranch,
    fileDiff: context.fileDiff,
    existingComments: context.existingComments,
    draft,
  };

  try {
    const result = await queryAgent(buildRefinementPrompt(promptInput), config);

    if (result === null) {
      return { status: "idle", draft, noAgent: true };
    }

    return { status: "suggestion", suggestion: result, draft };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent failed";
    return { status: "error", error: message, draft };
  }
}

export async function rejectSuggestion(
  state: RefinementState,
  feedback: string,
  config: OpaliteConfig
): Promise<RefinementState> {
  const newHistory = truncateHistory([
    ...state.history,
    { suggestion: state.suggestion ?? "", feedback },
  ]);

  const context = state.context!;
  const promptInput: RejectionPromptInput = {
    filePath: context.filePath,
    lineNumber: context.lineNumber,
    prId: context.prId,
    prTitle: context.prTitle,
    sourceBranch: context.sourceBranch,
    destinationBranch: context.destinationBranch,
    fileDiff: context.fileDiff,
    existingComments: context.existingComments,
    draft: state.draft ?? "",
    previousSuggestion: state.suggestion ?? "",
    rejectionReason: feedback,
  };

  try {
    const result = await queryAgent(
      buildRejectionPrompt(promptInput),
      config
    );

    if (result === null) {
      return {
        ...state,
        status: "error",
        error: "Agent not available",
        suggestion: null,
        history: newHistory,
      };
    }

    return {
      ...state,
      status: "suggestion",
      suggestion: result,
      error: null,
      history: newHistory,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent failed";
    return {
      ...state,
      status: "error",
      error: message,
      suggestion: null,
      history: newHistory,
    };
  }
}

// ─── Keyboard handler ───

export type RefinementKeyAction =
  | { action: "accept" }
  | { action: "skip" }
  | { action: "edit" }
  | { action: "enter-feedback" }
  | { action: "send-feedback" }
  | { action: "exit-feedback" }
  | { action: "cancel" }
  | { action: "none" };

export function handleRefinementKey(
  keyName: string,
  status: RefinementStatus,
  feedbackMode: boolean
): RefinementKeyAction {
  // Feedback sub-state: Enter sends, Esc exits feedback
  if (feedbackMode) {
    if (keyName === "return") return { action: "send-feedback" };
    if (keyName === "escape") return { action: "exit-feedback" };
    return { action: "none" };
  }

  // Esc cancels from any state
  if (keyName === "escape") return { action: "cancel" };

  if (status === "suggestion") {
    if (keyName === "a") return { action: "accept" };
    if (keyName === "s") return { action: "skip" };
    if (keyName === "e") return { action: "edit" };
    if (keyName === "r") return { action: "enter-feedback" };
  }

  if (status === "error") {
    if (keyName === "s") return { action: "skip" };
  }

  return { action: "none" };
}

// ─── React hook ───

export interface UseCommentRefinementResult {
  state: RefinementState;
  refine: (draft: string, context: RefinementContext) => Promise<RefinementResult | null>;
  accept: () => RefinementResult;
  skip: () => RefinementResult;
  edit: () => RefinementResult;
  reject: (feedback: string) => Promise<void>;
  cancel: () => void;
}

export function useCommentRefinement(
  config: OpaliteConfig
): UseCommentRefinementResult {
  const [state, setState] = useState<RefinementState>(initialRefinementState);

  const refine = useCallback(
    async (
      draft: string,
      context: RefinementContext
    ): Promise<RefinementResult | null> => {
      setState((prev) => startLoading(prev, draft, context));

      const result = await refineComment(draft, context, config);

      if (result.noAgent) {
        setState(initialRefinementState);
        return { text: draft, state: initialRefinementState };
      }

      if (result.status === "suggestion") {
        setState((prev) => setSuggestion(prev, result.suggestion!));
        return null; // suggestion displayed, user must act
      }

      setState((prev) => setError(prev, result.error ?? "Agent failed"));
      return null;
    },
    [config]
  );

  const accept = useCallback((): RefinementResult => {
    const result = acceptSuggestion(state);
    setState(result.state);
    return result;
  }, [state]);

  const skip = useCallback((): RefinementResult => {
    const result = skipSuggestion(state);
    setState(result.state);
    return result;
  }, [state]);

  const edit = useCallback((): RefinementResult => {
    const result = editSuggestion(state);
    setState(result.state);
    return result;
  }, [state]);

  const reject = useCallback(
    async (feedback: string): Promise<void> => {
      setState((prev) => startReject(prev, feedback));

      const newState = await rejectSuggestion(state, feedback, config);
      setState(newState);
    },
    [state, config]
  );

  const cancel = useCallback(() => {
    setState(resetToIdle(state));
  }, [state]);

  return { state, refine, accept, skip, edit, reject, cancel };
}
