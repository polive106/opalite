import { describe, expect, it } from "bun:test";
import type { Comment } from "../../../src/types/review";
import {
  formatCommentsForPrompt,
  buildRefinementPrompt,
  buildRejectionPrompt,
  type RefinementPromptInput,
  type RejectionPromptInput,
} from "../../../src/services/prompt";

function makeInlineComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { displayName: "Alice Smith", nickname: "alice" },
    content: "This looks wrong",
    createdOn: new Date("2026-03-01T10:00:00Z"),
    isInline: true,
    filePath: "src/auth.ts",
    lineNumber: 42,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

function makeGeneralComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 2,
    author: { displayName: "Bob Jones", nickname: "bob" },
    content: "Overall looks good",
    createdOn: new Date("2026-03-01T11:00:00Z"),
    isInline: false,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

function makeRefinementInput(
  overrides: Partial<RefinementPromptInput> = {}
): RefinementPromptInput {
  return {
    filePath: "src/services/auth.ts",
    lineNumber: 42,
    prId: 123,
    prTitle: "Fix auth token refresh",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    fileDiff: `--- a/src/services/auth.ts\n+++ b/src/services/auth.ts\n@@ -40,6 +40,8 @@\n   try {\n     const token = await refreshToken();\n+    if (!token) throw new Error("no token");\n     return token;\n   } catch (e) {\n+    console.error(e);\n   }`,
    existingComments: [],
    draft: "this error handling is wrong",
    ...overrides,
  };
}

describe("formatCommentsForPrompt", () => {
  it("should format inline comments as 'author (line N): text'", () => {
    const comments = [makeInlineComment()];
    const result = formatCommentsForPrompt(comments);
    expect(result).toBe("alice (line 42): This looks wrong");
  });

  it("should format general comments as 'author: text'", () => {
    const comments = [makeGeneralComment()];
    const result = formatCommentsForPrompt(comments);
    expect(result).toBe("bob: Overall looks good");
  });

  it("should format multiple comments separated by newlines", () => {
    const comments = [makeInlineComment(), makeGeneralComment()];
    const result = formatCommentsForPrompt(comments);
    expect(result).toContain("alice (line 42): This looks wrong");
    expect(result).toContain("bob: Overall looks good");
    expect(result.split("\n").length).toBe(2);
  });

  it("should return 'None' for empty comments array", () => {
    const result = formatCommentsForPrompt([]);
    expect(result).toBe("None");
  });

  it("should use nickname for author display", () => {
    const comments = [
      makeInlineComment({
        author: { displayName: "Charles Xavier", nickname: "prof_x" },
      }),
    ];
    const result = formatCommentsForPrompt(comments);
    expect(result).toStartWith("prof_x");
  });
});

describe("buildRefinementPrompt", () => {
  it("should contain the system instruction header", () => {
    const input = makeRefinementInput();
    const result = buildRefinementPrompt(input);
    expect(result).toContain(
      "You are helping a code reviewer write a clear, constructive PR comment."
    );
  });

  it("should contain the file path", () => {
    const input = makeRefinementInput({ filePath: "src/utils/format.ts" });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("src/utils/format.ts");
  });

  it("should contain the line number", () => {
    const input = makeRefinementInput({ lineNumber: 99 });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("99");
  });

  it("should contain PR metadata", () => {
    const input = makeRefinementInput({
      prId: 456,
      prTitle: "Add rate limiting",
    });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("#456");
    expect(result).toContain("Add rate limiting");
  });

  it("should contain branch information", () => {
    const input = makeRefinementInput({
      sourceBranch: "feature/new-thing",
      destinationBranch: "develop",
    });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("feature/new-thing");
    expect(result).toContain("develop");
  });

  it("should contain the file diff", () => {
    const input = makeRefinementInput({
      fileDiff: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new",
    });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("--- a/file.ts");
    expect(result).toContain("-old");
    expect(result).toContain("+new");
  });

  it("should contain formatted existing comments", () => {
    const input = makeRefinementInput({
      existingComments: [
        makeInlineComment({ content: "Check null case", lineNumber: 10 }),
      ],
    });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("alice (line 10): Check null case");
  });

  it("should contain the reviewer's draft comment", () => {
    const input = makeRefinementInput({
      draft: "this should use a const instead",
    });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("this should use a const instead");
  });

  it("should contain refinement instructions", () => {
    const input = makeRefinementInput();
    const result = buildRefinementPrompt(input);
    expect(result).toContain("Specific");
    expect(result).toContain("Constructive");
    expect(result).toContain("Concise");
    expect(result).toContain("Professional");
    expect(result).toContain("Return ONLY the refined comment text");
  });

  it("should handle no line number (general comment context)", () => {
    const input = makeRefinementInput({ lineNumber: undefined });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("N/A");
    expect(result).not.toContain("undefined");
  });

  it("should show 'None' when there are no existing comments", () => {
    const input = makeRefinementInput({ existingComments: [] });
    const result = buildRefinementPrompt(input);
    expect(result).toContain("None");
  });

  it("should contain all required sections", () => {
    const input = makeRefinementInput();
    const result = buildRefinementPrompt(input);
    expect(result).toContain("## Context");
    expect(result).toContain("## File diff");
    expect(result).toContain("## Existing comments on this file");
    expect(result).toContain("## Reviewer's draft comment");
    expect(result).toContain("## Instructions");
  });
});

describe("buildRejectionPrompt", () => {
  function makeRejectionInput(
    overrides: Partial<RejectionPromptInput> = {}
  ): RejectionPromptInput {
    return {
      ...makeRefinementInput(),
      previousSuggestion:
        "The catch block on L42 swallows the exception silently.",
      rejectionReason:
        "the issue isn't about logging, it's about the retry logic being missing",
      ...overrides,
    };
  }

  it("should contain all the base refinement context", () => {
    const input = makeRejectionInput();
    const result = buildRejectionPrompt(input);
    expect(result).toContain("## Context");
    expect(result).toContain("## File diff");
    expect(result).toContain("## Reviewer's draft comment");
  });

  it("should contain the previous suggestion", () => {
    const input = makeRejectionInput({
      previousSuggestion: "Consider using a retry pattern here.",
    });
    const result = buildRejectionPrompt(input);
    expect(result).toContain("## Previous suggestion");
    expect(result).toContain("Consider using a retry pattern here.");
  });

  it("should contain the reviewer's feedback", () => {
    const input = makeRejectionInput({
      rejectionReason: "too vague, be more specific about the retry count",
    });
    const result = buildRejectionPrompt(input);
    expect(result).toContain("## Reviewer's feedback on the suggestion");
    expect(result).toContain(
      "too vague, be more specific about the retry count"
    );
  });

  it("should contain rejection-specific instructions", () => {
    const input = makeRejectionInput();
    const result = buildRejectionPrompt(input);
    expect(result).toContain("didn't accept your previous suggestion");
    expect(result).toContain("Take their feedback into account");
    expect(result).toContain("Return ONLY the refined comment text");
  });
});
