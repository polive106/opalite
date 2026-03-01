import { describe, expect, it } from "bun:test";
import {
  handleRepoSelectKey,
  type RepoSelectState,
} from "../../../../src/features/init/hooks/useRepoSelect";

function makeState(overrides: Partial<RepoSelectState> = {}): RepoSelectState {
  return {
    cursor: 0,
    selected: new Set(),
    ...overrides,
  };
}

describe("handleRepoSelectKey", () => {
  const totalRepos = 5;

  describe("navigation", () => {
    it("should move cursor down on ArrowDown", () => {
      const result = handleRepoSelectKey("down", makeState({ cursor: 0 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(1);
      }
    });

    it("should move cursor down on j", () => {
      const result = handleRepoSelectKey("j", makeState({ cursor: 2 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(3);
      }
    });

    it("should not move cursor below last item", () => {
      const result = handleRepoSelectKey("down", makeState({ cursor: 4 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(4);
      }
    });

    it("should move cursor up on ArrowUp", () => {
      const result = handleRepoSelectKey("up", makeState({ cursor: 3 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(2);
      }
    });

    it("should move cursor up on k", () => {
      const result = handleRepoSelectKey("k", makeState({ cursor: 2 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(1);
      }
    });

    it("should not move cursor above first item", () => {
      const result = handleRepoSelectKey("up", makeState({ cursor: 0 }), totalRepos);
      expect(result.action).toBe("move");
      if (result.action === "move") {
        expect(result.cursor).toBe(0);
      }
    });
  });

  describe("selection toggle", () => {
    it("should select item on space", () => {
      const result = handleRepoSelectKey("space", makeState({ cursor: 2 }), totalRepos);
      expect(result.action).toBe("toggle");
      if (result.action === "toggle") {
        expect(result.selected.has(2)).toBe(true);
        expect(result.selected.size).toBe(1);
      }
    });

    it("should deselect item on space if already selected", () => {
      const state = makeState({ cursor: 2, selected: new Set([2, 3]) });
      const result = handleRepoSelectKey("space", state, totalRepos);
      expect(result.action).toBe("toggle");
      if (result.action === "toggle") {
        expect(result.selected.has(2)).toBe(false);
        expect(result.selected.has(3)).toBe(true);
        expect(result.selected.size).toBe(1);
      }
    });
  });

  describe("toggle all", () => {
    it("should select all on 'a' when none selected", () => {
      const result = handleRepoSelectKey("a", makeState(), totalRepos);
      expect(result.action).toBe("toggle-all");
      if (result.action === "toggle-all") {
        expect(result.selected.size).toBe(5);
        for (let i = 0; i < 5; i++) {
          expect(result.selected.has(i)).toBe(true);
        }
      }
    });

    it("should select all on 'a' when some selected", () => {
      const state = makeState({ selected: new Set([1, 3]) });
      const result = handleRepoSelectKey("a", state, totalRepos);
      expect(result.action).toBe("toggle-all");
      if (result.action === "toggle-all") {
        expect(result.selected.size).toBe(5);
      }
    });

    it("should deselect all on 'a' when all selected", () => {
      const state = makeState({ selected: new Set([0, 1, 2, 3, 4]) });
      const result = handleRepoSelectKey("a", state, totalRepos);
      expect(result.action).toBe("toggle-all");
      if (result.action === "toggle-all") {
        expect(result.selected.size).toBe(0);
      }
    });
  });

  describe("confirm", () => {
    it("should confirm with sorted indices when items selected", () => {
      const state = makeState({ selected: new Set([3, 1, 4]) });
      const result = handleRepoSelectKey("return", state, totalRepos);
      expect(result.action).toBe("confirm");
      if (result.action === "confirm") {
        expect(result.selectedIndices).toEqual([1, 3, 4]);
      }
    });

    it("should not confirm when no items selected", () => {
      const result = handleRepoSelectKey("return", makeState(), totalRepos);
      expect(result.action).toBe("none");
    });
  });

  describe("unknown keys", () => {
    it("should return none for unrecognized keys", () => {
      const result = handleRepoSelectKey("x", makeState(), totalRepos);
      expect(result.action).toBe("none");
    });
  });
});
