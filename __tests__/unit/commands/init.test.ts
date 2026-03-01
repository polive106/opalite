import { describe, expect, it, spyOn } from "bun:test";
import {
  fetchWorkspaces,
  fetchRepos,
  detectAgents,
} from "../../../src/commands/init";
import type { AuthData } from "../../../src/services/auth";

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

describe("fetchWorkspaces", () => {
  it("should fetch and return workspace slugs", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        values: [
          { slug: "workspace-a", name: "Workspace A" },
          { slug: "workspace-b", name: "Workspace B" },
        ],
        next: undefined,
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await fetchWorkspaces(mockAuth);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("workspace-a");
    expect(result[1].slug).toBe("workspace-b");

    fetchSpy.mockRestore();
  });

  it("should auto-paginate when next URL is present", async () => {
    const page1 = new Response(
      JSON.stringify({
        values: [{ slug: "ws-1", name: "WS 1" }],
        next: "https://api.bitbucket.org/2.0/workspaces?page=2",
      }),
      { status: 200 }
    );
    const page2 = new Response(
      JSON.stringify({
        values: [{ slug: "ws-2", name: "WS 2" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const result = await fetchWorkspaces(mockAuth);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("ws-1");
    expect(result[1].slug).toBe("ws-2");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  it("should throw on 401 with expired token message", async () => {
    const mockResponse = new Response("Unauthorized", { status: 401 });
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    try {
      await fetchWorkspaces(mockAuth);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("expired");
    }

    fetchSpy.mockRestore();
  });
});

describe("fetchRepos", () => {
  it("should fetch and return repos for a workspace", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        values: [
          { slug: "repo-a", name: "Repo A" },
          { slug: "repo-b", name: "Repo B" },
        ],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await fetchRepos(mockAuth, "my-workspace");
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("repo-a");
    expect(result[1].slug).toBe("repo-b");

    fetchSpy.mockRestore();
  });

  it("should auto-paginate repo results", async () => {
    const page1 = new Response(
      JSON.stringify({
        values: [{ slug: "repo-1", name: "Repo 1" }],
        next: "https://api.bitbucket.org/2.0/repositories/ws?page=2",
      }),
      { status: 200 }
    );
    const page2 = new Response(
      JSON.stringify({
        values: [{ slug: "repo-2", name: "Repo 2" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const result = await fetchRepos(mockAuth, "my-workspace");
    expect(result).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });
});

describe("detectAgents", () => {
  it("should detect agents available in PATH", () => {
    const mockWhich = (cmd: string) => {
      if (cmd === "claude") return "/usr/local/bin/claude";
      return null;
    };

    const agents = detectAgents(mockWhich);
    expect(agents).toEqual(["claude"]);
  });

  it("should detect multiple agents", () => {
    const mockWhich = (cmd: string) => {
      if (cmd === "claude") return "/usr/local/bin/claude";
      if (cmd === "cursor-agent") return "/usr/local/bin/cursor-agent";
      return null;
    };

    const agents = detectAgents(mockWhich);
    expect(agents).toContain("claude");
    expect(agents).toContain("cursor-agent");
    expect(agents).toHaveLength(2);
  });

  it("should return empty array when no agents found", () => {
    const mockWhich = () => null;

    const agents = detectAgents(mockWhich);
    expect(agents).toEqual([]);
  });

  it("should check for claude, agent, and cursor-agent", () => {
    const checkedCommands: string[] = [];
    const mockWhich = (cmd: string) => {
      checkedCommands.push(cmd);
      return null;
    };

    detectAgents(mockWhich);
    expect(checkedCommands).toContain("claude");
    expect(checkedCommands).toContain("agent");
    expect(checkedCommands).toContain("cursor-agent");
  });
});

