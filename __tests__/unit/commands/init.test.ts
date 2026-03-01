import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import {
  fetchWorkspaces,
  fetchRepos,
  detectAgents,
  runInitWizard,
  type Workspace,
  type Repository,
} from "../../../src/commands/init";
import type { AuthData } from "../../../src/services/auth";

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-init-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

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

describe("runInitWizard", () => {
  it("should save config with workspace, repos, and agent", async () => {
    const configPath = join(tempDir, "config.yml");

    // Mock fetch for workspaces and repos
    const wsResponse = new Response(
      JSON.stringify({
        values: [{ slug: "my-workspace", name: "My Workspace" }],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [
          { slug: "repo-a", name: "Repo A" },
          { slug: "repo-b", name: "Repo B" },
        ],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    // Mock readline for repo selection (select all) and agent skip
    const lines = ["1,2", ""]; // select repos 1,2 then empty for agent skip
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: () => null, // no agents found
      sharedConfigPath: join(tempDir, "nonexistent.yml"),
    });

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("my-workspace");
    expect(content).toContain("repo-a");
    expect(content).toContain("repo-b");

    fetchSpy.mockRestore();
  });

  it("should auto-select single workspace without prompting", async () => {
    const configPath = join(tempDir, "config.yml");
    const wsResponse = new Response(
      JSON.stringify({
        values: [{ slug: "only-workspace", name: "Only Workspace" }],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [{ slug: "repo-a", name: "Repo A" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    const lines = ["1", ""];
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: () => null,
      sharedConfigPath: join(tempDir, "nonexistent.yml"),
    });

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("only-workspace");

    fetchSpy.mockRestore();
  });

  it("should prompt for workspace selection when multiple exist", async () => {
    const configPath = join(tempDir, "config.yml");
    const wsResponse = new Response(
      JSON.stringify({
        values: [
          { slug: "ws-a", name: "Workspace A" },
          { slug: "ws-b", name: "Workspace B" },
        ],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [{ slug: "repo-x", name: "Repo X" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    // User selects workspace 2 ("ws-b"), then repo 1, then empty for agent
    const lines = ["2", "1", ""];
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: () => null,
      sharedConfigPath: join(tempDir, "nonexistent.yml"),
    });

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("ws-b");

    fetchSpy.mockRestore();
  });

  it("should auto-select agent when only one is found", async () => {
    const configPath = join(tempDir, "config.yml");
    const wsResponse = new Response(
      JSON.stringify({
        values: [{ slug: "ws", name: "WS" }],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [{ slug: "repo", name: "Repo" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    const lines = ["1"];
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: (cmd: string) =>
        cmd === "claude" ? "/usr/local/bin/claude" : null,
      sharedConfigPath: join(tempDir, "nonexistent.yml"),
    });

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("agent: claude");

    fetchSpy.mockRestore();
  });

  it("should prompt user to choose when multiple agents found", async () => {
    const configPath = join(tempDir, "config.yml");
    const wsResponse = new Response(
      JSON.stringify({
        values: [{ slug: "ws", name: "WS" }],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [{ slug: "repo", name: "Repo" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    // Select repo 1, then choose agent 2 (cursor-agent)
    const lines = ["1", "2"];
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: (cmd: string) => {
        if (cmd === "claude") return "/usr/local/bin/claude";
        if (cmd === "cursor-agent") return "/usr/local/bin/cursor-agent";
        return null;
      },
      sharedConfigPath: join(tempDir, "nonexistent.yml"),
    });

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("agent: cursor-agent");

    fetchSpy.mockRestore();
  });

  it("should merge with shared config when .opalite.yml exists", async () => {
    const configPath = join(tempDir, "config.yml");
    const sharedConfigPath = join(tempDir, ".opalite.yml");

    // Create a shared config that overrides workspace and repos
    await writeFile(
      sharedConfigPath,
      "workspace: team-ws\nrepos:\n  - team-repo\n"
    );

    const wsResponse = new Response(
      JSON.stringify({
        values: [{ slug: "my-ws", name: "My WS" }],
      }),
      { status: 200 }
    );
    const repoResponse = new Response(
      JSON.stringify({
        values: [{ slug: "repo-a", name: "Repo A" }],
      }),
      { status: 200 }
    );
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(wsResponse)
      .mockResolvedValueOnce(repoResponse);

    const lines = ["1", ""];
    let lineIndex = 0;

    await runInitWizard(mockAuth, {
      configPath,
      readLine: async () => lines[lineIndex++] ?? "",
      whichFn: () => null,
      sharedConfigPath,
    });

    const content = await readFile(configPath, "utf-8");
    // Shared config takes precedence for team settings
    expect(content).toContain("team-ws");
    expect(content).toContain("team-repo");

    fetchSpy.mockRestore();
  });
});
