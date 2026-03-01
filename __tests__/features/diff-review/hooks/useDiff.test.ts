import { describe, expect, it } from "bun:test";
import {
  parseDiffToFiles,
  type DiffFileContent,
} from "../../../../src/features/diff-review/hooks/useDiff";

describe("parseDiffToFiles", () => {
  it("should parse a single-file unified diff", () => {
    const rawDiff = `diff --git a/src/auth.ts b/src/auth.ts
index abc1234..def5678 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 import { join } from "path";
+import { homedir } from "os";

 export function getAuthPath() {
`;

    const files = parseDiffToFiles(rawDiff);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/auth.ts");
    expect(files[0].content).toContain("import { homedir }");
  });

  it("should parse a multi-file unified diff", () => {
    const rawDiff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 import { join } from "path";
+import { homedir } from "os";

 export function getAuthPath() {
diff --git a/src/login.ts b/src/login.ts
new file mode 100644
--- /dev/null
+++ b/src/login.ts
@@ -0,0 +1,5 @@
+export function login() {
+  console.log("logging in");
+}
`;

    const files = parseDiffToFiles(rawDiff);

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("src/auth.ts");
    expect(files[1].path).toBe("src/login.ts");
  });

  it("should handle renamed files using new path", () => {
    const rawDiff = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 95%
rename from src/old-name.ts
rename to src/new-name.ts
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,3 +1,3 @@
-export const name = "old";
+export const name = "new";
`;

    const files = parseDiffToFiles(rawDiff);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/new-name.ts");
  });

  it("should return empty array for empty diff", () => {
    expect(parseDiffToFiles("")).toHaveLength(0);
    expect(parseDiffToFiles("   ")).toHaveLength(0);
  });

  it("should preserve full diff content per file", () => {
    const rawDiff = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
-const a = 1;
+const a = 2;
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,2 @@
-const b = 1;
+const b = 2;
`;

    const files = parseDiffToFiles(rawDiff);

    expect(files[0].content).toContain("-const a = 1;");
    expect(files[0].content).toContain("+const a = 2;");
    expect(files[0].content).not.toContain("const b");

    expect(files[1].content).toContain("-const b = 1;");
    expect(files[1].content).toContain("+const b = 2;");
    expect(files[1].content).not.toContain("const a");
  });
});
