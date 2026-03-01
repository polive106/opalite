import { describe, expect, it } from "bun:test";
import { formatFileTreeEntry } from "../../../../src/features/diff-review/widgets/FileTree";
import type { DiffStatFile } from "../../../../src/services/bitbucket";

describe("formatFileTreeEntry", () => {
  it("should format a modified file with add/remove counts", () => {
    const file: DiffStatFile = {
      path: "src/services/auth.ts",
      status: "modified",
      linesAdded: 10,
      linesRemoved: 5,
    };

    const entry = formatFileTreeEntry(file);

    expect(entry.filename).toBe("auth.ts");
    expect(entry.directory).toBe("src/services/");
    expect(entry.linesAdded).toBe(10);
    expect(entry.linesRemoved).toBe(5);
    expect(entry.statusIndicator).toBe("M");
  });

  it("should format an added file", () => {
    const file: DiffStatFile = {
      path: "src/login.ts",
      status: "added",
      linesAdded: 30,
      linesRemoved: 0,
    };

    const entry = formatFileTreeEntry(file);

    expect(entry.filename).toBe("login.ts");
    expect(entry.directory).toBe("src/");
    expect(entry.statusIndicator).toBe("A");
  });

  it("should format a removed file", () => {
    const file: DiffStatFile = {
      path: "src/old.ts",
      status: "removed",
      linesAdded: 0,
      linesRemoved: 20,
    };

    const entry = formatFileTreeEntry(file);

    expect(entry.filename).toBe("old.ts");
    expect(entry.statusIndicator).toBe("D");
  });

  it("should format a renamed file", () => {
    const file: DiffStatFile = {
      path: "src/new-name.ts",
      status: "renamed",
      linesAdded: 2,
      linesRemoved: 2,
    };

    const entry = formatFileTreeEntry(file);

    expect(entry.statusIndicator).toBe("R");
  });

  it("should handle a file in the root directory", () => {
    const file: DiffStatFile = {
      path: "README.md",
      status: "modified",
      linesAdded: 5,
      linesRemoved: 1,
    };

    const entry = formatFileTreeEntry(file);

    expect(entry.filename).toBe("README.md");
    expect(entry.directory).toBe("");
  });
});
