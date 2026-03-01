import { describe, expect, it } from "bun:test";
import {
  formatComment,
  formatCommentThread,
} from "../../../../src/features/diff-review/widgets/CommentThread";
import type { Comment } from "../../../../src/types/review";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { displayName: "Alice Smith", nickname: "alice" },
    content: "Looks good!",
    createdOn: new Date("2026-02-28T10:00:00Z"),
    isInline: false,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

describe("formatComment", () => {
  it("should format a comment with author, age, and content", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const comment = makeComment({
      author: { displayName: "Bob", nickname: "bob" },
      content: "Please add a test",
    });

    const formatted = formatComment(comment, now);

    expect(formatted.author).toBe("bob");
    expect(formatted.content).toBe("Please add a test");
    expect(formatted.age).toBe("1d");
    expect(formatted.resolved).toBe(false);
  });

  it("should show resolved status", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const comment = makeComment({ resolved: true });

    const formatted = formatComment(comment, now);

    expect(formatted.resolved).toBe(true);
  });

  it("should format age in hours when less than a day", () => {
    const now = new Date("2026-02-28T14:00:00Z");
    const comment = makeComment({
      createdOn: new Date("2026-02-28T10:00:00Z"),
    });

    const formatted = formatComment(comment, now);

    expect(formatted.age).toBe("4h");
  });

  it("should format age in minutes when very recent", () => {
    const now = new Date("2026-02-28T10:30:00Z");
    const comment = makeComment({
      createdOn: new Date("2026-02-28T10:00:00Z"),
    });

    const formatted = formatComment(comment, now);

    expect(formatted.age).toBe("30m");
  });

  it("should show inline location when available", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const comment = makeComment({
      isInline: true,
      filePath: "src/auth.ts",
      lineNumber: 42,
    });

    const formatted = formatComment(comment, now);

    expect(formatted.filePath).toBe("src/auth.ts");
    expect(formatted.lineNumber).toBe(42);
  });
});

describe("formatCommentThread", () => {
  it("should format a thread with parent and replies", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const thread = makeComment({
      id: 1,
      content: "Parent comment",
      replies: [
        makeComment({ id: 2, content: "Reply 1", author: { displayName: "Bob", nickname: "bob" } }),
        makeComment({ id: 3, content: "Reply 2", author: { displayName: "Carol", nickname: "carol" } }),
      ],
    });

    const formatted = formatCommentThread(thread, now);

    expect(formatted.parent.content).toBe("Parent comment");
    expect(formatted.replies).toHaveLength(2);
    expect(formatted.replies[0].content).toBe("Reply 1");
    expect(formatted.replies[0].author).toBe("bob");
    expect(formatted.replies[1].content).toBe("Reply 2");
    expect(formatted.replies[1].author).toBe("carol");
  });

  it("should format a thread with no replies", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const thread = makeComment({ content: "Solo comment" });

    const formatted = formatCommentThread(thread, now);

    expect(formatted.parent.content).toBe("Solo comment");
    expect(formatted.replies).toHaveLength(0);
  });

  it("should show reply count", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const thread = makeComment({
      replies: [
        makeComment({ id: 2 }),
        makeComment({ id: 3 }),
      ],
    });

    const formatted = formatCommentThread(thread, now);

    expect(formatted.replyCount).toBe(2);
  });
});
