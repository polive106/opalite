import { bbFetch, type AuthData, loadAuthFile, getDefaultAuthPath } from "../services/auth";
import {
  saveConfig,
  getDefaultConfigPath,
  type OpaliteConfig,
} from "../services/config";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { InitWizard } from "../features/init/ui/InitWizard";

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

export async function runInit(
  authPath: string = getDefaultAuthPath()
): Promise<void> {
  const auth = await loadAuthFile(authPath);
  if (!auth) {
    console.error('Run `opalite login` first.');
    process.exit(1);
  }

  const configPath = getDefaultConfigPath();
  const sharedConfigPath = ".opalite.yml";

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    useAlternateScreen: true,
  });

  createRoot(renderer).render(
    <InitWizard
      auth={auth}
      onComplete={async (config: OpaliteConfig) => {
        // Save shared config (.opalite.yml) with workspace and repos
        await saveConfig(
          { workspace: config.workspace, repos: config.repos },
          sharedConfigPath
        );

        // Save local config (~/.config/opalite/config.yml) with full config including agent
        await saveConfig(config, configPath);

        renderer.destroy();

        console.log(`\nShared config saved to ${sharedConfigPath}`);
        console.log(`Local config saved to ${configPath}`);
        console.log(`  Workspace: ${config.workspace}`);
        console.log(`  Repos: ${config.repos.join(", ")}`);
        if (config.agent) {
          console.log(`  Agent: ${config.agent.default}`);
        }

        process.exit(0);
      }}
      onError={(message: string) => {
        renderer.destroy();
        console.error(message);
        process.exit(1);
      }}
    />
  );
}
