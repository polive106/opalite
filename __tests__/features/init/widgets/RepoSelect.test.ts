import { describe, expect, it } from "bun:test";
import {
  formatRepoRow,
  formatSelectionStatus,
} from "../../../../src/features/init/ui/RepoSelect";
import { theme } from "../../../../src/theme/tokyo-night";
import type { Repository } from "../../../../src/commands/init";

function makeRepo(slug: string, name: string): Repository {
  return { slug, name };
}

describe("formatRepoRow", () => {
  const repo = makeRepo("api-service", "API Service");

  it("should show unchecked checkbox when not selected", () => {
    const data = formatRepoRow(repo, false, false);
    expect(data.checkText).toBe("[ ]");
    expect(data.checkColor).toBe(theme.dimmed);
  });

  it("should show checked checkbox when selected", () => {
    const data = formatRepoRow(repo, false, true);
    expect(data.checkText).toBe("[x]");
    expect(data.checkColor).toBe(theme.green);
  });

  it("should highlight name when cursor is on item", () => {
    const data = formatRepoRow(repo, true, false);
    expect(data.nameColor).toBe(theme.accent);
    expect(data.bgColor).toBe(theme.selection);
  });

  it("should use default colors when cursor is not on item", () => {
    const data = formatRepoRow(repo, false, false);
    expect(data.nameColor).toBe(theme.fg);
    expect(data.bgColor).toBe(theme.bg);
  });

  it("should include repo name and slug", () => {
    const data = formatRepoRow(repo, false, false);
    expect(data.name).toBe("API Service");
    expect(data.slug).toBe("api-service");
  });

  it("should combine cursor highlight with selected checkbox", () => {
    const data = formatRepoRow(repo, true, true);
    expect(data.checkText).toBe("[x]");
    expect(data.checkColor).toBe(theme.green);
    expect(data.nameColor).toBe(theme.accent);
    expect(data.bgColor).toBe(theme.selection);
  });
});

describe("formatSelectionStatus", () => {
  it("should show count with hint when none selected", () => {
    const status = formatSelectionStatus(0, 10);
    expect(status).toBe("0 of 10 selected — select at least one to continue");
  });

  it("should show count without hint when some selected", () => {
    const status = formatSelectionStatus(3, 10);
    expect(status).toBe("3 of 10 selected");
  });

  it("should show count when all selected", () => {
    const status = formatSelectionStatus(10, 10);
    expect(status).toBe("10 of 10 selected");
  });
});
