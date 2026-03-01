import { describe, expect, it } from "bun:test";
import {
  formatPlaceholderScreen,
  PLACEHOLDER_KEY_BINDINGS,
} from "../../../../src/features/shared/widgets/PlaceholderScreen";

describe("formatPlaceholderScreen", () => {
  it("should format screen name with title case", () => {
    const result = formatPlaceholderScreen("diffnav");
    expect(result.title).toBe("Diff Nav");
  });

  it("should format hyphenated screen names", () => {
    const result = formatPlaceholderScreen("review-submit");
    expect(result.title).toBe("Review Submit");
  });

  it("should format my-prs screen name", () => {
    const result = formatPlaceholderScreen("my-prs");
    expect(result.title).toBe("My PRs");
  });

  it("should format comment-queue screen name", () => {
    const result = formatPlaceholderScreen("comment-queue");
    expect(result.title).toBe("Comment Queue");
  });

  it("should format agent-fix screen name", () => {
    const result = formatPlaceholderScreen("agent-fix");
    expect(result.title).toBe("Agent Fix");
  });

  it("should include a 'coming soon' subtitle", () => {
    const result = formatPlaceholderScreen("diffnav");
    expect(result.subtitle).toBe("Coming soon");
  });
});

describe("PLACEHOLDER_KEY_BINDINGS", () => {
  it("should include esc/b for back navigation", () => {
    expect(PLACEHOLDER_KEY_BINDINGS).toHaveLength(2);
    expect(PLACEHOLDER_KEY_BINDINGS[0].key).toBe("esc/b");
    expect(PLACEHOLDER_KEY_BINDINGS[0].label).toBe("back");
    expect(PLACEHOLDER_KEY_BINDINGS[1].key).toBe("q");
    expect(PLACEHOLDER_KEY_BINDINGS[1].label).toBe("quit");
  });
});
