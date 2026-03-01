import { describe, expect, it, beforeEach, afterEach, spyOn, mock } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";

// We'll test the login command logic by testing its extracted functions
import {
  getLoginInstructions,
  validateAndLogin,
} from "../../../src/commands/login";
import type { AuthData } from "../../../src/services/auth";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-login-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("getLoginInstructions", () => {
  it("should include a link to the Atlassian API token page", () => {
    const instructions = getLoginInstructions();
    expect(instructions).toContain(
      "https://id.atlassian.com/manage-profile/security/api-tokens"
    );
  });

  it("should mention creating an API token", () => {
    const instructions = getLoginInstructions();
    expect(instructions).toContain("API token");
  });
});

describe("validateAndLogin", () => {
  it("should return an error if token does not start with ATAT", async () => {
    const result = await validateAndLogin("user@example.com", "bad-token", tempDir);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ATAT");
    }
  });

  it("should return an error if the API call fails", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await validateAndLogin(
      "user@example.com",
      "ATATbadtoken",
      tempDir
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("expired");
    }

    fetchSpy.mockRestore();
  });

  it("should return an error if the API returns a non-200 status", async () => {
    const mockResponse = new Response("Server Error", { status: 500 });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await validateAndLogin(
      "user@example.com",
      "ATATbadtoken",
      tempDir
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Failed to validate");
    }

    fetchSpy.mockRestore();
  });

  it("should save credentials and return user info on success", async () => {
    const authPath = join(tempDir, "auth.json");
    const mockUser = {
      display_name: "Jane Doe",
      username: "janedoe",
    };
    const mockResponse = new Response(JSON.stringify(mockUser), { status: 200 });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await validateAndLogin(
      "jane@example.com",
      "ATATvalidtoken123",
      authPath
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.displayName).toBe("Jane Doe");
      expect(result.username).toBe("janedoe");
    }

    // Verify the auth file was saved
    const saved = JSON.parse(await readFile(authPath, "utf-8"));
    expect(saved.email).toBe("jane@example.com");
    expect(saved.apiToken).toBe("ATATvalidtoken123");
    expect(saved.displayName).toBe("Jane Doe");
    expect(saved.username).toBe("janedoe");

    fetchSpy.mockRestore();
  });

  it("should return an error if fetch throws a network error", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await validateAndLogin(
      "user@example.com",
      "ATATtoken123",
      tempDir
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Network error");
    }

    fetchSpy.mockRestore();
  });
});
