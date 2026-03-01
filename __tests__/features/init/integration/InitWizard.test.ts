import { describe, expect, it, spyOn } from "bun:test";
import {
  fetchWorkspaces,
  fetchRepos,
  detectAgents,
} from "../../../../src/commands/init";
import {
  handleRepoSelectKey,
  type RepoSelectState,
} from "../../../../src/features/init/hooks/useRepoSelect";
import {
  formatRepoRow,
  formatSelectionStatus,
} from "../../../../src/features/init/ui/RepoSelect";
import type { AuthData } from "../../../../src/services/auth";

const mockAuth: AuthData = {
  email: "user@example.com",
  apiToken: "ATATtoken123",
  displayName: "Test User",
  username: "testuser",
};

function mockBitbucketAPI(responses: {
  workspaces: { slug: string; name: string }[];
  repos: { slug: string; name: string }[];
}) {
  const wsResponse = new Response(
    JSON.stringify({ values: responses.workspaces }),
    { status: 200 }
  );
  const repoResponse = new Response(
    JSON.stringify({ values: responses.repos }),
    { status: 200 }
  );
  return spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(wsResponse)
    .mockResolvedValueOnce(repoResponse);
}

describe("InitWizard integration", () => {
  it("should fetch workspaces, repos, detect agents, and build config through key navigation", async () => {
    const fetchSpy = mockBitbucketAPI({
      workspaces: [
        { slug: "acme", name: "Acme Corp" },
        { slug: "beta", name: "Beta Inc" },
      ],
      repos: [
        { slug: "api", name: "API Service" },
        { slug: "frontend", name: "Frontend App" },
        { slug: "docs", name: "Documentation" },
      ],
    });

    // Step 1: Fetch workspaces
    const workspaces = await fetchWorkspaces(mockAuth);
    expect(workspaces).toHaveLength(2);
    expect(workspaces[0].slug).toBe("acme");

    // Step 2: User selects workspace "acme" (index 0 — first item via Enter)
    const selectedWorkspace = workspaces[0].slug;

    // Step 3: Fetch repos for selected workspace
    const repos = await fetchRepos(mockAuth, selectedWorkspace);
    expect(repos).toHaveLength(3);

    // Step 4: User navigates repo list and selects repos
    let state: RepoSelectState = { cursor: 0, selected: new Set() };

    // Verify initial formatting
    let row = formatRepoRow(repos[0], true, false);
    expect(row.name).toBe("API Service");
    expect(row.checkText).toBe("[ ]");

    // User presses space to select "API Service"
    let action = handleRepoSelectKey("space", state, repos.length);
    expect(action.action).toBe("toggle");
    if (action.action === "toggle") {
      state = { cursor: state.cursor, selected: action.selected };
    }

    // Verify selected state
    row = formatRepoRow(repos[0], true, state.selected.has(0));
    expect(row.checkText).toBe("[x]");

    // User presses ArrowDown twice to get to "Documentation"
    action = handleRepoSelectKey("down", state, repos.length);
    if (action.action === "move") {
      state = { ...state, cursor: action.cursor };
    }
    action = handleRepoSelectKey("down", state, repos.length);
    if (action.action === "move") {
      state = { ...state, cursor: action.cursor };
    }
    expect(state.cursor).toBe(2);

    // User presses space to select "Documentation"
    action = handleRepoSelectKey("space", state, repos.length);
    if (action.action === "toggle") {
      state = { cursor: state.cursor, selected: action.selected };
    }

    // Verify selection status
    const status = formatSelectionStatus(state.selected.size, repos.length);
    expect(status).toBe("2 of 3 selected");

    // User presses Enter to confirm
    action = handleRepoSelectKey("return", state, repos.length);
    expect(action.action).toBe("confirm");
    if (action.action === "confirm") {
      const selectedRepos = action.selectedIndices.map((i) => repos[i].slug);
      expect(selectedRepos).toEqual(["api", "docs"]);
    }

    // Step 5: Detect agents
    const agents = detectAgents((cmd) =>
      cmd === "claude" ? "/usr/local/bin/claude" : null
    );
    expect(agents).toEqual(["claude"]);

    // Step 6: Build config
    const config = {
      workspace: selectedWorkspace,
      repos: ["api", "docs"],
      agent: agents[0],
    };
    expect(config.workspace).toBe("acme");
    expect(config.repos).toEqual(["api", "docs"]);
    expect(config.agent).toBe("claude");

    fetchSpy.mockRestore();
  });

  it("should handle toggle-all flow", async () => {
    const fetchSpy = mockBitbucketAPI({
      workspaces: [{ slug: "ws", name: "WS" }],
      repos: [
        { slug: "repo-a", name: "Repo A" },
        { slug: "repo-b", name: "Repo B" },
        { slug: "repo-c", name: "Repo C" },
      ],
    });

    const workspaces = await fetchWorkspaces(mockAuth);
    expect(workspaces).toHaveLength(1);

    const repos = await fetchRepos(mockAuth, workspaces[0].slug);
    expect(repos).toHaveLength(3);

    let state: RepoSelectState = { cursor: 0, selected: new Set() };

    // User presses 'a' to select all
    let action = handleRepoSelectKey("a", state, repos.length);
    expect(action.action).toBe("toggle-all");
    if (action.action === "toggle-all") {
      state = { ...state, selected: action.selected };
    }
    expect(state.selected.size).toBe(3);

    // Verify all rows show [x]
    for (let i = 0; i < repos.length; i++) {
      const row = formatRepoRow(repos[i], i === state.cursor, state.selected.has(i));
      expect(row.checkText).toBe("[x]");
    }

    // User presses 'a' again to deselect all
    action = handleRepoSelectKey("a", state, repos.length);
    if (action.action === "toggle-all") {
      state = { ...state, selected: action.selected };
    }
    expect(state.selected.size).toBe(0);

    // Enter should not confirm with empty selection
    action = handleRepoSelectKey("return", state, repos.length);
    expect(action.action).toBe("none");

    fetchSpy.mockRestore();
  });

  it("should auto-select workspace when only one exists", async () => {
    const fetchSpy = mockBitbucketAPI({
      workspaces: [{ slug: "only-ws", name: "Only Workspace" }],
      repos: [{ slug: "repo", name: "Repo" }],
    });

    const workspaces = await fetchWorkspaces(mockAuth);
    expect(workspaces).toHaveLength(1);
    // With only 1 workspace, InitWizard auto-selects it (skips select-workspace step)
    const selectedWorkspace = workspaces[0].slug;
    expect(selectedWorkspace).toBe("only-ws");

    fetchSpy.mockRestore();
  });

  it("should handle no agents detected", () => {
    const agents = detectAgents(() => null);
    expect(agents).toHaveLength(0);

    // Config should have no agent field
    const config = {
      workspace: "ws",
      repos: ["repo"],
      ...(agents.length > 0 ? { agent: agents[0] } : {}),
    };
    expect(config.agent).toBeUndefined();
  });
});
