/**
 * Feature-level functional integration test for the DiffNav screen.
 *
 * Pattern: Mock at the external boundary (globalThis.fetch), then exercise
 * the full pipeline as production code:
 *
 *   fetch mock (Bitbucket API responses)
 *     → fetchDiffStatFiles / fetchPRDiff (service — file stats + raw diff)
 *       → parseDiffToFiles (hook logic — parse raw diff into per-file chunks)
 *         → formatFileTreeEntry / formatDiffHeader (widget data transforms)
 *           → handleDiffNavKey (navigation state machine)
 *
 * Each test reads like a user scenario from the acceptance criteria.
 */

import { describe, expect, it, spyOn, beforeEach, afterEach } from "bun:test";
import {
  fetchDiffStatFiles,
  fetchPRDiff,
} from "../../../../src/services/bitbucket";
import { parseDiffToFiles } from "../../../../src/features/diff-review/hooks/useDiff";
import {
  handleDiffNavKey,
  type DiffNavState,
} from "../../../../src/features/diff-review/hooks/useDiffNavigation";
import {
  formatFileTreeEntry,
} from "../../../../src/features/diff-review/widgets/FileTree";
import {
  formatDiffHeader,
} from "../../../../src/features/diff-review/widgets/DiffHeader";
import { formatKeyBindings, type KeyBinding } from "../../../../src/features/shared/widgets/KeyBar";
import type { AuthData } from "../../../../src/services/auth";
import type { PR } from "../../../../src/types/review";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockAuth: AuthData = {
  email: "reviewer@company.com",
  apiToken: "ATATtoken123",
  displayName: "Reviewer",
  username: "reviewer",
};

const mockPR: PR = {
  id: 42,
  title: "Fix auth token refresh",
  description: "Fixes auth token refresh",
  sourceBranch: "feature/auth-fix",
  destinationBranch: "main",
  author: { displayName: "Alice Smith", nickname: "alice" },
  repo: "api",
  commentCount: 4,
  createdOn: new Date("2026-02-27T10:00:00Z"),
  updatedOn: new Date("2026-02-28T14:00:00Z"),
  filesChanged: 3,
  linesAdded: 45,
  linesRemoved: 12,
  url: "https://bitbucket.org/acme/api/pull-requests/42",
  participants: [],
};

const mockRawDiff = `diff --git a/src/auth.ts b/src/auth.ts
index abc1234..def5678 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,5 +1,6 @@
 import { join } from "path";
+import { homedir } from "os";

 export function getAuthPath() {
   return join(process.cwd(), ".auth");
diff --git a/src/login.ts b/src/login.ts
new file mode 100644
--- /dev/null
+++ b/src/login.ts
@@ -0,0 +1,5 @@
+export function login() {
+  console.log("logging in");
+  return true;
+}
diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -3,4 +3,4 @@
 export const config = {
-  timeout: 5000,
+  timeout: 10000,
 };
`;

const mockDiffStatResponse = {
  values: [
    {
      status: "modified",
      lines_added: 1,
      lines_removed: 0,
      old: { path: "src/auth.ts" },
      new: { path: "src/auth.ts" },
    },
    {
      status: "added",
      lines_added: 5,
      lines_removed: 0,
      old: null,
      new: { path: "src/login.ts" },
    },
    {
      status: "modified",
      lines_added: 1,
      lines_removed: 1,
      old: { path: "src/config.ts" },
      new: { path: "src/config.ts" },
    },
  ],
};

// ─── Functional integration tests ───────────────────────────────────────────

describe("DiffNav functional integration", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockBitbucketDiffAPI() {
    fetchSpy.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // Match diffstat endpoint
      if (url.includes("/diffstat")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockDiffStatResponse), { status: 200 })
        );
      }

      // Match diff endpoint (raw unified diff)
      if (url.includes("/diff")) {
        return Promise.resolve(new Response(mockRawDiff, { status: 200 }));
      }

      return Promise.resolve(new Response("Not Found", { status: 404 }));
    });
  }

  // ─── AC: "The file tree lists all changed files with their change counts" ─

  it("should fetch file stats and format file tree entries", async () => {
    mockBitbucketDiffAPI();

    // Step 1: Service fetches diffstat from Bitbucket API
    const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);

    expect(files).toHaveLength(3);
    expect(files[0].path).toBe("src/auth.ts");
    expect(files[1].path).toBe("src/login.ts");
    expect(files[2].path).toBe("src/config.ts");

    // Step 2: Widget formats file tree entries
    const entries = files.map((f) => formatFileTreeEntry(f));

    expect(entries[0].filename).toBe("auth.ts");
    expect(entries[0].statusIndicator).toBe("M");
    expect(entries[0].linesAdded).toBe(1);
    expect(entries[0].linesRemoved).toBe(0);

    expect(entries[1].filename).toBe("login.ts");
    expect(entries[1].statusIndicator).toBe("A");
    expect(entries[1].linesAdded).toBe(5);

    expect(entries[2].filename).toBe("config.ts");
    expect(entries[2].statusIndicator).toBe("M");
  });

  // ─── AC: "The diff viewer shows the selected file's changes" ──────────────

  it("should fetch raw diff and parse into per-file diffs", async () => {
    mockBitbucketDiffAPI();

    // Step 1: Service fetches raw diff
    const rawDiff = await fetchPRDiff(mockAuth, "acme", "api", 42);
    expect(rawDiff).toContain("diff --git");

    // Step 2: Hook parses into per-file chunks
    const fileDiffs = parseDiffToFiles(rawDiff);

    expect(fileDiffs).toHaveLength(3);
    expect(fileDiffs[0].path).toBe("src/auth.ts");
    expect(fileDiffs[0].content).toContain("+import { homedir }");

    expect(fileDiffs[1].path).toBe("src/login.ts");
    expect(fileDiffs[1].content).toContain("+export function login()");

    expect(fileDiffs[2].path).toBe("src/config.ts");
    expect(fileDiffs[2].content).toContain("+  timeout: 10000,");
  });

  // ─── AC: "PR title, author, branches, and age shown in header" ────────────

  it("should format PR header with title, author, branches, and age", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const header = formatDiffHeader(mockPR, now);

    expect(header.prNumber).toBe(42);
    expect(header.title).toBe("Fix auth token refresh");
    expect(header.author).toBe("alice");
    expect(header.sourceBranch).toBe("feature/auth-fix");
    expect(header.destinationBranch).toBe("main");
    expect(header.age).toBe("2d");
    expect(header.repo).toBe("api");
  });

  // ─── Full user session: open diff → browse files → navigate → toggle view ─

  describe("user session: reviewer browses PR diff", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    let state: DiffNavState;

    beforeEach(() => {
      state = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };
    });

    it("should start with first file selected in tree panel", async () => {
      mockBitbucketDiffAPI();

      const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);
      const rawDiff = await fetchPRDiff(mockAuth, "acme", "api", 42);
      const fileDiffs = parseDiffToFiles(rawDiff);

      // User sees auth.ts selected in file tree
      const entry = formatFileTreeEntry(files[state.selectedFileIndex]);
      expect(entry.filename).toBe("auth.ts");

      // Diff viewer shows auth.ts diff
      expect(fileDiffs[state.selectedFileIndex].content).toContain("+import { homedir }");
    });

    it("should navigate down through file tree with j/k", async () => {
      mockBitbucketDiffAPI();

      const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);
      const fileDiffs = parseDiffToFiles(rawDiff());

      // User presses j → selects login.ts
      let action = handleDiffNavKey("j", state, files.length);
      expect(action.action).toBe("select-file");
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        const entry = formatFileTreeEntry(files[state.selectedFileIndex]);
        expect(entry.filename).toBe("login.ts");
        expect(fileDiffs[state.selectedFileIndex].content).toContain("+export function login()");
      }

      // User presses ArrowDown → selects config.ts
      action = handleDiffNavKey("down", state, files.length);
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        const entry = formatFileTreeEntry(files[state.selectedFileIndex]);
        expect(entry.filename).toBe("config.ts");
      }

      // User presses k → back to login.ts
      action = handleDiffNavKey("k", state, files.length);
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        const entry = formatFileTreeEntry(files[state.selectedFileIndex]);
        expect(entry.filename).toBe("login.ts");
      }

      function rawDiff() { return mockRawDiff; }
    });

    // ─── AC: "Tab toggles focus between file tree and diff viewer" ──────

    it("should toggle focus between tree and diff panels", () => {
      // Start with tree focused
      expect(state.focusPanel).toBe("tree");

      // Press Tab → diff focused
      let action = handleDiffNavKey("tab", state, 3);
      expect(action.action).toBe("toggle-focus");
      if (action.action === "toggle-focus") {
        state = { ...state, focusPanel: action.panel };
        expect(state.focusPanel).toBe("diff");
      }

      // Press Tab again → tree focused
      action = handleDiffNavKey("tab", state, 3);
      if (action.action === "toggle-focus") {
        state = { ...state, focusPanel: action.panel };
        expect(state.focusPanel).toBe("tree");
      }
    });

    // ─── AC: "Up/Down scrolls diff when diff panel is focused" ──────────

    it("should scroll diff when focus is on diff panel", () => {
      state = { ...state, focusPanel: "diff" };

      const downAction = handleDiffNavKey("down", state, 3);
      expect(downAction.action).toBe("scroll-diff");
      if (downAction.action === "scroll-diff") {
        expect(downAction.direction).toBe("down");
      }

      const upAction = handleDiffNavKey("j", state, 3);
      expect(upAction.action).toBe("scroll-diff");
      if (upAction.action === "scroll-diff") {
        expect(upAction.direction).toBe("down");
      }
    });

    // ─── AC: "n/N jumps to next/previous changed file" ─────────────────

    it("should jump to next/previous file with n/N", async () => {
      mockBitbucketDiffAPI();
      const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);

      // At first file, press n → second file
      let action = handleDiffNavKey("n", state, files.length);
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        expect(formatFileTreeEntry(files[state.selectedFileIndex]).filename).toBe("login.ts");
      }

      // Press n again → third file
      action = handleDiffNavKey("n", state, files.length);
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        expect(formatFileTreeEntry(files[state.selectedFileIndex]).filename).toBe("config.ts");
      }

      // Press N → back to second file
      action = handleDiffNavKey("N", state, files.length);
      if (action.action === "select-file") {
        state = { ...state, selectedFileIndex: action.index };
        expect(formatFileTreeEntry(files[state.selectedFileIndex]).filename).toBe("login.ts");
      }
    });

    // ─── AC: "u toggles between split and unified diff view" ───────────

    it("should toggle view mode between split and unified", () => {
      expect(state.viewMode).toBe("split");

      let action = handleDiffNavKey("u", state, 3);
      if (action.action === "toggle-view-mode") {
        state = { ...state, viewMode: action.mode };
        expect(state.viewMode).toBe("unified");
      }

      action = handleDiffNavKey("u", state, 3);
      if (action.action === "toggle-view-mode") {
        state = { ...state, viewMode: action.mode };
        expect(state.viewMode).toBe("split");
      }
    });

    // ─── AC: "Esc or b goes back to the dashboard" ─────────────────────

    it("should go back on Escape or b", () => {
      const escAction = handleDiffNavKey("escape", state, 3);
      expect(escAction.action).toBe("back");

      const bAction = handleDiffNavKey("b", state, 3);
      expect(bAction.action).toBe("back");
    });
  });

  // ─── AC: "KeyBar shows DiffNav-specific bindings" ─────────────────────────

  it("should show DiffNav key bindings", () => {
    const diffNavBindings: KeyBinding[] = [
      { key: "↑↓", label: "navigate" },
      { key: "tab", label: "switch panel" },
      { key: "n/N", label: "next/prev file" },
      { key: "u", label: "split/unified" },
      { key: "b", label: "back" },
      { key: "q", label: "quit" },
    ];

    const formatted = formatKeyBindings(diffNavBindings);
    expect(formatted).toHaveLength(6);
    expect(formatted[1].key).toBe("tab");
    expect(formatted[1].label).toBe("switch panel");
    expect(formatted[3].key).toBe("u");
    expect(formatted[3].label).toBe("split/unified");
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle PR with no changed files", async () => {
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/diffstat")) {
          return Promise.resolve(
            new Response(JSON.stringify({ values: [] }), { status: 200 })
          );
        }
        if (url.includes("/diff")) {
          return Promise.resolve(new Response("", { status: 200 }));
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });

      const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);
      const rawDiff = await fetchPRDiff(mockAuth, "acme", "api", 42);
      const fileDiffs = parseDiffToFiles(rawDiff);

      expect(files).toHaveLength(0);
      expect(fileDiffs).toHaveLength(0);

      // Navigation on empty list returns none
      const state: DiffNavState = {
        focusPanel: "tree",
        selectedFileIndex: 0,
        viewMode: "split",
      };
      expect(handleDiffNavKey("down", state, 0).action).toBe("none");
      expect(handleDiffNavKey("n", state, 0).action).toBe("none");
      // But back still works
      expect(handleDiffNavKey("escape", state, 0).action).toBe("back");
    });

    it("should handle API failure gracefully", async () => {
      fetchSpy.mockResolvedValue(new Response("Error", { status: 500 }));

      const files = await fetchDiffStatFiles(mockAuth, "acme", "api", 42);
      const rawDiff = await fetchPRDiff(mockAuth, "acme", "api", 42);

      expect(files).toHaveLength(0);
      expect(rawDiff).toBe("");
    });
  });
});
