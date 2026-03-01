import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { checkAuth } from "../../../src/commands/authGuard";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-guard-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("checkAuth", () => {
  it("should return authenticated=true when auth file exists with valid data", async () => {
    const authPath = join(tempDir, "auth.json");
    await writeFile(
      authPath,
      JSON.stringify({
        email: "user@example.com",
        apiToken: "ATATtoken123",
        displayName: "Test User",
        username: "testuser",
      })
    );

    const result = await checkAuth(authPath);
    expect(result.authenticated).toBe(true);
  });

  it("should return authenticated=false when auth file does not exist", async () => {
    const authPath = join(tempDir, "nonexistent.json");

    const result = await checkAuth(authPath);
    expect(result.authenticated).toBe(false);
    if (!result.authenticated) {
      expect(result.message).toContain("opalite login");
    }
  });

  it("should return authenticated=false for corrupted auth file", async () => {
    const authPath = join(tempDir, "auth.json");
    await writeFile(authPath, "not-json");

    const result = await checkAuth(authPath);
    expect(result.authenticated).toBe(false);
  });
});
