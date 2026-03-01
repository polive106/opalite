import { describe, expect, it } from "bun:test";
import {
  buildCommentThreads,
  groupCommentsByFile,
  getFileCommentCounts,
} from "../../../../src/features/diff-review/hooks/useComments";
import type { Comment } from "../../../../src/types/review";

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    author: { displayName: "Alice", nickname: "alice" },
    content: "Great work!",
    createdOn: new Date("2026-02-28T10:00:00Z"),
    isInline: false,
    resolved: false,
    deleted: false,
    replies: [],
    ...overrides,
  };
}

describe("buildCommentThreads", () => {
  it("should return top-level comments unchanged when there are no replies", () => {
    const comments = [
      makeComment({ id: 1, content: "First" }),
      makeComment({ id: 2, content: "Second" }),
    ];

    const threads = buildCommentThreads(comments);

    expect(threads).toHaveLength(2);
    expect(threads[0].id).toBe(1);
    expect(threads[0].replies).toHaveLength(0);
    expect(threads[1].id).toBe(2);
  });

  it("should nest replies under their parent comment", () => {
    const comments = [
      makeComment({ id: 1, content: "Parent comment" }),
      makeComment({ id: 2, content: "Reply 1", parentId: 1 }),
      makeComment({ id: 3, content: "Reply 2", parentId: 1 }),
    ];

    const threads = buildCommentThreads(comments);

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(1);
    expect(threads[0].replies).toHaveLength(2);
    expect(threads[0].replies[0].id).toBe(2);
    expect(threads[0].replies[0].content).toBe("Reply 1");
    expect(threads[0].replies[1].id).toBe(3);
  });

  it("should handle multiple threads with replies", () => {
    const comments = [
      makeComment({ id: 1, content: "Thread 1" }),
      makeComment({ id: 2, content: "Thread 2" }),
      makeComment({ id: 3, content: "Reply to thread 1", parentId: 1 }),
      makeComment({ id: 4, content: "Reply to thread 2", parentId: 2 }),
    ];

    const threads = buildCommentThreads(comments);

    expect(threads).toHaveLength(2);
    expect(threads[0].replies).toHaveLength(1);
    expect(threads[0].replies[0].content).toBe("Reply to thread 1");
    expect(threads[1].replies).toHaveLength(1);
    expect(threads[1].replies[0].content).toBe("Reply to thread 2");
  });

  it("should return empty array for empty input", () => {
    const threads = buildCommentThreads([]);
    expect(threads).toHaveLength(0);
  });
});

describe("groupCommentsByFile", () => {
  it("should separate inline and general comments", () => {
    const comments = [
      makeComment({ id: 1, isInline: true, filePath: "src/auth.ts", lineNumber: 10 }),
      makeComment({ id: 2, isInline: false }),
      makeComment({ id: 3, isInline: true, filePath: "src/login.ts", lineNumber: 5 }),
    ];

    const grouped = groupCommentsByFile(comments);

    expect(grouped.generalComments).toHaveLength(1);
    expect(grouped.generalComments[0].id).toBe(2);
    expect(Object.keys(grouped.fileComments)).toHaveLength(2);
    expect(grouped.fileComments["src/auth.ts"]).toHaveLength(1);
    expect(grouped.fileComments["src/login.ts"]).toHaveLength(1);
  });

  it("should group multiple comments on the same file", () => {
    const comments = [
      makeComment({ id: 1, isInline: true, filePath: "src/auth.ts", lineNumber: 10 }),
      makeComment({ id: 2, isInline: true, filePath: "src/auth.ts", lineNumber: 20 }),
    ];

    const grouped = groupCommentsByFile(comments);

    expect(grouped.fileComments["src/auth.ts"]).toHaveLength(2);
    expect(grouped.generalComments).toHaveLength(0);
  });

  it("should handle all general comments", () => {
    const comments = [
      makeComment({ id: 1, isInline: false }),
      makeComment({ id: 2, isInline: false }),
    ];

    const grouped = groupCommentsByFile(comments);

    expect(grouped.generalComments).toHaveLength(2);
    expect(Object.keys(grouped.fileComments)).toHaveLength(0);
  });

  it("should handle empty input", () => {
    const grouped = groupCommentsByFile([]);

    expect(grouped.generalComments).toHaveLength(0);
    expect(Object.keys(grouped.fileComments)).toHaveLength(0);
  });
});

describe("getFileCommentCounts", () => {
  it("should count comments per file", () => {
    const comments = [
      makeComment({ id: 1, isInline: true, filePath: "src/auth.ts", lineNumber: 10 }),
      makeComment({ id: 2, isInline: true, filePath: "src/auth.ts", lineNumber: 20 }),
      makeComment({ id: 3, isInline: true, filePath: "src/login.ts", lineNumber: 5 }),
      makeComment({ id: 4, isInline: false }),
    ];

    const counts = getFileCommentCounts(comments);

    expect(counts["src/auth.ts"]).toBe(2);
    expect(counts["src/login.ts"]).toBe(1);
    expect(counts["nonexistent.ts"]).toBeUndefined();
  });

  it("should return empty object for no inline comments", () => {
    const comments = [
      makeComment({ id: 1, isInline: false }),
    ];

    const counts = getFileCommentCounts(comments);

    expect(Object.keys(counts)).toHaveLength(0);
  });
});
