import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { existsSync } from "fs";
import { runLogoutAction } from "../../../src/commands/logout";
import { loadAuthFile } from "../../../src/services/auth";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-logout-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("runLogoutAction", () => {
  it("should delete the auth file and return success", async () => {
    const authPath = join(tempDir, "auth.json");
    await writeFile(
      authPath,
      JSON.stringify({ email: "test@test.com", apiToken: "ATATtoken" })
    );

    const result = await runLogoutAction(authPath);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Logged out");
    expect(existsSync(authPath)).toBe(false);
  });

  it("should return success even if no auth file exists", async () => {
    const authPath = join(tempDir, "nonexistent.json");

    const result = await runLogoutAction(authPath);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Logged out");
  });
});
