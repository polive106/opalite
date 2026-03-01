import { describe, expect, it, beforeEach } from "bun:test";
import type { PR } from "../../../../src/types/review";

function makePR(overrides: Partial<PR> = {}): PR {
  return {
    id: 42,
    title: "Fix auth flow",
    description: "Fixes the auth flow",
    sourceBranch: "feature/auth-fix",
    destinationBranch: "main",
    author: { displayName: "Alice", nickname: "alice" },
    repo: "repo-a",
    commentCount: 2,
    createdOn: new Date("2026-02-27T10:00:00Z"),
    updatedOn: new Date("2026-02-28T10:00:00Z"),
    filesChanged: 3,
    linesAdded: 50,
    linesRemoved: 10,
    url: "https://bitbucket.org/workspace/repo-a/pull-requests/42",
    participants: [],
    ...overrides,
  };
}

describe("useMyPRsNavigation helpers", () => {
  let helpers: typeof import("../../../../src/features/author-mode/hooks/useMyPRsNavigation");

  beforeEach(async () => {
    helpers = await import("../../../../src/features/author-mode/hooks/useMyPRsNavigation");
  });

  const myPRs: PR[] = [
    makePR({ id: 1, title: "First PR" }),
    makePR({ id: 2, title: "Second PR" }),
    makePR({ id: 3, title: "Third PR" }),
  ];

  describe("handleMyPRsKey", () => {
    it("should move selection down with ArrowDown", () => {
      const action = helpers.handleMyPRsKey("down", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection down with j", () => {
      const action = helpers.handleMyPRsKey("j", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection up with ArrowUp", () => {
      const action = helpers.handleMyPRsKey("up", { selectedIndex: 2 }, myPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(1);
      }
    });

    it("should move selection up with k", () => {
      const action = helpers.handleMyPRsKey("k", { selectedIndex: 1 }, myPRs);
      expect(action.action).toBe("select");
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    it("should clamp at bottom when pressing down on last item", () => {
      const action = helpers.handleMyPRsKey("down", { selectedIndex: 2 }, myPRs);
      if (action.action === "select") {
        expect(action.index).toBe(2);
      }
    });

    it("should clamp at top when pressing up on first item", () => {
      const action = helpers.handleMyPRsKey("up", { selectedIndex: 0 }, myPRs);
      if (action.action === "select") {
        expect(action.index).toBe(0);
      }
    });

    it("should navigate to comment-queue on Enter", () => {
      const action = helpers.handleMyPRsKey("return", { selectedIndex: 1 }, myPRs);
      expect(action.action).toBe("open-comment-queue");
      if (action.action === "open-comment-queue") {
        expect(action.pr.id).toBe(2);
        expect(action.pr.title).toBe("Second PR");
      }
    });

    it("should navigate to dashboard on d", () => {
      const action = helpers.handleMyPRsKey("d", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("dashboard");
    });

    it("should quit on q", () => {
      const action = helpers.handleMyPRsKey("q", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("quit");
    });

    it("should refresh on r", () => {
      const action = helpers.handleMyPRsKey("r", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("refresh");
    });

    it("should return none for unrecognized keys", () => {
      const action = helpers.handleMyPRsKey("x", { selectedIndex: 0 }, myPRs);
      expect(action.action).toBe("none");
    });

    it("should return none for navigation keys on empty list", () => {
      expect(helpers.handleMyPRsKey("down", { selectedIndex: 0 }, []).action).toBe("none");
      expect(helpers.handleMyPRsKey("return", { selectedIndex: 0 }, []).action).toBe("none");
    });

    it("should still allow quit and dashboard on empty list", () => {
      expect(helpers.handleMyPRsKey("q", { selectedIndex: 0 }, []).action).toBe("quit");
      expect(helpers.handleMyPRsKey("d", { selectedIndex: 0 }, []).action).toBe("dashboard");
    });
  });
});
