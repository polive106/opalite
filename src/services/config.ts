import { join, dirname } from "path";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";
import { stringify, parse } from "yaml";

import type { AgentConfig } from "../types/agent";

export interface OpaliteConfig {
  workspace: string;
  repos: string[];
  agent?: AgentConfig;
  autoRefreshInterval?: number;
}

export function getDefaultConfigPath(): string {
  return join(homedir(), ".config", "opalite", "config.yml");
}

export async function saveConfig(
  config: OpaliteConfig,
  path: string = getDefaultConfigPath()
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify(config));
}

export async function loadConfig(
  path: string = getDefaultConfigPath()
): Promise<OpaliteConfig | null> {
  try {
    const content = await readFile(path, "utf-8");
    const parsed = parse(content) as OpaliteConfig;
    return parsed;
  } catch {
    return null;
  }
}

export function mergeConfigs(
  local: OpaliteConfig | null,
  shared: OpaliteConfig | null
): OpaliteConfig {
  if (!local && !shared) {
    return { workspace: "", repos: [] };
  }
  if (!shared) {
    return { ...local! };
  }
  if (!local) {
    return { ...shared };
  }

  return {
    workspace: shared.workspace ?? local.workspace,
    repos: shared.repos ?? local.repos,
    agent: shared.agent ?? local.agent,
    autoRefreshInterval: shared.autoRefreshInterval ?? local.autoRefreshInterval,
  };
}
