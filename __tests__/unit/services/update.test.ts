import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { checkForUpdate, type UpdateCheckResult } from "../../../src/services/update";

describe("checkForUpdate", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
  });

  it("should return updateAvailable=true when a newer version exists", async () => {
    const mockRelease = { tag_name: "v1.0.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).not.toBeNull();
    expect(result!.updateAvailable).toBe(true);
    expect(result!.latestVersion).toBe("1.0.0");
    expect(result!.currentVersion).toBe("0.1.0");
  });

  it("should return updateAvailable=false when already on the latest version", async () => {
    const mockRelease = { tag_name: "v0.1.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).not.toBeNull();
    expect(result!.updateAvailable).toBe(false);
    expect(result!.latestVersion).toBe("0.1.0");
  });

  it("should return updateAvailable=false when current version is ahead", async () => {
    const mockRelease = { tag_name: "v0.0.9" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).not.toBeNull();
    expect(result!.updateAvailable).toBe(false);
  });

  it("should return null when fetch fails (network error)", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).toBeNull();
  });

  it("should return null when API returns non-200 status", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Rate Limited", { status: 403 })
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).toBeNull();
  });

  it("should return null when request times out", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new DOMException("The operation was aborted", "AbortError")
    );

    const result = await checkForUpdate("0.1.0");

    expect(result).toBeNull();
  });

  it("should call fetch with the correct GitHub releases URL", async () => {
    const mockRelease = { tag_name: "v0.1.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    await checkForUpdate("0.1.0");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/repos/");
    expect(url).toContain("/releases/latest");
    expect((options as RequestInit).signal).toBeDefined();
  });

  it("should strip 'v' prefix from tag_name when comparing versions", async () => {
    const mockRelease = { tag_name: "v2.0.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("1.0.0");

    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe("2.0.0");
    expect(result!.updateAvailable).toBe(true);
  });

  it("should handle minor version differences correctly", async () => {
    const mockRelease = { tag_name: "v0.2.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("0.1.3");

    expect(result).not.toBeNull();
    expect(result!.updateAvailable).toBe(true);
  });

  it("should handle patch version differences correctly", async () => {
    const mockRelease = { tag_name: "v0.1.4" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const result = await checkForUpdate("0.1.3");

    expect(result).not.toBeNull();
    expect(result!.updateAvailable).toBe(true);
  });
});
