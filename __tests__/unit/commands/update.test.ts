import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import {
  getUpdateMessage,
  runUpdateAction,
  type UpdateActionResult,
} from "../../../src/commands/update";

describe("getUpdateMessage", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
  });

  it("should return an update notice when a newer version is available", async () => {
    const mockRelease = { tag_name: "v2.0.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const message = await getUpdateMessage("0.1.0");

    expect(message).not.toBeNull();
    expect(message).toContain("v2.0.0");
    expect(message).toContain("v0.1.0");
    expect(message).toContain("opalite update");
  });

  it("should return null when already on the latest version", async () => {
    const mockRelease = { tag_name: "v0.1.0" };
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockRelease), { status: 200 })
    );

    const message = await getUpdateMessage("0.1.0");

    expect(message).toBeNull();
  });

  it("should return null when the check fails", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const message = await getUpdateMessage("0.1.0");

    expect(message).toBeNull();
  });
});

describe("runUpdateAction", () => {
  it("should return success when install script exits with code 0", async () => {
    const mockProc = {
      exited: Promise.resolve(0),
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Updated to v2.0.0\n"));
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    };

    const spawnSpy = spyOn(Bun, "spawn").mockReturnValueOnce(
      mockProc as unknown as ReturnType<typeof Bun.spawn>
    );

    const result = await runUpdateAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("Updated to v2.0.0");
    }

    spawnSpy.mockRestore();
  });

  it("should return failure when install script exits with non-zero code", async () => {
    const mockProc = {
      exited: Promise.resolve(1),
      stdout: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
      stderr: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("Download failed\n"));
          controller.close();
        },
      }),
    };

    const spawnSpy = spyOn(Bun, "spawn").mockReturnValueOnce(
      mockProc as unknown as ReturnType<typeof Bun.spawn>
    );

    const result = await runUpdateAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("failed");
    }

    spawnSpy.mockRestore();
  });

  it("should return failure when spawn throws an error", async () => {
    const spawnSpy = spyOn(Bun, "spawn").mockImplementationOnce(() => {
      throw new Error("Command not found");
    });

    const result = await runUpdateAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Command not found");
    }

    spawnSpy.mockRestore();
  });
});
