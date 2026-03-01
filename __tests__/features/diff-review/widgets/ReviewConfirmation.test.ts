import { describe, expect, it } from "bun:test";
import {
  formatReviewTitle,
  formatReviewStatus,
  formatActionLabel,
  REVIEW_ACTION_OPTIONS,
} from "../../../../src/features/diff-review/widgets/ReviewConfirmation";

describe("formatReviewTitle", () => {
  it("should format title for approve action", () => {
    const title = formatReviewTitle("approve", "Fix auth flow", 42);

    expect(title).toBe("Submit Review — PR #42: Fix auth flow");
  });

  it("should format title for request-changes action", () => {
    const title = formatReviewTitle("request-changes", "Add caching", 10);

    expect(title).toBe("Submit Review — PR #10: Add caching");
  });

  it("should format title for comment action", () => {
    const title = formatReviewTitle("comment", "Refactor utils", 5);

    expect(title).toBe("Submit Review — PR #5: Refactor utils");
  });

  it("should truncate long PR titles", () => {
    const longTitle = "A".repeat(60);
    const title = formatReviewTitle("approve", longTitle, 1);

    expect(title.length).toBeLessThanOrEqual(80);
    expect(title).toContain("...");
  });
});

describe("formatActionLabel", () => {
  it("should return Approve for approve", () => {
    expect(formatActionLabel("approve")).toBe("Approve");
  });

  it("should return Request Changes for request-changes", () => {
    expect(formatActionLabel("request-changes")).toBe("Request Changes");
  });

  it("should return Comment for comment", () => {
    expect(formatActionLabel("comment")).toBe("Comment");
  });
});

describe("REVIEW_ACTION_OPTIONS", () => {
  it("should have three options", () => {
    expect(REVIEW_ACTION_OPTIONS).toHaveLength(3);
  });

  it("should contain approve, request-changes, and comment values", () => {
    const values = REVIEW_ACTION_OPTIONS.map((o) => o.value);
    expect(values).toContain("approve");
    expect(values).toContain("request-changes");
    expect(values).toContain("comment");
  });

  it("should have display labels for each option", () => {
    for (const option of REVIEW_ACTION_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

describe("formatReviewStatus", () => {
  it("should show submit/cancel hints when idle", () => {
    const status = formatReviewStatus(false, null);

    expect(status.text).toBe("Enter submit · Esc cancel");
    expect(status.isError).toBe(false);
  });

  it("should show submitting indicator", () => {
    const status = formatReviewStatus(true, null);

    expect(status.text).toBe("Submitting...");
    expect(status.isError).toBe(false);
  });

  it("should show error with retry hint", () => {
    const status = formatReviewStatus(false, "Network error");

    expect(status.text).toBe("Network error · Enter retry · Esc cancel");
    expect(status.isError).toBe(true);
  });
});
