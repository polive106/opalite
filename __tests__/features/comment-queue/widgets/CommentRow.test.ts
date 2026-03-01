import { describe, expect, it } from "bun:test";
import type { Comment } from "../../../../src/types/review";
import { formatCommentRow, type CommentRowData } from "../../../../src/features/comment-queue/widgets/CommentRow";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { displayName: "Bob Jones", nickname: "bob" },
    content: "This function needs error handling for the edge case.",
    createdOn: new Date("2026-02-28T10:00:00Z"),
    isInline: true,
    filePath: "src/auth.ts",
    lineNumber: 45,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

describe("formatCommentRow", () => {
  const now = new Date("2026-03-01T12:00:00Z");

  it("should format inline comment with file path and line number", () => {
    const comment = makeComment();
    const data = formatCommentRow(comment, 0, now);

    expect(data.id).toBe(1);
    expect(data.number).toBe(1);
    expect(data.author).toBe("bob");
    expect(data.location).toBe("src/auth.ts:45");
    expect(data.content).toBe("This function needs error handling for the edge case.");
    expect(data.age).toBeDefined();
    expect(data.isInline).toBe(true);
  });

  it("should show 'General' location for non-inline comments", () => {
    const comment = makeComment({
      isInline: false,
      filePath: undefined,
      lineNumber: undefined,
    });
    const data = formatCommentRow(comment, 0, now);

    expect(data.location).toBe("General");
    expect(data.isInline).toBe(false);
  });

  it("should use 1-based numbering from the index", () => {
    const comment = makeComment();
    const data = formatCommentRow(comment, 4, now);
    expect(data.number).toBe(5);
  });

  it("should truncate long content when maxContentLength is provided", () => {
    const longContent = "a".repeat(200);
    const comment = makeComment({ content: longContent });
    const data = formatCommentRow(comment, 0, now, 50);

    expect(data.displayContent.length).toBeLessThanOrEqual(50);
    expect(data.displayContent.endsWith("\u2026")).toBe(true);
  });

  it("should not truncate short content", () => {
    const comment = makeComment({ content: "Short" });
    const data = formatCommentRow(comment, 0, now, 100);

    expect(data.displayContent).toBe("Short");
  });

  it("should format age correctly", () => {
    const comment = makeComment({ createdOn: new Date("2026-03-01T06:00:00Z") });
    const data = formatCommentRow(comment, 0, now);
    expect(data.age).toBe("6h");
  });

  it("should format age for days-old comments", () => {
    const comment = makeComment({ createdOn: new Date("2026-02-27T10:00:00Z") });
    const data = formatCommentRow(comment, 0, now);
    expect(data.age).toBe("2d");
  });

  it("should handle comment with only file path (no line number)", () => {
    const comment = makeComment({
      isInline: true,
      filePath: "src/utils.ts",
      lineNumber: undefined,
    });
    const data = formatCommentRow(comment, 0, now);
    expect(data.location).toBe("src/utils.ts");
  });

  it("should include reply count", () => {
    const reply1 = makeComment({ id: 10, parentId: 1, content: "reply 1" });
    const reply2 = makeComment({ id: 11, parentId: 1, content: "reply 2" });
    const comment = makeComment({
      replies: [reply1, reply2],
    });
    const data = formatCommentRow(comment, 0, now);
    expect(data.replyCount).toBe(2);
  });

  it("should have 0 reply count when no replies", () => {
    const comment = makeComment({ replies: [] });
    const data = formatCommentRow(comment, 0, now);
    expect(data.replyCount).toBe(0);
  });
});
