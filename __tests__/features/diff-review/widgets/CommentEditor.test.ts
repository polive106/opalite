import { describe, expect, it } from "bun:test";
import {
  formatEditorHeader,
  formatEditorStatus,
} from "../../../../src/features/diff-review/widgets/CommentEditor";

describe("formatEditorHeader", () => {
  it("should format header for inline comment", () => {
    const header = formatEditorHeader("inline", "src/auth.ts", 45);

    expect(header).toBe("Comment on src/auth.ts:45");
  });

  it("should format header for reply", () => {
    const header = formatEditorHeader("reply");

    expect(header).toBe("Reply to comment");
  });

  it("should format header for inline comment without line number", () => {
    const header = formatEditorHeader("inline", "src/auth.ts");

    expect(header).toBe("Comment on src/auth.ts");
  });
});

describe("formatEditorStatus", () => {
  it("should show submit hint when not submitting and no error", () => {
    const status = formatEditorStatus(false, null);

    expect(status.text).toBe("Enter submit · Esc cancel");
    expect(status.isError).toBe(false);
  });

  it("should show submitting indicator", () => {
    const status = formatEditorStatus(true, null);

    expect(status.text).toBe("Posting...");
    expect(status.isError).toBe(false);
  });

  it("should show error message", () => {
    const status = formatEditorStatus(false, "Network error");

    expect(status.text).toBe("Network error · Enter retry · Esc cancel");
    expect(status.isError).toBe(true);
  });
});
