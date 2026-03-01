/**
 * Integration test for screen routing.
 *
 * Tests the full routing pipeline:
 *   dashboard key handler → screen stack management → back navigation
 *
 * Pattern: exercise multiple layers together without mocking intermediaries.
 *   1. handleDashboardKey detects Enter/m → returns navigate action
 *   2. pushScreen adds the target to the stack
 *   3. isBackKey detects Esc/b → triggers popScreen
 *   4. popScreen returns to the previous screen
 *   5. On dashboard, q triggers quit (no back)
 */

import { describe, expect, it } from "bun:test";
import type { PR } from "../../../../src/types/review";
import type { Screen } from "../../../../src/App";
import {
  pushScreen,
  popScreen,
  currentScreen,
  isBackKey,
} from "../../../../src/features/shared/hooks/useScreenStack";
import {
  handleDashboardKey,
  type DashboardNavigationState,
} from "../../../../src/features/dashboard/hooks/useDashboardNavigation";
import {
  formatPlaceholderScreen,
  PLACEHOLDER_KEY_BINDINGS,
} from "../../../../src/features/shared/widgets/PlaceholderScreen";

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

describe("Screen routing integration", () => {
  // ─── AC: "App.tsx manages a screen stack using React state" ───────────

  it("should start with dashboard as the root screen", () => {
    const stack: Screen[] = [{ name: "dashboard" }];
    expect(currentScreen(stack).name).toBe("dashboard");
    expect(stack).toHaveLength(1);
  });

  // ─── AC: "Navigating to a new screen pushes it onto the stack" ────────

  it("should push diffnav onto stack when user presses Enter on a PR", () => {
    const prs = [makePR({ id: 1 }), makePR({ id: 2 })];
    const state: DashboardNavigationState = { selectedIndex: 0 };

    // Dashboard key handler returns navigate action
    const action = handleDashboardKey("Enter", state, prs);
    expect(action.action).toBe("navigate");

    if (action.action === "navigate") {
      // App pushes the new screen onto the stack
      let stack: Screen[] = [{ name: "dashboard" }];
      stack = pushScreen(stack, { name: "diffnav", pr: action.pr });

      expect(stack).toHaveLength(2);
      expect(currentScreen(stack).name).toBe("diffnav");
      const current = currentScreen(stack);
      if (current.name === "diffnav") {
        expect(current.pr.id).toBe(1);
      }
    }
  });

  it("should push my-prs onto stack when user presses m", () => {
    const prs = [makePR()];
    const state: DashboardNavigationState = { selectedIndex: 0 };

    const action = handleDashboardKey("m", state, prs);
    expect(action.action).toBe("my-prs");

    let stack: Screen[] = [{ name: "dashboard" }];
    stack = pushScreen(stack, { name: "my-prs" });

    expect(stack).toHaveLength(2);
    expect(currentScreen(stack).name).toBe("my-prs");
  });

  // ─── AC: "Esc or b goes back to the previous screen" ─────────────────

  it("should go back to dashboard when Esc is pressed on diffnav", () => {
    const pr = makePR();
    let stack: Screen[] = [{ name: "dashboard" }, { name: "diffnav", pr }];

    // Esc is a back key
    expect(isBackKey("Escape")).toBe(true);

    // Pop returns to dashboard
    stack = popScreen(stack);
    expect(stack).toHaveLength(1);
    expect(currentScreen(stack).name).toBe("dashboard");
  });

  it("should go back to dashboard when b is pressed on my-prs", () => {
    let stack: Screen[] = [{ name: "dashboard" }, { name: "my-prs" }];

    expect(isBackKey("b")).toBe(true);

    stack = popScreen(stack);
    expect(currentScreen(stack).name).toBe("dashboard");
  });

  it("should navigate back through multiple levels", () => {
    const pr = makePR();
    let stack: Screen[] = [
      { name: "dashboard" },
      { name: "diffnav", pr },
      { name: "review-submit", pr },
    ];

    // Back from review-submit → diffnav
    expect(isBackKey("Escape")).toBe(true);
    stack = popScreen(stack);
    expect(currentScreen(stack).name).toBe("diffnav");

    // Back from diffnav → dashboard
    stack = popScreen(stack);
    expect(currentScreen(stack).name).toBe("dashboard");
  });

  // ─── AC: "q from the dashboard quits the app" ────────────────────────

  it("should return quit action when q is pressed on dashboard", () => {
    const prs = [makePR()];
    const state: DashboardNavigationState = { selectedIndex: 0 };
    const action = handleDashboardKey("q", state, prs);
    expect(action.action).toBe("quit");
  });

  // ─── AC: "Screen transitions are instant (no loading flash)" ─────────

  it("should show placeholder screen data instantly for unimplemented screens", () => {
    const screens = ["diffnav", "review-submit", "my-prs", "comment-queue", "agent-fix"];

    for (const screenName of screens) {
      const data = formatPlaceholderScreen(screenName);
      // Each screen has a title and subtitle — no async loading required
      expect(data.title.length).toBeGreaterThan(0);
      expect(data.subtitle).toBe("Coming soon");
    }
  });

  // ─── Back navigation does NOT pop below the root screen ──────────────

  it("should not pop below dashboard (root screen)", () => {
    let stack: Screen[] = [{ name: "dashboard" }];

    // Trying to go back from dashboard should stay on dashboard
    stack = popScreen(stack);
    expect(stack).toHaveLength(1);
    expect(currentScreen(stack).name).toBe("dashboard");
  });

  // ─── Full user session: dashboard → diffnav → back → my-prs → back ──

  describe("full routing session", () => {
    it("should support navigating to different screens and back", () => {
      const prs = [
        makePR({ id: 1, title: "Fix auth" }),
        makePR({ id: 2, title: "Add tests" }),
      ];

      // Start on dashboard
      let stack: Screen[] = [{ name: "dashboard" }];
      expect(currentScreen(stack).name).toBe("dashboard");

      // User selects PR #1 and presses Enter → goes to diffnav
      const navState: DashboardNavigationState = { selectedIndex: 0 };
      const enterAction = handleDashboardKey("Enter", navState, prs);
      expect(enterAction.action).toBe("navigate");
      if (enterAction.action === "navigate") {
        stack = pushScreen(stack, { name: "diffnav", pr: enterAction.pr });
      }
      expect(currentScreen(stack).name).toBe("diffnav");
      expect(stack).toHaveLength(2);

      // Placeholder screen shows correct data
      const diffnavData = formatPlaceholderScreen("diffnav");
      expect(diffnavData.title).toBe("Diff Nav");

      // User presses Escape → back to dashboard
      expect(isBackKey("Escape")).toBe(true);
      stack = popScreen(stack);
      expect(currentScreen(stack).name).toBe("dashboard");
      expect(stack).toHaveLength(1);

      // User presses m → goes to my-prs
      const mAction = handleDashboardKey("m", navState, prs);
      expect(mAction.action).toBe("my-prs");
      stack = pushScreen(stack, { name: "my-prs" });
      expect(currentScreen(stack).name).toBe("my-prs");

      // User presses b → back to dashboard
      expect(isBackKey("b")).toBe(true);
      stack = popScreen(stack);
      expect(currentScreen(stack).name).toBe("dashboard");
    });
  });

  // ─── Placeholder screens show back key binding ────────────────────────

  it("should show esc/b back binding on placeholder screens", () => {
    expect(PLACEHOLDER_KEY_BINDINGS[0].key).toBe("esc/b");
    expect(PLACEHOLDER_KEY_BINDINGS[0].label).toBe("back");
  });
});
