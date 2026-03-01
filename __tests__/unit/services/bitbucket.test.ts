import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import {
  fetchOpenPRs,
  fetchOpenPRsForAllRepos,
  fetchDiffStatFiles,
  fetchPRDiff,
  fetchPRComments,
  postPRComment,
  type DiffStatEntry,
} from "../../../src/services/bitbucket";
import type { AuthData } from "../../../src/services/auth";
import type { BitbucketPR, BitbucketComment, PaginatedResponse } from "../../../src/types/bitbucket";

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

function makePR(overrides: Partial<BitbucketPR> = {}): BitbucketPR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    state: "OPEN",
    source: {
      branch: { name: "feature/auth-fix" },
      repository: { full_name: "workspace/repo" },
    },
    destination: { branch: { name: "main" } },
    author: { display_name: "Alice", nickname: "alice" },
    participants: [],
    comment_count: 2,
    created_on: "2026-02-27T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    links: {
      diff: { href: "https://api.bitbucket.org/2.0/repositories/workspace/repo/pullrequests/42/diff" },
      html: { href: "https://bitbucket.org/workspace/repo/pull-requests/42" },
    },
    ...overrides,
  };
}

function makeDiffStatResponse(entries: DiffStatEntry[]): PaginatedResponse<DiffStatEntry> {
  return { values: entries };
}

describe("fetchOpenPRs", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch open PRs for a repo", async () => {
    const pr = makePR();
    const prResponse: PaginatedResponse<BitbucketPR> = { values: [pr] };
    const diffStatResponse = makeDiffStatResponse([
      { lines_added: 10, lines_removed: 5, status: "modified" },
    ]);

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(prResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStatResponse), { status: 200 }));

    const result = await fetchOpenPRs(mockAuth, "workspace", "repo");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(42);
    expect(result[0].title).toBe("Fix auth flow");
    expect(result[0].repo).toBe("repo");
    expect(result[0].author.displayName).toBe("Alice");
    expect(result[0].linesAdded).toBe(10);
    expect(result[0].linesRemoved).toBe(5);
  });

  it("should handle pagination of PRs", async () => {
    const pr1 = makePR({ id: 1, title: "PR 1" });
    const pr2 = makePR({ id: 2, title: "PR 2" });

    const page1: PaginatedResponse<BitbucketPR> = {
      values: [pr1],
      next: "https://api.bitbucket.org/2.0/repositories/workspace/repo/pullrequests?state=OPEN&page=2",
    };
    const page2: PaginatedResponse<BitbucketPR> = {
      values: [pr2],
    };
    const diffStat1 = makeDiffStatResponse([
      { lines_added: 5, lines_removed: 3, status: "modified" },
    ]);
    const diffStat2 = makeDiffStatResponse([
      { lines_added: 8, lines_removed: 2, status: "modified" },
    ]);

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStat1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStat2), { status: 200 }));

    const result = await fetchOpenPRs(mockAuth, "workspace", "repo");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("should throw on 401 response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    try {
      await fetchOpenPRs(mockAuth, "workspace", "repo");
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe(
        "Your API token has expired. Run `opalite login` to add a new one."
      );
    }
  });

  it("should throw on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

    try {
      await fetchOpenPRs(mockAuth, "workspace", "repo");
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("500");
    }
  });
});

describe("fetchOpenPRsForAllRepos", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch PRs from multiple repos in parallel", async () => {
    const pr1 = makePR({ id: 1, title: "PR in repo-a" });
    const pr2 = makePR({ id: 2, title: "PR in repo-b" });

    const response1: PaginatedResponse<BitbucketPR> = { values: [pr1] };
    const response2: PaginatedResponse<BitbucketPR> = { values: [pr2] };
    const diffStat1 = makeDiffStatResponse([
      { lines_added: 5, lines_removed: 3, status: "modified" },
    ]);
    const diffStat2 = makeDiffStatResponse([
      { lines_added: 10, lines_removed: 1, status: "modified" },
    ]);

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(response1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response2), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStat1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStat2), { status: 200 }));

    const result = await fetchOpenPRsForAllRepos(mockAuth, "workspace", ["repo-a", "repo-b"]);

    expect(result).toHaveLength(2);
  });

  it("should return empty array for empty repos list", async () => {
    const result = await fetchOpenPRsForAllRepos(mockAuth, "workspace", []);

    expect(result).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should handle partial failures gracefully", async () => {
    const pr1 = makePR({ id: 1, title: "PR in repo-a" });
    const response1: PaginatedResponse<BitbucketPR> = { values: [pr1] };
    const diffStat1 = makeDiffStatResponse([
      { lines_added: 5, lines_removed: 3, status: "modified" },
    ]);

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(response1), { status: 200 }))
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(diffStat1), { status: 200 }));

    const result = await fetchOpenPRsForAllRepos(mockAuth, "workspace", ["repo-a", "repo-b"]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("PR in repo-a");
  });
});

describe("fetchDiffStatFiles", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch file-level diffstat with paths", async () => {
    const diffStatResponse = {
      values: [
        {
          status: "modified",
          lines_added: 10,
          lines_removed: 5,
          old: { path: "src/auth.ts" },
          new: { path: "src/auth.ts" },
        },
        {
          status: "added",
          lines_added: 30,
          lines_removed: 0,
          old: null,
          new: { path: "src/login.ts" },
        },
        {
          status: "removed",
          lines_added: 0,
          lines_removed: 20,
          old: { path: "src/old.ts" },
          new: null,
        },
      ],
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(diffStatResponse), { status: 200 })
    );

    const files = await fetchDiffStatFiles(mockAuth, "workspace", "repo", 42);

    expect(files).toHaveLength(3);
    expect(files[0]).toEqual({
      path: "src/auth.ts",
      status: "modified",
      linesAdded: 10,
      linesRemoved: 5,
    });
    expect(files[1]).toEqual({
      path: "src/login.ts",
      status: "added",
      linesAdded: 30,
      linesRemoved: 0,
    });
    expect(files[2]).toEqual({
      path: "src/old.ts",
      status: "removed",
      linesAdded: 0,
      linesRemoved: 20,
    });
  });

  it("should handle pagination of diffstat entries", async () => {
    const page1 = {
      values: [
        {
          status: "modified",
          lines_added: 5,
          lines_removed: 2,
          old: { path: "file1.ts" },
          new: { path: "file1.ts" },
        },
      ],
      next: "https://api.bitbucket.org/2.0/repositories/workspace/repo/pullrequests/42/diffstat?page=2",
    };
    const page2 = {
      values: [
        {
          status: "added",
          lines_added: 10,
          lines_removed: 0,
          old: null,
          new: { path: "file2.ts" },
        },
      ],
    };

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

    const files = await fetchDiffStatFiles(mockAuth, "workspace", "repo", 42);

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("file1.ts");
    expect(files[1].path).toBe("file2.ts");
  });

  it("should return empty array on error", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Error", { status: 500 }));

    const files = await fetchDiffStatFiles(mockAuth, "workspace", "repo", 42);

    expect(files).toHaveLength(0);
  });
});

describe("fetchPRDiff", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch raw diff text for a PR", async () => {
    const rawDiff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 import { join } from "path";
+import { homedir } from "os";

 export function getAuthPath() {
`;

    fetchSpy.mockResolvedValueOnce(new Response(rawDiff, { status: 200 }));

    const result = await fetchPRDiff(mockAuth, "workspace", "repo", 42);

    expect(result).toBe(rawDiff);
  });

  it("should return empty string on error", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Error", { status: 500 }));

    const result = await fetchPRDiff(mockAuth, "workspace", "repo", 42);

    expect(result).toBe("");
  });
});

function makeBBComment(overrides: Partial<BitbucketComment> = {}): BitbucketComment {
  return {
    id: 1,
    content: { raw: "Looks good!", markup: "markdown", html: "<p>Looks good!</p>" },
    user: { display_name: "Alice", nickname: "alice" },
    created_on: "2026-02-28T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    deleted: false,
    ...overrides,
  };
}

describe("fetchPRComments", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should fetch comments and transform to domain Comment objects", async () => {
    const comment = makeBBComment({
      id: 10,
      content: { raw: "Nice work!", markup: "markdown", html: "" },
      user: { display_name: "Bob", nickname: "bob" },
    });
    const response: PaginatedResponse<BitbucketComment> = { values: [comment] };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(response), { status: 200 })
    );

    const result = await fetchPRComments(mockAuth, "workspace", "repo", 42);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
    expect(result[0].content).toBe("Nice work!");
    expect(result[0].author.displayName).toBe("Bob");
    expect(result[0].author.nickname).toBe("bob");
    expect(result[0].isInline).toBe(false);
    expect(result[0].replies).toEqual([]);
  });

  it("should mark inline comments with file path and line number", async () => {
    const comment = makeBBComment({
      id: 20,
      inline: { path: "src/auth.ts", to: 45 },
    });
    const response: PaginatedResponse<BitbucketComment> = { values: [comment] };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(response), { status: 200 })
    );

    const result = await fetchPRComments(mockAuth, "workspace", "repo", 42);

    expect(result).toHaveLength(1);
    expect(result[0].isInline).toBe(true);
    expect(result[0].filePath).toBe("src/auth.ts");
    expect(result[0].lineNumber).toBe(45);
  });

  it("should handle pagination of comments", async () => {
    const page1: PaginatedResponse<BitbucketComment> = {
      values: [makeBBComment({ id: 1 })],
      next: "https://api.bitbucket.org/2.0/repositories/workspace/repo/pullrequests/42/comments?page=2",
    };
    const page2: PaginatedResponse<BitbucketComment> = {
      values: [makeBBComment({ id: 2 })],
    };

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

    const result = await fetchPRComments(mockAuth, "workspace", "repo", 42);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("should exclude deleted comments", async () => {
    const comments = [
      makeBBComment({ id: 1, deleted: false }),
      makeBBComment({ id: 2, deleted: true }),
      makeBBComment({ id: 3, deleted: false }),
    ];
    const response: PaginatedResponse<BitbucketComment> = { values: comments };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(response), { status: 200 })
    );

    const result = await fetchPRComments(mockAuth, "workspace", "repo", 42);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3);
  });

  it("should return empty array on error", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Error", { status: 500 }));

    const result = await fetchPRComments(mockAuth, "workspace", "repo", 42);

    expect(result).toEqual([]);
  });

  it("should throw on 401 response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    try {
      await fetchPRComments(mockAuth, "workspace", "repo", 42);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe(
        "Your API token has expired. Run `opalite login` to add a new one."
      );
    }
  });
});

describe("postPRComment", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should post a general comment and return the domain Comment", async () => {
    const bbResponse: BitbucketComment = {
      id: 500,
      content: { raw: "Looks great!", markup: "markdown", html: "" },
      user: { display_name: "Test User", nickname: "testuser" },
      created_on: "2026-03-01T12:00:00Z",
      updated_on: "2026-03-01T12:00:00Z",
      deleted: false,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(bbResponse), { status: 201 })
    );

    const result = await postPRComment(mockAuth, "workspace", "repo", 42, {
      content: "Looks great!",
    });

    expect(result.id).toBe(500);
    expect(result.content).toBe("Looks great!");
    expect(result.author.nickname).toBe("testuser");
    expect(result.isInline).toBe(false);

    // Verify POST was sent with correct body
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/pullrequests/42/comments");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.content.raw).toBe("Looks great!");
  });

  it("should post an inline comment with file path and line number", async () => {
    const bbResponse: BitbucketComment = {
      id: 501,
      content: { raw: "Fix this", markup: "markdown", html: "" },
      user: { display_name: "Test User", nickname: "testuser" },
      created_on: "2026-03-01T12:00:00Z",
      updated_on: "2026-03-01T12:00:00Z",
      inline: { path: "src/auth.ts", to: 45 },
      deleted: false,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(bbResponse), { status: 201 })
    );

    const result = await postPRComment(mockAuth, "workspace", "repo", 42, {
      content: "Fix this",
      inline: { path: "src/auth.ts", to: 45 },
    });

    expect(result.id).toBe(501);
    expect(result.isInline).toBe(true);
    expect(result.filePath).toBe("src/auth.ts");
    expect(result.lineNumber).toBe(45);

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.inline.path).toBe("src/auth.ts");
    expect(body.inline.to).toBe(45);
  });

  it("should post a reply comment with parent id", async () => {
    const bbResponse: BitbucketComment = {
      id: 502,
      content: { raw: "Good point", markup: "markdown", html: "" },
      user: { display_name: "Test User", nickname: "testuser" },
      created_on: "2026-03-01T12:00:00Z",
      updated_on: "2026-03-01T12:00:00Z",
      inline: { path: "src/auth.ts", to: 45 },
      parent: { id: 200 },
      deleted: false,
    };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(bbResponse), { status: 201 })
    );

    const result = await postPRComment(mockAuth, "workspace", "repo", 42, {
      content: "Good point",
      parentId: 200,
    });

    expect(result.id).toBe(502);
    expect(result.parentId).toBe(200);

    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.parent.id).toBe(200);
  });

  it("should throw on non-ok response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Server Error", { status: 500 })
    );

    try {
      await postPRComment(mockAuth, "workspace", "repo", 42, {
        content: "Test",
      });
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("Failed to post comment");
    }
  });

  it("should throw on 401 response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    try {
      await postPRComment(mockAuth, "workspace", "repo", 42, {
        content: "Test",
      });
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe(
        "Your API token has expired. Run `opalite login` to add a new one."
      );
    }
  });
});
