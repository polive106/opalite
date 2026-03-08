/**
 * Integration tests for TanStack Query cache behavior.
 *
 * Verifies that navigating between screens reuses cached data
 * instead of re-fetching from the API, and that cache invalidation
 * triggers fresh fetches when expected.
 *
 * Pattern: Use QueryClient.fetchQuery() directly to simulate
 * what the hooks do, and count fetch calls to verify cache hits/misses.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import { createTestQueryClient } from "../../../test-utils/createTestQueryClient";
import { queryKeys } from "../../../../src/services/queryKeys";
import { fetchOpenPRsForAllRepos, fetchPRDiff, fetchDiffStatFiles, fetchPRComments } from "../../../../src/services/bitbucket";
import type { AuthData } from "../../../../src/services/auth";
import type { BitbucketPR, PaginatedResponse } from "../../../../src/types/bitbucket";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

function makeBitbucketPRResponse(prs: Partial<BitbucketPR>[]): PaginatedResponse<BitbucketPR> {
  return {
    values: prs.map((pr, i) => ({
      id: pr.id ?? i + 1,
      title: pr.title ?? `PR ${i + 1}`,
      description: pr.description ?? "",
      source: { branch: { name: "feature" } },
      destination: { branch: { name: "main" } },
      author: {
        display_name: "Alice",
        nickname: "alice",
        links: { avatar: { href: "" } },
      },
      comment_count: 0,
      created_on: "2026-03-01T10:00:00Z",
      updated_on: "2026-03-01T10:00:00Z",
      links: {
        html: { href: `https://bitbucket.org/acme/api/pull-requests/${pr.id ?? i + 1}` },
        diffstat: { href: "" },
        diff: { href: "" },
      },
      participants: [],
      ...pr,
    })) as BitbucketPR[],
    next: undefined,
    page: 1,
    size: prs.length,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TanStack Query cache behavior", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("PR list cache", () => {
    it("should not re-fetch PRs when data is still fresh", async () => {
      const queryClient = createTestQueryClient();
      // Set a staleTime so data stays fresh between fetches
      const staleTime = 5 * 60 * 1000;

      // Mock a single API response per repo
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify(makeBitbucketPRResponse([{ id: 1, title: "Fix auth" }])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      // First fetch — cache miss, should call the API
      const key = queryKeys.prs("acme", ["api"]);
      const result1 = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]),
        staleTime,
      });

      expect(result1).toHaveLength(1);
      expect(result1[0].title).toBe("Fix auth");
      const callsAfterFirst = fetchSpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Second fetch with same key — cache hit, should NOT call the API
      const result2 = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]),
        staleTime,
      });

      expect(result2).toHaveLength(1);
      expect(result2[0].title).toBe("Fix auth");
      // No additional fetch calls — data served from cache
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);

      queryClient.clear();
    });

    it("should re-fetch PRs after cache invalidation", async () => {
      const queryClient = createTestQueryClient();
      const staleTime = 5 * 60 * 1000;

      fetchSpy.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makeBitbucketPRResponse([{ id: 1, title: "Fix auth" }])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }))
      );

      const key = queryKeys.prs("acme", ["api"]);

      // First fetch
      await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]),
        staleTime,
      });
      const callsAfterFirst = fetchSpy.mock.calls.length;

      // Invalidate the cache
      await queryClient.invalidateQueries({ queryKey: key });

      // Next fetch should hit the API again
      await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]),
        staleTime,
      });

      expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);

      queryClient.clear();
    });
  });

  describe("diff cache", () => {
    it("should cache diff data and serve from cache on re-navigation", async () => {
      const queryClient = createTestQueryClient();
      const staleTime = 5 * 60 * 1000;

      const diffContent = "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new";
      fetchSpy.mockResolvedValue(
        new Response(diffContent, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      );

      const key = queryKeys.diff("acme", "api", 42);

      // First fetch — cache miss
      const result1 = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchPRDiff(mockAuth, "acme", "api", 42),
        staleTime,
      });
      expect(result1).toContain("-old");
      const callsAfterFirst = fetchSpy.mock.calls.length;

      // Second fetch — cache hit
      const result2 = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchPRDiff(mockAuth, "acme", "api", 42),
        staleTime,
      });
      expect(result2).toContain("-old");
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);

      queryClient.clear();
    });
  });

  describe("comments cache", () => {
    it("should cache comments with shorter staleTime than diffs", async () => {
      const queryClient = createTestQueryClient();

      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({
          values: [{
            id: 1,
            content: { raw: "LGTM", markup: "markdown", html: "" },
            user: { display_name: "Alice", nickname: "alice", links: { avatar: { href: "" } } },
            created_on: "2026-03-01T10:00:00Z",
            updated_on: "2026-03-01T10:00:00Z",
            deleted: false,
            inline: undefined,
            parent: undefined,
            links: { html: { href: "" } },
          }],
          next: undefined,
          page: 1,
          size: 1,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const key = queryKeys.comments("acme", "api", 42);

      // First fetch
      await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchPRComments(mockAuth, "acme", "api", 42),
        staleTime: 1 * 60 * 1000,
      });
      const callsAfterFirst = fetchSpy.mock.calls.length;

      // Second fetch — still fresh, cache hit
      await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchPRComments(mockAuth, "acme", "api", 42),
        staleTime: 1 * 60 * 1000,
      });
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);

      queryClient.clear();
    });
  });

  describe("cross-query independence", () => {
    it("should not share cache between different query keys", async () => {
      const queryClient = createTestQueryClient();
      const staleTime = 5 * 60 * 1000;

      fetchSpy.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makeBitbucketPRResponse([{ id: 1, title: "PR 1" }])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }))
      );

      // Fetch PRs for repo "api"
      await queryClient.fetchQuery({
        queryKey: queryKeys.prs("acme", ["api"]),
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]),
        staleTime,
      });
      const callsAfterFirst = fetchSpy.mock.calls.length;

      // Fetch PRs for repo "frontend" — different key, should NOT use api cache
      await queryClient.fetchQuery({
        queryKey: queryKeys.prs("acme", ["frontend"]),
        queryFn: () => fetchOpenPRsForAllRepos(mockAuth, "acme", ["frontend"]),
        staleTime,
      });

      expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);

      queryClient.clear();
    });
  });

  describe("query key factory", () => {
    it("should produce stable keys regardless of repo order", () => {
      const key1 = queryKeys.prs("acme", ["api", "frontend"]);
      const key2 = queryKeys.prs("acme", ["frontend", "api"]);

      expect(key1).toEqual(key2);
    });

    it("should produce different keys for different workspaces", () => {
      const key1 = queryKeys.prs("acme", ["api"]);
      const key2 = queryKeys.prs("other-org", ["api"]);

      expect(key1).not.toEqual(key2);
    });

    it("should produce different keys for different PR IDs", () => {
      const key1 = queryKeys.diff("acme", "api", 42);
      const key2 = queryKeys.diff("acme", "api", 43);

      expect(key1).not.toEqual(key2);
    });
  });
});
