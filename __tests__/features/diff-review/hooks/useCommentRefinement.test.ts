import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { OpaliteConfig } from "../../../../src/services/config";
import type { RefinementPromptInput } from "../../../../src/services/prompt";

// ─── Mock queryAgent ───
const mockQueryAgent = mock(() => Promise.resolve("Refined comment text" as string | null));
mock.module("../../../../src/services/agent", () => ({
  queryAgent: mockQueryAgent,
  getAgentConfig: (config: OpaliteConfig) => config.agent ?? null,
  buildAgentCommand: (template: string) => template.split(" "),
}));

import {
  type RefinementState,
  type RefinementStatus,
  type RefinementContext,
  type RefinementHistoryEntry,
  type RefinementResult,
  initialRefinementState,
  startLoading,
  setSuggestion,
  setError,
  acceptSuggestion,
  skipSuggestion,
  editSuggestion,
  startReject,
  resetToIdle,
  truncateHistory,
  MAX_HISTORY_ROUNDS,
  refineComment,
  rejectSuggestion,
} from "../../../../src/features/diff-review/hooks/useCommentRefinement";

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
  prId: 123,
  prTitle: "Fix auth flow",
  sourceBranch: "feature/auth",
  destinationBranch: "main",
  fileDiff: "@@ -1,3 +1,4 @@\n+import { hash } from 'crypto';",
  existingComments: [],
};

describe("CommentRefinement state management", () => {
  // ─── Initial state ───

  it("should start in idle state", () => {
    const state = initialRefinementState;

    expect(state.status).toBe("idle");
    expect(state.draft).toBeNull();
    expect(state.suggestion).toBeNull();
    expect(state.error).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.context).toBeNull();
  });

  // ─── State transitions ───

  it("should transition to loading with draft and context", () => {
    const state = startLoading(initialRefinementState, "fix this", mockContext);

    expect(state.status).toBe("loading");
    expect(state.draft).toBe("fix this");
    expect(state.context).toBe(mockContext);
    expect(state.suggestion).toBeNull();
    expect(state.error).toBeNull();
  });

  it("should transition to suggestion with agent response", () => {
    const loading = startLoading(initialRefinementState, "fix this", mockContext);
    const state = setSuggestion(loading, "Please fix the auth token validation on line 45.");

    expect(state.status).toBe("suggestion");
    expect(state.suggestion).toBe("Please fix the auth token validation on line 45.");
    expect(state.draft).toBe("fix this");
    expect(state.error).toBeNull();
  });

  it("should transition to error state", () => {
    const loading = startLoading(initialRefinementState, "fix this", mockContext);
    const state = setError(loading, "Agent timed out");

    expect(state.status).toBe("error");
    expect(state.error).toBe("Agent timed out");
    expect(state.draft).toBe("fix this");
    expect(state.suggestion).toBeNull();
  });

  // ─── Accept ───

  it("should return suggestion and reset to idle on accept", () => {
    const withSuggestion = setSuggestion(
      startLoading(initialRefinementState, "fix this", mockContext),
      "Refined text"
    );
    const result = acceptSuggestion(withSuggestion);

    expect(result.text).toBe("Refined text");
    expect(result.state.status).toBe("idle");
    expect(result.state.draft).toBeNull();
    expect(result.state.suggestion).toBeNull();
    expect(result.state.history).toEqual([]);
  });

  // ─── Skip ───

  it("should return original draft and reset to idle on skip", () => {
    const withSuggestion = setSuggestion(
      startLoading(initialRefinementState, "fix this", mockContext),
      "Refined text"
    );
    const result = skipSuggestion(withSuggestion);

    expect(result.text).toBe("fix this");
    expect(result.state.status).toBe("idle");
    expect(result.state.draft).toBeNull();
    expect(result.state.suggestion).toBeNull();
  });

  // ─── Edit ───

  it("should return suggestion text for editing and reset to idle", () => {
    const withSuggestion = setSuggestion(
      startLoading(initialRefinementState, "fix this", mockContext),
      "Refined text"
    );
    const result = editSuggestion(withSuggestion);

    expect(result.text).toBe("Refined text");
    expect(result.state.status).toBe("idle");
  });

  // ─── Reject ───

  it("should transition to loading with feedback appended to history", () => {
    const withSuggestion = setSuggestion(
      startLoading(initialRefinementState, "fix this", mockContext),
      "Refined text"
    );
    const state = startReject(withSuggestion, "Too verbose");

    expect(state.status).toBe("loading");
    expect(state.draft).toBe("fix this");
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual({
      suggestion: "Refined text",
      feedback: "Too verbose",
    });
  });

  it("should accumulate history across multiple rejections", () => {
    let state = setSuggestion(
      startLoading(initialRefinementState, "fix this", mockContext),
      "First suggestion"
    );
    state = startReject(state, "Too long");
    state = setSuggestion(state, "Second suggestion");
    state = startReject(state, "Still not right");

    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toEqual({
      suggestion: "First suggestion",
      feedback: "Too long",
    });
    expect(state.history[1]).toEqual({
      suggestion: "Second suggestion",
      feedback: "Still not right",
    });
  });

  // ─── Cancel ───

  it("should reset to idle on cancel", () => {
    const loading = startLoading(initialRefinementState, "fix this", mockContext);
    const state = resetToIdle(loading);

    expect(state.status).toBe("idle");
    expect(state.draft).toBeNull();
    expect(state.suggestion).toBeNull();
    expect(state.error).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.context).toBeNull();
  });

  // ─── History truncation ───

  it("should truncate history to last 3 rounds", () => {
    const history: RefinementHistoryEntry[] = [
      { suggestion: "s1", feedback: "f1" },
      { suggestion: "s2", feedback: "f2" },
      { suggestion: "s3", feedback: "f3" },
      { suggestion: "s4", feedback: "f4" },
    ];

    const truncated = truncateHistory(history);

    expect(truncated).toHaveLength(3);
    expect(truncated[0].suggestion).toBe("s2");
    expect(truncated[2].suggestion).toBe("s4");
  });

  it("should not truncate history with 3 or fewer rounds", () => {
    const history: RefinementHistoryEntry[] = [
      { suggestion: "s1", feedback: "f1" },
      { suggestion: "s2", feedback: "f2" },
    ];

    const truncated = truncateHistory(history);

    expect(truncated).toHaveLength(2);
  });

  // ─── Skip from error state ───

  it("should return original draft when skipping from error state", () => {
    const errored = setError(
      startLoading(initialRefinementState, "fix this", mockContext),
      "Agent crashed"
    );
    const result = skipSuggestion(errored);

    expect(result.text).toBe("fix this");
    expect(result.state.status).toBe("idle");
  });
});

describe("refineComment async", () => {
  beforeEach(() => {
    mockQueryAgent.mockReset();
    mockQueryAgent.mockResolvedValue("Refined suggestion");
  });

  it("should call queryAgent and return suggestion state", async () => {
    const result = await refineComment("fix this bug", mockContext, mockConfig);

    expect(result.status).toBe("suggestion");
    expect(result.suggestion).toBe("Refined suggestion");
    expect(result.draft).toBe("fix this bug");
    expect(mockQueryAgent).toHaveBeenCalledTimes(1);
  });

  it("should return idle with draft when no agent configured", async () => {
    const result = await refineComment("fix this bug", mockContext, noAgentConfig);

    expect(result.status).toBe("idle");
    expect(result.noAgent).toBe(true);
    expect(result.draft).toBe("fix this bug");
    expect(mockQueryAgent).not.toHaveBeenCalled();
  });

  it("should return error state when agent throws", async () => {
    mockQueryAgent.mockRejectedValue(new Error("Agent timed out after 60000ms"));

    const result = await refineComment("fix this bug", mockContext, mockConfig);

    expect(result.status).toBe("error");
    expect(result.error).toBe("Agent timed out after 60000ms");
    expect(result.draft).toBe("fix this bug");
  });

  it("should return idle with draft when agent returns null", async () => {
    mockQueryAgent.mockResolvedValue(null);

    const result = await refineComment("fix this bug", mockContext, mockConfig);

    expect(result.status).toBe("idle");
    expect(result.noAgent).toBe(true);
    expect(result.draft).toBe("fix this bug");
  });
});

describe("rejectSuggestion async", () => {
  beforeEach(() => {
    mockQueryAgent.mockReset();
    mockQueryAgent.mockResolvedValue("Better suggestion");
  });

  it("should call queryAgent with rejection prompt and return new suggestion", async () => {
    const state: RefinementState = {
      status: "suggestion",
      draft: "fix this",
      suggestion: "Previous suggestion",
      error: null,
      history: [],
      context: mockContext,
    };

    const result = await rejectSuggestion(state, "Too verbose", mockConfig);

    expect(result.status).toBe("suggestion");
    expect(result.suggestion).toBe("Better suggestion");
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toEqual({
      suggestion: "Previous suggestion",
      feedback: "Too verbose",
    });
    expect(mockQueryAgent).toHaveBeenCalledTimes(1);
  });

  it("should return error state when reject agent call fails", async () => {
    mockQueryAgent.mockRejectedValue(new Error("Network error"));

    const state: RefinementState = {
      status: "suggestion",
      draft: "fix this",
      suggestion: "Previous suggestion",
      error: null,
      history: [],
      context: mockContext,
    };

    const result = await rejectSuggestion(state, "Too verbose", mockConfig);

    expect(result.status).toBe("error");
    expect(result.error).toBe("Network error");
    expect(result.history).toHaveLength(1);
  });

  it("should truncate history to last 3 rounds on reject", async () => {
    const state: RefinementState = {
      status: "suggestion",
      draft: "fix this",
      suggestion: "s4",
      error: null,
      history: [
        { suggestion: "s1", feedback: "f1" },
        { suggestion: "s2", feedback: "f2" },
        { suggestion: "s3", feedback: "f3" },
      ],
      context: mockContext,
    };

    const result = await rejectSuggestion(state, "f4", mockConfig);

    // History should contain 3 most recent (s2/f2, s3/f3, s4/f4), truncated
    expect(result.history).toHaveLength(3);
    expect(result.history[0].suggestion).toBe("s2");
    expect(result.history[2].suggestion).toBe("s4");
  });
});
