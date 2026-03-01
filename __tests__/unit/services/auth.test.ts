import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import {
  loadAuthFile,
  saveAuthFile,
  deleteAuthFile,
  getAuthHeader,
  bbFetch,
  validateTokenFormat,
  type AuthData,
} from "../../../src/services/auth";

// Use a temp directory for auth file tests to avoid touching real config
let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("validateTokenFormat", () => {
  it("should return true for tokens starting with ATAT", () => {
    expect(validateTokenFormat("ATATsomething123")).toBe(true);
  });

  it("should return false for tokens not starting with ATAT", () => {
    expect(validateTokenFormat("invalid-token")).toBe(false);
    expect(validateTokenFormat("")).toBe(false);
    expect(validateTokenFormat("atat-lowercase")).toBe(false);
  });
});

describe("getAuthHeader", () => {
  it("should return a Basic auth header from email and token", () => {
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };
    const header = getAuthHeader(auth);
    const expected = `Basic ${btoa("user@example.com:ATATtoken123")}`;
    expect(header).toBe(expected);
  });
});

describe("saveAuthFile", () => {
  it("should save auth data as JSON to the specified path", async () => {
    const authPath = join(tempDir, "auth.json");
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };

    await saveAuthFile(auth, authPath);

    const content = await readFile(authPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.apiToken).toBe("ATATtoken123");
    expect(parsed.displayName).toBe("Test User");
    expect(parsed.username).toBe("testuser");
  });

  it("should create parent directories if they don't exist", async () => {
    const authPath = join(tempDir, "nested", "dir", "auth.json");
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };

    await saveAuthFile(auth, authPath);

    const content = await readFile(authPath, "utf-8");
    expect(JSON.parse(content).email).toBe("user@example.com");
  });
});

describe("loadAuthFile", () => {
  it("should load auth data from a JSON file", async () => {
    const authPath = join(tempDir, "auth.json");
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };
    await writeFile(authPath, JSON.stringify(auth));

    const loaded = await loadAuthFile(authPath);
    expect(loaded).not.toBeNull();
    expect(loaded!.email).toBe("user@example.com");
    expect(loaded!.apiToken).toBe("ATATtoken123");
    expect(loaded!.displayName).toBe("Test User");
    expect(loaded!.username).toBe("testuser");
  });

  it("should return null if the file does not exist", async () => {
    const authPath = join(tempDir, "nonexistent.json");
    const loaded = await loadAuthFile(authPath);
    expect(loaded).toBeNull();
  });
});

describe("deleteAuthFile", () => {
  it("should delete the auth file", async () => {
    const authPath = join(tempDir, "auth.json");
    await writeFile(authPath, JSON.stringify({ email: "test@test.com" }));

    await deleteAuthFile(authPath);

    const loaded = await loadAuthFile(authPath);
    expect(loaded).toBeNull();
  });

  it("should not throw if the file does not exist", async () => {
    const authPath = join(tempDir, "nonexistent.json");
    expect(async () => await deleteAuthFile(authPath)).not.toThrow();
  });
});

describe("bbFetch", () => {
  it("should call fetch with Basic auth header and correct URL", async () => {
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };

    const mockResponse = new Response(JSON.stringify({ username: "testuser" }), {
      status: 200,
    });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const response = await bbFetch("/2.0/user", auth);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.bitbucket.org/2.0/user");
    expect((options as RequestInit).headers).toEqual({
      Authorization: getAuthHeader(auth),
      "Content-Type": "application/json",
    });
    expect(response.status).toBe(200);

    fetchSpy.mockRestore();
  });

  it("should throw with expired token message on 401 response", async () => {
    const auth: AuthData = {
      email: "user@example.com",
      apiToken: "ATATtoken123",
      displayName: "Test User",
      username: "testuser",
    };

    const mockResponse = new Response("Unauthorized", { status: 401 });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    try {
      await bbFetch("/2.0/user", auth);
      expect(true).toBe(false); // should not reach here
    } catch (error) {
      expect((error as Error).message).toBe(
        "Your API token has expired. Run `opalite login` to add a new one."
      );
    }

    fetchSpy.mockRestore();
  });
});
