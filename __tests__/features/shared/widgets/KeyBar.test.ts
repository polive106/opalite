import { describe, expect, it } from "bun:test";
import { formatKeyBindings, type KeyBinding } from "../../../../src/features/shared/widgets/KeyBar";

describe("formatKeyBindings", () => {
  it("should format a list of key bindings into display pairs", () => {
    const bindings: KeyBinding[] = [
      { key: "↑↓", label: "navigate" },
      { key: "⏎", label: "review" },
      { key: "r", label: "refresh" },
      { key: "q", label: "quit" },
    ];

    const result = formatKeyBindings(bindings);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ key: "↑↓", label: "navigate" });
    expect(result[1]).toEqual({ key: "⏎", label: "review" });
    expect(result[2]).toEqual({ key: "r", label: "refresh" });
    expect(result[3]).toEqual({ key: "q", label: "quit" });
  });

  it("should handle an empty list", () => {
    const result = formatKeyBindings([]);
    expect(result).toHaveLength(0);
  });

  it("should handle a single binding", () => {
    const bindings: KeyBinding[] = [{ key: "q", label: "quit" }];
    const result = formatKeyBindings(bindings);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: "q", label: "quit" });
  });
});
