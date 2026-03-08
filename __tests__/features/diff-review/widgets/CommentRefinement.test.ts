import { describe, expect, it } from "bun:test";
import {
  formatRefinementHeader,
  formatRefinementKeyBar,
} from "../../../../src/features/diff-review/widgets/CommentRefinement";

describe("formatRefinementHeader", () => {
  it("should format header with file path and line number", () => {
    const header = formatRefinementHeader("src/services/auth.ts", 42);

    expect(header).toBe("Comment on src/services/auth.ts:42");
  });

  it("should format header with file path only", () => {
    const header = formatRefinementHeader("src/services/auth.ts");

    expect(header).toBe("Comment on src/services/auth.ts");
  });

  it("should format header with no file path", () => {
    const header = formatRefinementHeader();

    expect(header).toBe("Comment refinement");
  });
});

describe("formatRefinementKeyBar", () => {
  it("should return suggestion keybindings for suggestion state", () => {
    const bindings = formatRefinementKeyBar("suggestion");

    expect(bindings).toHaveLength(4);
    expect(bindings[0]).toEqual({ key: "a", label: "accept" });
    expect(bindings[1]).toEqual({ key: "s", label: "skip" });
    expect(bindings[2]).toEqual({ key: "e", label: "edit" });
    expect(bindings[3]).toEqual({ key: "r", label: "reject+feedback" });
  });

  it("should return loading keybindings for loading state", () => {
    const bindings = formatRefinementKeyBar("loading");

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual({ key: "Esc", label: "cancel" });
  });

  it("should return error keybindings for error state", () => {
    const bindings = formatRefinementKeyBar("error");

    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toEqual({ key: "s", label: "post original" });
    expect(bindings[1]).toEqual({ key: "Esc", label: "cancel" });
  });

  it("should return feedback keybindings for feedback state", () => {
    const bindings = formatRefinementKeyBar("feedback");

    expect(bindings).toHaveLength(2);
    expect(bindings[0]).toEqual({ key: "Enter", label: "send" });
    expect(bindings[1]).toEqual({ key: "Esc", label: "cancel" });
  });
});
