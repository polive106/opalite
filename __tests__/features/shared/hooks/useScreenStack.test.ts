import { describe, expect, it } from "bun:test";
import type { PR } from "../../../../src/types/review";
import type { Screen } from "../../../../src/App";
import {
  pushScreen,
  popScreen,
  currentScreen,
  isBackKey,
} from "../../../../src/features/shared/hooks/useScreenStack";

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

// ─── pushScreen ─────────────────────────────────────────────────────────

describe("pushScreen", () => {
  it("should add a screen to the top of the stack", () => {
    const stack: Screen[] = [{ name: "dashboard" }];
    const pr = makePR();
    const result = pushScreen(stack, { name: "diffnav", pr });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("dashboard");
    expect(result[1].name).toBe("diffnav");
  });

  it("should support multiple levels of navigation", () => {
    const pr = makePR();
    let stack: Screen[] = [{ name: "dashboard" }];
    stack = pushScreen(stack, { name: "diffnav", pr });
    stack = pushScreen(stack, { name: "review-submit", pr, initialAction: "approve" });

    expect(stack).toHaveLength(3);
    expect(stack[0].name).toBe("dashboard");
    expect(stack[1].name).toBe("diffnav");
    expect(stack[2].name).toBe("review-submit");
  });

  it("should not mutate the original stack", () => {
    const stack: Screen[] = [{ name: "dashboard" }];
    const result = pushScreen(stack, { name: "my-prs" });

    expect(stack).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});

// ─── popScreen ──────────────────────────────────────────────────────────

describe("popScreen", () => {
  it("should remove the top screen from the stack", () => {
    const pr = makePR();
    const stack: Screen[] = [{ name: "dashboard" }, { name: "diffnav", pr }];
    const result = popScreen(stack);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("dashboard");
  });

  it("should not pop below a single item (root screen)", () => {
    const stack: Screen[] = [{ name: "dashboard" }];
    const result = popScreen(stack);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("dashboard");
  });

  it("should support popping through multiple levels", () => {
    const pr = makePR();
    let stack: Screen[] = [
      { name: "dashboard" },
      { name: "diffnav", pr },
      { name: "review-submit", pr, initialAction: "approve" },
    ];

    stack = popScreen(stack);
    expect(stack).toHaveLength(2);
    expect(currentScreen(stack).name).toBe("diffnav");

    stack = popScreen(stack);
    expect(stack).toHaveLength(1);
    expect(currentScreen(stack).name).toBe("dashboard");
  });

  it("should not mutate the original stack", () => {
    const pr = makePR();
    const stack: Screen[] = [{ name: "dashboard" }, { name: "diffnav", pr }];
    const result = popScreen(stack);

    expect(stack).toHaveLength(2);
    expect(result).toHaveLength(1);
  });
});

// ─── currentScreen ──────────────────────────────────────────────────────

describe("currentScreen", () => {
  it("should return the top screen from the stack", () => {
    const pr = makePR();
    const stack: Screen[] = [{ name: "dashboard" }, { name: "diffnav", pr }];
    const screen = currentScreen(stack);

    expect(screen.name).toBe("diffnav");
  });

  it("should return the root screen when stack has one item", () => {
    const stack: Screen[] = [{ name: "dashboard" }];
    const screen = currentScreen(stack);

    expect(screen.name).toBe("dashboard");
  });
});

// ─── isBackKey ──────────────────────────────────────────────────────────

describe("isBackKey", () => {
  it("should return true for Escape", () => {
    expect(isBackKey("escape")).toBe(true);
  });

  it("should return true for b", () => {
    expect(isBackKey("b")).toBe(true);
  });

  it("should return false for other keys", () => {
    expect(isBackKey("q")).toBe(false);
    expect(isBackKey("return")).toBe(false);
    expect(isBackKey("ArrowDown")).toBe(false);
    expect(isBackKey("a")).toBe(false);
  });
});
