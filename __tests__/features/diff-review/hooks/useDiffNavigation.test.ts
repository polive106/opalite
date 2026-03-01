import { describe, expect, it } from "bun:test";
import {
  handleDiffNavKey,
  type DiffNavState,
} from "../../../../src/features/diff-review/hooks/useDiffNavigation";

const FILE_COUNT = 5;

function makeState(overrides: Partial<DiffNavState> = {}): DiffNavState {
  return {
    focusPanel: "tree",
    selectedFileIndex: 0,
    viewMode: "split",
    ...overrides,
  };
}

describe("handleDiffNavKey", () => {
  // ─── Tab toggles focus between file tree and diff viewer ───

  it("should toggle focus from tree to diff on Tab", () => {
    const state = makeState({ focusPanel: "tree" });
    const action = handleDiffNavKey("tab", state, FILE_COUNT);

    expect(action.action).toBe("toggle-focus");
    if (action.action === "toggle-focus") {
      expect(action.panel).toBe("diff");
    }
  });

  it("should toggle focus from diff to tree on Tab", () => {
    const state = makeState({ focusPanel: "diff" });
    const action = handleDiffNavKey("tab", state, FILE_COUNT);

    expect(action.action).toBe("toggle-focus");
    if (action.action === "toggle-focus") {
      expect(action.panel).toBe("tree");
    }
  });

  // ─── Up/Down/j/k scrolls the focused panel ───

  it("should select next file when pressing ArrowDown with tree focus", () => {
    const state = makeState({ focusPanel: "tree", selectedFileIndex: 0 });
    const action = handleDiffNavKey("down", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(1);
    }
  });

  it("should select previous file when pressing ArrowUp with tree focus", () => {
    const state = makeState({ focusPanel: "tree", selectedFileIndex: 2 });
    const action = handleDiffNavKey("up", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(1);
    }
  });

  it("should clamp file selection at bottom boundary", () => {
    const state = makeState({ focusPanel: "tree", selectedFileIndex: 4 });
    const action = handleDiffNavKey("down", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(4);
    }
  });

  it("should clamp file selection at top boundary", () => {
    const state = makeState({ focusPanel: "tree", selectedFileIndex: 0 });
    const action = handleDiffNavKey("up", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(0);
    }
  });

  it("should support j/k vim keys for navigation", () => {
    const state = makeState({ focusPanel: "tree", selectedFileIndex: 1 });

    const downAction = handleDiffNavKey("j", state, FILE_COUNT);
    expect(downAction.action).toBe("select-file");
    if (downAction.action === "select-file") {
      expect(downAction.index).toBe(2);
    }

    const upAction = handleDiffNavKey("k", state, FILE_COUNT);
    expect(upAction.action).toBe("select-file");
    if (upAction.action === "select-file") {
      expect(upAction.index).toBe(0);
    }
  });

  it("should scroll diff when focus is on diff panel", () => {
    const state = makeState({ focusPanel: "diff" });

    const downAction = handleDiffNavKey("down", state, FILE_COUNT);
    expect(downAction.action).toBe("scroll-diff");
    if (downAction.action === "scroll-diff") {
      expect(downAction.direction).toBe("down");
    }

    const upAction = handleDiffNavKey("up", state, FILE_COUNT);
    expect(upAction.action).toBe("scroll-diff");
    if (upAction.action === "scroll-diff") {
      expect(upAction.direction).toBe("up");
    }
  });

  // ─── n/N jumps to next/previous changed file ───

  it("should jump to next file with n", () => {
    const state = makeState({ selectedFileIndex: 1 });
    const action = handleDiffNavKey("n", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(2);
    }
  });

  it("should jump to previous file with N", () => {
    const state = makeState({ selectedFileIndex: 2 });
    const action = handleDiffNavKey("N", state, FILE_COUNT);

    expect(action.action).toBe("select-file");
    if (action.action === "select-file") {
      expect(action.index).toBe(1);
    }
  });

  it("should clamp n at last file", () => {
    const state = makeState({ selectedFileIndex: 4 });
    const action = handleDiffNavKey("n", state, FILE_COUNT);

    if (action.action === "select-file") {
      expect(action.index).toBe(4);
    }
  });

  it("should clamp N at first file", () => {
    const state = makeState({ selectedFileIndex: 0 });
    const action = handleDiffNavKey("N", state, FILE_COUNT);

    if (action.action === "select-file") {
      expect(action.index).toBe(0);
    }
  });

  // ─── u toggles split/unified diff view ───

  it("should toggle from split to unified on u", () => {
    const state = makeState({ viewMode: "split" });
    const action = handleDiffNavKey("u", state, FILE_COUNT);

    expect(action.action).toBe("toggle-view-mode");
    if (action.action === "toggle-view-mode") {
      expect(action.mode).toBe("unified");
    }
  });

  it("should toggle from unified to split on u", () => {
    const state = makeState({ viewMode: "unified" });
    const action = handleDiffNavKey("u", state, FILE_COUNT);

    expect(action.action).toBe("toggle-view-mode");
    if (action.action === "toggle-view-mode") {
      expect(action.mode).toBe("split");
    }
  });

  // ─── Esc/b goes back ───

  it("should go back on Escape", () => {
    const state = makeState();
    const action = handleDiffNavKey("escape", state, FILE_COUNT);
    expect(action.action).toBe("back");
  });

  it("should go back on b", () => {
    const state = makeState();
    const action = handleDiffNavKey("b", state, FILE_COUNT);
    expect(action.action).toBe("back");
  });

  // ─── c opens comment editor ───

  it("should open comment editor on c when diff panel is focused", () => {
    const state = makeState({ focusPanel: "diff" });
    const action = handleDiffNavKey("c", state, FILE_COUNT);

    expect(action.action).toBe("open-comment-editor");
  });

  it("should open comment editor on c when tree panel is focused", () => {
    const state = makeState({ focusPanel: "tree" });
    const action = handleDiffNavKey("c", state, FILE_COUNT);

    expect(action.action).toBe("open-comment-editor");
  });

  // ─── r opens reply editor ───

  it("should open reply editor on r when diff panel is focused", () => {
    const state = makeState({ focusPanel: "diff" });
    const action = handleDiffNavKey("r", state, FILE_COUNT);

    expect(action.action).toBe("open-reply-editor");
  });

  it("should open reply editor on r when tree panel is focused", () => {
    const state = makeState({ focusPanel: "tree" });
    const action = handleDiffNavKey("r", state, FILE_COUNT);

    expect(action.action).toBe("open-reply-editor");
  });

  // ─── a approves ───

  it("should return approve action on a", () => {
    const state = makeState();
    const action = handleDiffNavKey("a", state, FILE_COUNT);
    expect(action.action).toBe("approve");
  });

  // ─── x requests changes ───

  it("should return request-changes action on x", () => {
    const state = makeState();
    const action = handleDiffNavKey("x", state, FILE_COUNT);
    expect(action.action).toBe("request-changes");
  });

  // ─── Unknown keys ───

  it("should return none for unrecognized keys", () => {
    const state = makeState();
    const action = handleDiffNavKey("z", state, FILE_COUNT);
    expect(action.action).toBe("none");
  });

  // ─── Empty file list edge case ───

  it("should handle empty file list", () => {
    const state = makeState({ selectedFileIndex: 0 });
    const action = handleDiffNavKey("down", state, 0);
    expect(action.action).toBe("none");
  });

  // ─── q quits ───

  it("should quit on q", () => {
    const state = makeState();
    const action = handleDiffNavKey("q", state, FILE_COUNT);
    expect(action.action).toBe("quit");
  });
});
