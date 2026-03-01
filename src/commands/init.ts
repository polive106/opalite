import { bbFetch, type AuthData, loadAuthFile, getDefaultAuthPath } from "../services/auth";
import {
  saveConfig,
  loadConfig,
  mergeConfigs,
  getDefaultConfigPath,
  type OpaliteConfig,
} from "../services/config";

export interface Workspace {
  slug: string;
  name: string;
}

export interface Repository {
  slug: string;
  name: string;
}

interface PaginatedResponse<T> {
  values: T[];
  next?: string;
}

const AGENT_COMMANDS = ["claude", "agent", "cursor-agent"] as const;

export async function fetchWorkspaces(auth: AuthData): Promise<Workspace[]> {
  const workspaces: Workspace[] = [];
  let url: string | undefined = "/2.0/workspaces";

  while (url) {
    const response = await bbFetch(url, auth);
    if (!response.ok) {
      throw new Error(`Failed to fetch workspaces (HTTP ${response.status}).`);
    }
    const data = (await response.json()) as PaginatedResponse<Workspace>;
    workspaces.push(...data.values);
    url = data.next;
    // If next is a full URL, extract the path
    if (url && url.startsWith("http")) {
      const parsed = new URL(url);
      url = parsed.pathname + parsed.search;
    }
  }

  return workspaces;
}

export async function fetchRepos(
  auth: AuthData,
  workspace: string
): Promise<Repository[]> {
  const repos: Repository[] = [];
  let url: string | undefined = `/2.0/repositories/${workspace}`;

  while (url) {
    const response = await bbFetch(url, auth);
    if (!response.ok) {
      throw new Error(`Failed to fetch repos (HTTP ${response.status}).`);
    }
    const data = (await response.json()) as PaginatedResponse<Repository>;
    repos.push(...data.values);
    url = data.next;
    if (url && url.startsWith("http")) {
      const parsed = new URL(url);
      url = parsed.pathname + parsed.search;
    }
  }

  return repos;
}

type WhichFn = (cmd: string) => string | null;

export function detectAgents(
  whichFn: WhichFn = (cmd) => Bun.which(cmd)
): string[] {
  const found: string[] = [];
  for (const cmd of AGENT_COMMANDS) {
    if (whichFn(cmd) !== null) {
      found.push(cmd);
    }
  }
  return found;
}

interface InitOptions {
  configPath?: string;
  readLine: () => Promise<string>;
  whichFn?: WhichFn;
  sharedConfigPath?: string;
}

export async function runInitWizard(
  auth: AuthData,
  options: InitOptions
): Promise<void> {
  const {
    configPath = getDefaultConfigPath(),
    readLine,
    whichFn = (cmd) => Bun.which(cmd),
    sharedConfigPath = ".opalite.yml",
  } = options;

  // 1. Fetch workspaces
  console.log("Fetching your workspaces...");
  const workspaces = await fetchWorkspaces(auth);

  if (workspaces.length === 0) {
    console.error("No workspaces found. Make sure your Bitbucket account has access to at least one workspace.");
    process.exit(1);
  }

  // 2. Select workspace
  let selectedWorkspace: string;

  if (workspaces.length === 1) {
    selectedWorkspace = workspaces[0].slug;
    console.log(`Auto-selected workspace: ${workspaces[0].name} (${selectedWorkspace})`);
  } else {
    console.log("\nSelect a workspace:");
    for (let i = 0; i < workspaces.length; i++) {
      console.log(`  ${i + 1}. ${workspaces[i].name} (${workspaces[i].slug})`);
    }
    process.stdout.write("\nWorkspace number: ");
    const input = (await readLine()).trim();
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= workspaces.length) {
      console.error("Invalid selection.");
      process.exit(1);
    }
    selectedWorkspace = workspaces[idx].slug;
  }

  // 3. Fetch and select repos
  console.log(`\nFetching repos for ${selectedWorkspace}...`);
  const repos = await fetchRepos(auth, selectedWorkspace);

  if (repos.length === 0) {
    console.error("No repos found in this workspace.");
    process.exit(1);
  }

  console.log("\nSelect repos to watch (comma-separated numbers, e.g. 1,3,5):");
  for (let i = 0; i < repos.length; i++) {
    console.log(`  ${i + 1}. ${repos[i].name} (${repos[i].slug})`);
  }
  process.stdout.write("\nRepos: ");
  const repoInput = (await readLine()).trim();
  const repoIndices = repoInput
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((idx) => !isNaN(idx) && idx >= 0 && idx < repos.length);

  if (repoIndices.length === 0) {
    console.error("No valid repos selected.");
    process.exit(1);
  }

  const selectedRepos = repoIndices.map((i) => repos[i].slug);

  // 4. Detect AI agents
  const agents = detectAgents(whichFn);
  let selectedAgent: string | undefined;

  if (agents.length === 1) {
    selectedAgent = agents[0];
    console.log(`\nAI agent detected: ${selectedAgent}`);
  } else if (agents.length > 1) {
    console.log("\nMultiple AI agents detected. Choose one:");
    for (let i = 0; i < agents.length; i++) {
      console.log(`  ${i + 1}. ${agents[i]}`);
    }
    process.stdout.write("\nAgent number: ");
    const agentInput = (await readLine()).trim();
    const agentIdx = parseInt(agentInput, 10) - 1;
    if (!isNaN(agentIdx) && agentIdx >= 0 && agentIdx < agents.length) {
      selectedAgent = agents[agentIdx];
    }
  } else {
    console.log("\nNo AI agent found in PATH.");
    console.log("  Install Claude Code: npm install -g @anthropic-ai/claude-code");
    console.log("  Install Cursor CLI:  https://cursor.com");
    console.log("  Or skip for now.");
  }

  // 5. Build config
  const localConfig: OpaliteConfig = {
    workspace: selectedWorkspace,
    repos: selectedRepos,
    ...(selectedAgent ? { agent: selectedAgent } : {}),
  };

  // 6. Merge with shared config if it exists
  const sharedConfig = await loadConfig(sharedConfigPath);
  const finalConfig = mergeConfigs(localConfig, sharedConfig);

  // 7. Save config
  await saveConfig(finalConfig, configPath);
  console.log(`\nConfig saved to ${configPath}`);
  console.log(`  Workspace: ${finalConfig.workspace}`);
  console.log(`  Repos: ${finalConfig.repos.join(", ")}`);
  if (finalConfig.agent) {
    console.log(`  Agent: ${finalConfig.agent}`);
  }
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.resume();
    const onData = (chunk: string) => {
      data += chunk;
      if (data.includes("\n")) {
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(data.split("\n")[0]);
      }
    };
    process.stdin.on("data", onData);
  });
}

export async function runInit(
  authPath: string = getDefaultAuthPath()
): Promise<void> {
  const auth = await loadAuthFile(authPath);
  if (!auth) {
    console.error('Run `opalite login` first.');
    process.exit(1);
  }

  await runInitWizard(auth, {
    readLine,
  });
}
