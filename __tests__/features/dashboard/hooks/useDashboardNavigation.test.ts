import { describe, expect, it } from "bun:test";
import type { PR } from "../../../../src/types/review";
import {
  handleDashboardKey,
  type DashboardNavigationState,
} from "../../../../src/features/dashboard/hooks/useDashboardNavigation";

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

describe("handleDashboardKey", () => {
  const prs = [
    makePR({ id: 1 }),
    makePR({ id: 2 }),
    makePR({ id: 3 }),
  ];

  it("should move down on ArrowDown", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("ArrowDown", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(1);
    }
  });

  it("should move down on j", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("j", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(1);
    }
  });

  it("should not go below the last item", () => {
    const state: DashboardNavigationState = { selectedIndex: 2 };
    const result = handleDashboardKey("ArrowDown", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(2);
    }
  });

  it("should move up on ArrowUp", () => {
    const state: DashboardNavigationState = { selectedIndex: 2 };
    const result = handleDashboardKey("ArrowUp", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(1);
    }
  });

  it("should move up on k", () => {
    const state: DashboardNavigationState = { selectedIndex: 1 };
    const result = handleDashboardKey("k", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(0);
    }
  });

  it("should not go above 0", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("ArrowUp", state, prs);
    expect(result.action).toBe("select");
    if (result.action === "select") {
      expect(result.index).toBe(0);
    }
  });

  it("should return navigate on Enter", () => {
    const state: DashboardNavigationState = { selectedIndex: 1 };
    const result = handleDashboardKey("Enter", state, prs);
    expect(result.action).toBe("navigate");
    if (result.action === "navigate") {
      expect(result.pr.id).toBe(2);
    }
  });

  it("should return refresh on r", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("r", state, prs);
    expect(result.action).toBe("refresh");
  });

  it("should return quit on q", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("q", state, prs);
    expect(result.action).toBe("quit");
  });

  it("should return none for unhandled keys", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("x", state, prs);
    expect(result.action).toBe("none");
  });

  it("should return none for navigation keys on empty list", () => {
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const result = handleDashboardKey("Enter", state, []);
    expect(result.action).toBe("none");
  });
});
