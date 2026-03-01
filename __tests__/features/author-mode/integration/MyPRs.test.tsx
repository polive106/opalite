/**
 * Feature-level functional integration test for the MyPRs screen.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     -> fetchOpenPRsForAllRepos (service)
 *       -> filterMyPRs / getReviewerSummary / countUnresolved (hook logic)
 *         -> formatMyPRRow (widget data transform)
 *           -> handleMyPRsKey (navigation state machine)
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import type { BitbucketPR, BitbucketComment, PaginatedResponse } from "../../../../src/types/bitbucket";
import type { DiffStatEntry } from "../../../../src/services/bitbucket";
import { fetchOpenPRsForAllRepos } from "../../../../src/services/bitbucket";
import {
  filterMyPRs,
  countUnresolved,
  getReviewerSummary,
} from "../../../../src/features/author-mode/hooks/useMyPRs";
import { formatMyPRRow } from "../../../../src/features/author-mode/widgets/MyPRRow";
import {
  handleMyPRsKey,
  type MyPRsNavigationState,
} from "../../../../src/features/author-mode/hooks/useMyPRsNavigation";
import { fetchPRComments } from "../../../../src/services/bitbucket";
import type { AuthData } from "../../../../src/services/auth";
import type { PR } from "../../../../src/types/review";
import { formatKeyBindings, type KeyBinding } from "../../../../src/features/shared/widgets/KeyBar";

// --- Test fixtures ---

const mockAuth: AuthData = {
  email: "alice@company.com",
  apiToken: "ATATtoken123",
  displayName: "Alice Smith",
  username: "alice",
};

function makeBitbucketPR(overrides: Partial<BitbucketPR> = {}): BitbucketPR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    state: "OPEN",
    source: {
      branch: { name: "feature/auth-fix" },
      repository: { full_name: "acme/api" },
    },
    destination: { branch: { name: "main" } },
    author: { display_name: "Alice Smith", nickname: "alice" },
    participants: [],
    comment_count: 3,
    created_on: "2026-02-27T10:00:00Z",
    updated_on: "2026-02-28T14:00:00Z",
    links: {
      diff: { href: "https://api.bitbucket.org/2.0/repositories/acme/api/pullrequests/42/diff" },
      html: { href: "https://bitbucket.org/acme/api/pull-requests/42" },
    },
    ...overrides,
  };
}

function makeBitbucketComment(overrides: Partial<BitbucketComment> = {}): BitbucketComment {
  return {
    id: 1,
    content: { raw: "Fix this please", markup: "markdown", html: "<p>Fix this please</p>" },
    user: { display_name: "Bob Jones", nickname: "bob" },
    created_on: "2026-02-28T10:00:00Z",
    updated_on: "2026-02-28T10:00:00Z",
    deleted: false,
    ...overrides,
  };
}

// --- Integration tests ---

describe("MyPRs functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * Set up fetch mock for PRs + diffstats + comments.
   */
  function mockBitbucketAPI(
    repos: Record<string, BitbucketPR[]>,
    comments?: Record<number, BitbucketComment[]>
  ) {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // Match PR list endpoint
      const prListMatch = url.match(/\/repositories\/\w+\/(\w[\w-]*)\/pullrequests\?state=OPEN/);
      if (prListMatch) {
        const repo = prListMatch[1];
        const prs = repos[repo] ?? [];
        const response: PaginatedResponse<BitbucketPR> = { values: prs };
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      // Match comments endpoint
      const commentsMatch = url.match(/\/pullrequests\/(\d+)\/comments/);
      if (commentsMatch) {
        const prId = parseInt(commentsMatch[1], 10);
        const prComments = comments?.[prId] ?? [];
        const response: PaginatedResponse<BitbucketComment> = { values: prComments };
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      // Match diffstat endpoint
      const diffStatMatch = url.match(/\/pullrequests\/(\d+)\/diffstat/);
      if (diffStatMatch) {
        const response: PaginatedResponse<DiffStatEntry> = {
          values: [{ lines_added: 10, lines_removed: 5, status: "modified" }],
        };
        return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
      }

      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  }

  // --- AC: "Only PRs authored by the logged-in user are shown" ---

  it("should filter PRs to only show the current user's PRs", async () => {
    mockBitbucketAPI({
      api: [
        makeBitbucketPR({ id: 1, title: "Alice's PR", author: { display_name: "Alice Smith", nickname: "alice" } }),
        makeBitbucketPR({ id: 2, title: "Bob's PR", author: { display_name: "Bob Jones", nickname: "bob" } }),
      ],
      frontend: [
        makeBitbucketPR({ id: 3, title: "Alice's other PR", author: { display_name: "Alice Smith", nickname: "alice" } }),
        makeBitbucketPR({ id: 4, title: "Charlie's PR", author: { display_name: "Charlie", nickname: "charlie" } }),
      ],
    });

    const allPRs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);
    const myPRs = filterMyPRs(allPRs, "alice");

    expect(myPRs).toHaveLength(2);
    expect(myPRs[0].title).toBe("Alice's PR");
    expect(myPRs[1].title).toBe("Alice's other PR");
  });

  // --- AC: "Each PR shows: title, age, comment count (total and unresolved)" ---

  it("should display PR with title, age, total comments, and unresolved count", async () => {
    const now = new Date("2026-03-01T12:00:00Z");

    mockBitbucketAPI(
      {
        api: [
          makeBitbucketPR({
            id: 10,
            title: "Fix login bug",
            author: { display_name: "Alice", nickname: "alice" },
            comment_count: 5,
            created_on: "2026-02-28T00:00:00Z",
            participants: [
              { user: { display_name: "Bob", nickname: "bob" }, role: "REVIEWER", approved: true, state: "approved" },
              { user: { display_name: "Charlie", nickname: "charlie" }, role: "REVIEWER", approved: false, state: null },
            ],
          }),
        ],
      },
      {
        10: [
          makeBitbucketComment({ id: 1, resolved: false }),
          makeBitbucketComment({ id: 2, resolved: true }),
          makeBitbucketComment({ id: 3, resolved: false }),
          makeBitbucketComment({ id: 4, resolved: false, parent: { id: 1 } }), // reply, should not count
        ],
      }
    );

    const allPRs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]);
    const myPRs = filterMyPRs(allPRs, "alice");
    expect(myPRs).toHaveLength(1);

    const pr = myPRs[0];
    const comments = await fetchPRComments(mockAuth, "acme", pr.repo, pr.id);
    const unresolvedCount = countUnresolved(comments);
    const reviewerSummary = getReviewerSummary(pr);

    expect(unresolvedCount).toBe(2); // 2 top-level unresolved
    expect(reviewerSummary.approved).toBe(1);
    expect(reviewerSummary.pending).toBe(1);

    const row = formatMyPRRow(pr, now, unresolvedCount, reviewerSummary, 24, 48);

    expect(row.title).toBe("Fix login bug");
    expect(row.age).toBe("1d");
    expect(row.ageColor).toBe("yellow"); // 36h, between 24 and 48
    expect(row.commentCount).toBe(5);
    expect(row.unresolvedCount).toBe(2);
    expect(row.reviewerSummary.approved).toBe(1);
    expect(row.reviewerSummary.pending).toBe(1);
  });

  // --- Full user session: load -> browse -> navigate -> select -> enter ---

  describe("user session: author browses their PRs and opens comment queue", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    let myPRs: PR[];

    beforeEach(async () => {
      mockBitbucketAPI({
        api: [
          makeBitbucketPR({
            id: 101,
            title: "Fix auth token refresh",
            author: { display_name: "Alice", nickname: "alice" },
            created_on: "2026-02-27T10:00:00Z",
            comment_count: 4,
            participants: [
              { user: { display_name: "Bob", nickname: "bob" }, role: "REVIEWER", approved: true, state: "approved" },
            ],
          }),
          makeBitbucketPR({
            id: 102,
            title: "Add rate limiting",
            author: { display_name: "Charlie", nickname: "charlie" },
            created_on: "2026-02-28T06:00:00Z",
            comment_count: 1,
          }),
        ],
        frontend: [
          makeBitbucketPR({
            id: 201,
            title: "Update nav component",
            author: { display_name: "Alice", nickname: "alice" },
            created_on: "2026-03-01T08:00:00Z",
            comment_count: 0,
            participants: [
              { user: { display_name: "Dave", nickname: "dave" }, role: "REVIEWER", approved: false, state: "changes_requested" },
            ],
          }),
        ],
      });

      const allPRs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api", "frontend"]);
      myPRs = filterMyPRs(allPRs, "alice");
    });

    it("should show only Alice's PRs (2 out of 3)", () => {
      expect(myPRs).toHaveLength(2);
      expect(myPRs[0].title).toBe("Fix auth token refresh");
      expect(myPRs[1].title).toBe("Update nav component");
    });

    it("should let user navigate through their PR list", () => {
      let state: MyPRsNavigationState = { selectedIndex: 0 };

      // Initially on first PR
      let row = formatMyPRRow(myPRs[0], now, 0, getReviewerSummary(myPRs[0]), 24, 48);
      expect(row.title).toBe("Fix auth token refresh");
      expect(row.ageColor).toBe("red"); // old PR

      // Press j -> move to second PR
      let action = handleMyPRsKey("j", state, myPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        state = { selectedIndex: action.index };
        row = formatMyPRRow(myPRs[state.selectedIndex], now, 0, getReviewerSummary(myPRs[1]), 24, 48);
        expect(row.title).toBe("Update nav component");
        expect(row.ageColor).toBe("green"); // fresh PR
      }

      // Press ArrowDown at bottom -> stays
      action = handleMyPRsKey("down", state, myPRs);
      if (action.action === "select") {
        expect(action.index).toBe(1); // still last
      }
    });

    it("should open comment queue when user presses Enter", () => {
      const state: MyPRsNavigationState = { selectedIndex: 0 };
      const action = handleMyPRsKey("return", state, myPRs);

      expect(action.action).toBe("open-comment-queue");
      if (action.action === "open-comment-queue") {
        expect(action.pr.id).toBe(101);
        expect(action.pr.title).toBe("Fix auth token refresh");
      }
    });

    it("should go back to dashboard when user presses d", () => {
      const state: MyPRsNavigationState = { selectedIndex: 0 };
      const action = handleMyPRsKey("d", state, myPRs);
      expect(action.action).toBe("dashboard");
    });

    it("should quit when user presses q", () => {
      const state: MyPRsNavigationState = { selectedIndex: 0 };
      const action = handleMyPRsKey("q", state, myPRs);
      expect(action.action).toBe("quit");
    });

    it("should format reviewer statuses correctly", () => {
      // First PR has 1 approved reviewer
      const summary1 = getReviewerSummary(myPRs[0]);
      expect(summary1.approved).toBe(1);
      expect(summary1.changesRequested).toBe(0);
      expect(summary1.pending).toBe(0);

      // Second PR has 1 changes-requested reviewer
      const summary2 = getReviewerSummary(myPRs[1]);
      expect(summary2.approved).toBe(0);
      expect(summary2.changesRequested).toBe(1);
      expect(summary2.pending).toBe(0);
    });
  });

  // --- AC: "A keybinding help bar is shown at the bottom of the screen" ---

  it("should show key bindings including navigate, open, dashboard, refresh, quit", () => {
    const myPRsBindings: KeyBinding[] = [
      { key: "\u2191\u2193", label: "navigate" },
      { key: "\u23ce", label: "comments" },
      { key: "d", label: "dashboard" },
      { key: "r", label: "refresh" },
      { key: "q", label: "quit" },
    ];

    const formatted = formatKeyBindings(myPRsBindings);
    expect(formatted).toHaveLength(5);
    expect(formatted[1].label).toBe("comments");
    expect(formatted[2].key).toBe("d");
    expect(formatted[2].label).toBe("dashboard");
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("should handle no PRs for current user", async () => {
      mockBitbucketAPI({
        api: [
          makeBitbucketPR({ id: 1, author: { display_name: "Bob", nickname: "bob" } }),
        ],
      });

      const allPRs = await fetchOpenPRsForAllRepos(mockAuth, "acme", ["api"]);
      const myPRs = filterMyPRs(allPRs, "alice");

      expect(myPRs).toHaveLength(0);

      // Navigation on empty list
      expect(handleMyPRsKey("down", { selectedIndex: 0 }, []).action).toBe("none");
      expect(handleMyPRsKey("return", { selectedIndex: 0 }, []).action).toBe("none");
      // But d and q still work
      expect(handleMyPRsKey("d", { selectedIndex: 0 }, []).action).toBe("dashboard");
      expect(handleMyPRsKey("q", { selectedIndex: 0 }, []).action).toBe("quit");
    });
  });
});
