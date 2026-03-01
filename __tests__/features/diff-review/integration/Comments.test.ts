/**
 * Feature-level functional integration test for US-9: View existing comments.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → fetchPRComments (service — fetch + pagination + domain transform)
 *       → buildCommentThreads / groupCommentsByFile / getFileCommentCounts (hook logic)
 *         → formatCommentThread / formatFileTreeEntryWithComments (widget formatting)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import { fetchPRComments } from "../../../../src/services/bitbucket";
import {
  buildCommentThreads,
  groupCommentsByFile,
  getFileCommentCounts,
} from "../../../../src/features/diff-review/hooks/useComments";
import {
  formatCommentThread,
} from "../../../../src/features/diff-review/widgets/CommentThread";
import {
  formatFileTreeEntryWithComments,
} from "../../../../src/features/diff-review/widgets/FileTree";
import type { AuthData } from "../../../../src/services/auth";
import type { BitbucketComment, PaginatedResponse } from "../../../../src/types/bitbucket";
import type { DiffStatFile } from "../../../../src/services/bitbucket";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

const now = new Date("2026-03-01T12:00:00Z");

function makeBBComment(overrides: Partial<BitbucketComment> = {}): BitbucketComment {
  return {
    id: 1,
    content: { raw: "Looks good!", markup: "markdown", html: "<p>Looks good!</p>" },
    user: { display_name: "Alice Smith", nickname: "alice" },
    created_on: "2026-02-28T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    deleted: false,
    ...overrides,
  };
}

const mockCommentsResponse: PaginatedResponse<BitbucketComment> = {
  values: [
    // General comment (no inline)
    makeBBComment({
      id: 100,
      content: { raw: "Overall LGTM", markup: "markdown", html: "" },
      user: { display_name: "Bob", nickname: "bob" },
    }),
    // Inline comment on src/auth.ts
    makeBBComment({
      id: 200,
      content: { raw: "Should we add error handling here?", markup: "markdown", html: "" },
      user: { display_name: "Alice Smith", nickname: "alice" },
      inline: { path: "src/auth.ts", to: 45 },
    }),
    // Reply to inline comment on src/auth.ts
    makeBBComment({
      id: 201,
      content: { raw: "Good point, I'll fix it", markup: "markdown", html: "" },
      user: { display_name: "Carol", nickname: "carol" },
      inline: { path: "src/auth.ts", to: 45 },
      parent: { id: 200 },
    }),
    // Inline comment on src/login.ts
    makeBBComment({
      id: 300,
      content: { raw: "This function needs a docstring", markup: "markdown", html: "" },
      user: { display_name: "Bob", nickname: "bob" },
      inline: { path: "src/login.ts", to: 1 },
      resolved: true,
    }),
    // Another inline comment on src/auth.ts (separate thread)
    makeBBComment({
      id: 210,
      content: { raw: "Consider using a constant here", markup: "markdown", html: "" },
      user: { display_name: "Bob", nickname: "bob" },
      inline: { path: "src/auth.ts", to: 12 },
    }),
    // A deleted comment that should be filtered out
    makeBBComment({
      id: 999,
      content: { raw: "Oops, wrong comment", markup: "markdown", html: "" },
      deleted: true,
    }),
  ],
};

// ─── Functional integration tests ───────────────────────────────────────────

describe("US-9 Comments functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockBitbucketCommentsAPI() {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/comments")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockCommentsResponse), { status: 200 })
        );
      }

      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  }

  // ─── AC: "Inline comments are fetched from the Bitbucket API" ─────────────

  it("should fetch comments and filter out deleted ones", async () => {
    mockBitbucketCommentsAPI();

    const comments = await fetchPRComments(mockAuth, "acme", "api", 42);

    // 6 raw comments, 1 deleted → 5 domain comments
    expect(comments).toHaveLength(5);
    expect(comments.every((c) => !c.deleted)).toBe(true);
  });

  // ─── AC: "Comment threads (replies) are shown nested under the parent" ────

  it("should build threaded comments with replies nested under parents", async () => {
    mockBitbucketCommentsAPI();

    const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
    const threads = buildCommentThreads(comments);

    // Top-level threads: general (100), inline auth.ts (200), inline login.ts (300), inline auth.ts (210)
    // Comment 201 is a reply to 200
    expect(threads).toHaveLength(4);

    // Find the thread that has the reply
    const threadWithReply = threads.find((t) => t.id === 200);
    expect(threadWithReply).toBeDefined();
    expect(threadWithReply!.replies).toHaveLength(1);
    expect(threadWithReply!.replies[0].id).toBe(201);
    expect(threadWithReply!.replies[0].content).toBe("Good point, I'll fix it");
  });

  // ─── AC: "General (non-inline) comments are shown in a separate section" ──

  it("should separate inline and general comments", async () => {
    mockBitbucketCommentsAPI();

    const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
    const threads = buildCommentThreads(comments);
    const grouped = groupCommentsByFile(threads);

    // General comments: comment 100
    expect(grouped.generalComments).toHaveLength(1);
    expect(grouped.generalComments[0].content).toBe("Overall LGTM");

    // Inline: 2 on src/auth.ts (200, 210), 1 on src/login.ts (300)
    expect(Object.keys(grouped.fileComments)).toHaveLength(2);
    expect(grouped.fileComments["src/auth.ts"]).toHaveLength(2);
    expect(grouped.fileComments["src/login.ts"]).toHaveLength(1);
  });

  // ─── AC: "Each comment shows the author, timestamp, and content" ──────────

  it("should format comments with author, age, and content", async () => {
    mockBitbucketCommentsAPI();

    const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
    const threads = buildCommentThreads(comments);
    const grouped = groupCommentsByFile(threads);

    // Format the general comment thread
    const generalThread = formatCommentThread(grouped.generalComments[0], now);

    expect(generalThread.parent.author).toBe("bob");
    expect(generalThread.parent.content).toBe("Overall LGTM");
    expect(generalThread.parent.age).toBe("1d");

    // Format an inline thread with reply
    const authThreads = grouped.fileComments["src/auth.ts"];
    const threadWithReply = authThreads.find((t) => t.id === 200)!;
    const formatted = formatCommentThread(threadWithReply, now);

    expect(formatted.parent.author).toBe("alice");
    expect(formatted.parent.content).toBe("Should we add error handling here?");
    expect(formatted.replies).toHaveLength(1);
    expect(formatted.replies[0].author).toBe("carol");
    expect(formatted.replies[0].content).toBe("Good point, I'll fix it");
    expect(formatted.replyCount).toBe(1);
  });

  // ─── AC: "Comment count badge in file tree reflects per-file counts" ──────

  it("should show per-file comment count badges in file tree", async () => {
    mockBitbucketCommentsAPI();

    const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
    const counts = getFileCommentCounts(comments);

    // src/auth.ts has 3 inline comments (200, 201, 210)
    // src/login.ts has 1 inline comment (300)
    expect(counts["src/auth.ts"]).toBe(3);
    expect(counts["src/login.ts"]).toBe(1);

    // Format file tree entries with comment counts
    const authFile: DiffStatFile = {
      path: "src/auth.ts",
      status: "modified",
      linesAdded: 1,
      linesRemoved: 0,
    };
    const loginFile: DiffStatFile = {
      path: "src/login.ts",
      status: "added",
      linesAdded: 5,
      linesRemoved: 0,
    };
    const configFile: DiffStatFile = {
      path: "src/config.ts",
      status: "modified",
      linesAdded: 1,
      linesRemoved: 1,
    };

    const authEntry = formatFileTreeEntryWithComments(authFile, counts);
    const loginEntry = formatFileTreeEntryWithComments(loginFile, counts);
    const configEntry = formatFileTreeEntryWithComments(configFile, counts);

    expect(authEntry.commentCount).toBe(3);
    expect(authEntry.filename).toBe("auth.ts");
    expect(loginEntry.commentCount).toBe(1);
    expect(configEntry.commentCount).toBe(0);
  });

  // ─── Full user session: reviewer views PR comments ────────────────────────

  describe("user session: reviewer views existing comments", () => {
    it("should show the full comment pipeline for a PR review", async () => {
      mockBitbucketCommentsAPI();

      // Step 1: Fetch comments from API
      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
      expect(comments).toHaveLength(5);

      // Step 2: Build threaded comments
      const threads = buildCommentThreads(comments);
      expect(threads).toHaveLength(4);

      // Step 3: Group by file
      const grouped = groupCommentsByFile(threads);

      // Step 4: User sees general comments section
      const generalThreads = grouped.generalComments.map((c) =>
        formatCommentThread(c, now)
      );
      expect(generalThreads).toHaveLength(1);
      expect(generalThreads[0].parent.content).toBe("Overall LGTM");

      // Step 5: User selects src/auth.ts in file tree → sees inline comments
      const authComments = grouped.fileComments["src/auth.ts"]!;
      const authThreads = authComments.map((c) => formatCommentThread(c, now));
      expect(authThreads).toHaveLength(2);

      // First thread has a reply
      const firstThread = authThreads.find((t) => t.parent.id === 200)!;
      expect(firstThread.parent.content).toBe("Should we add error handling here?");
      expect(firstThread.replyCount).toBe(1);

      // Second thread is standalone
      const secondThread = authThreads.find((t) => t.parent.id === 210)!;
      expect(secondThread.parent.content).toBe("Consider using a constant here");
      expect(secondThread.replyCount).toBe(0);

      // Step 6: User selects src/login.ts → sees resolved comment
      const loginComments = grouped.fileComments["src/login.ts"]!;
      const loginThreads = loginComments.map((c) => formatCommentThread(c, now));
      expect(loginThreads).toHaveLength(1);
      expect(loginThreads[0].parent.resolved).toBe(true);
      expect(loginThreads[0].parent.content).toBe("This function needs a docstring");

      // Step 7: File tree shows comment counts
      const counts = getFileCommentCounts(comments);
      expect(counts["src/auth.ts"]).toBe(3);
      expect(counts["src/login.ts"]).toBe(1);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle PR with no comments", async () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ values: [] }), { status: 200 })
        )
      );

      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);
      const threads = buildCommentThreads(comments);
      const grouped = groupCommentsByFile(threads);
      const counts = getFileCommentCounts(comments);

      expect(comments).toHaveLength(0);
      expect(threads).toHaveLength(0);
      expect(grouped.generalComments).toHaveLength(0);
      expect(Object.keys(grouped.fileComments)).toHaveLength(0);
      expect(Object.keys(counts)).toHaveLength(0);
    });

    it("should handle paginated comments", async () => {
      const page1: PaginatedResponse<BitbucketComment> = {
        values: [makeBBComment({ id: 1, content: { raw: "Page 1", markup: "", html: "" } })],
        next: "https://api.bitbucket.org/2.0/repositories/acme/api/pullrequests/42/comments?page=2",
      };
      const page2: PaginatedResponse<BitbucketComment> = {
        values: [makeBBComment({ id: 2, content: { raw: "Page 2", markup: "", html: "" } })],
      };

      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);

      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe("Page 1");
      expect(comments[1].content).toBe("Page 2");
    });

    it("should handle API failure gracefully", async () => {
      fetchSpy.mockResolvedValue(new Response("Error", { status: 500 }));

      const comments = await fetchPRComments(mockAuth, "acme", "api", 42);

      expect(comments).toHaveLength(0);
    });
  });
});
