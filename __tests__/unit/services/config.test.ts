import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";

import {
  getDefaultConfigPath,
  loadConfig,
  saveConfig,
  mergeConfigs,
  type OpaliteConfig,
} from "../../../src/services/config";
import type { AgentConfig } from "../../../src/types/agent";

const claudeAgent: AgentConfig = {
  default: "claude-code",
  "claude-code": { print: 'claude --print "{prompt}"' },
};

const cursorAgent: AgentConfig = {
  default: "cursor",
  cursor: { print: 'agent -p "{prompt}"' },
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "opalite-config-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("getDefaultConfigPath", () => {
  it("should return a path under ~/.config/opalite", () => {
    const path = getDefaultConfigPath();
    expect(path).toContain(".config");
    expect(path).toContain("opalite");
    expect(path).toEndWith("config.yml");
  });
});

describe("saveConfig", () => {
  it("should save config as YAML to the specified path", async () => {
    const configPath = join(tempDir, "config.yml");
    const config: OpaliteConfig = {
      workspace: "my-workspace",
      repos: ["repo-a", "repo-b"],
      agent: claudeAgent,
    };

    await saveConfig(config, configPath);

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("workspace: my-workspace");
    expect(content).toContain("repo-a");
    expect(content).toContain("repo-b");
    expect(content).toContain("default: claude-code");
  });

  it("should create parent directories if they don't exist", async () => {
    const configPath = join(tempDir, "nested", "dir", "config.yml");
    const config: OpaliteConfig = {
      workspace: "ws",
      repos: ["repo"],
    };

    await saveConfig(config, configPath);

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("workspace: ws");
  });
});

describe("loadConfig", () => {
  it("should load config from a YAML file", async () => {
    const configPath = join(tempDir, "config.yml");
    await writeFile(
      configPath,
      'workspace: my-workspace\nrepos:\n  - repo-a\n  - repo-b\nagent:\n  default: claude-code\n  claude-code:\n    print: \'claude --print "{prompt}"\'\n'
    );

    const config = await loadConfig(configPath);
    expect(config).not.toBeNull();
    expect(config!.workspace).toBe("my-workspace");
    expect(config!.repos).toEqual(["repo-a", "repo-b"]);
    expect(config!.agent).toEqual({
      default: "claude-code",
      "claude-code": { print: 'claude --print "{prompt}"' },
    });
  });

  it("should return null if the file does not exist", async () => {
    const configPath = join(tempDir, "nonexistent.yml");
    const config = await loadConfig(configPath);
    expect(config).toBeNull();
  });

  it("should load config without optional agent field", async () => {
    const configPath = join(tempDir, "config.yml");
    await writeFile(
      configPath,
      "workspace: ws\nrepos:\n  - repo-a\n"
    );

    const config = await loadConfig(configPath);
    expect(config).not.toBeNull();
    expect(config!.workspace).toBe("ws");
    expect(config!.repos).toEqual(["repo-a"]);
    expect(config!.agent).toBeUndefined();
  });
});

describe("mergeConfigs", () => {
  it("should return local config when no shared config exists", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      agent: claudeAgent,
    };

    const merged = mergeConfigs(local, null);
    expect(merged.workspace).toBe("my-ws");
    expect(merged.repos).toEqual(["repo-a"]);
    expect(merged.agent).toEqual(claudeAgent);
  });

  it("should use shared config workspace and repos over local", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      agent: claudeAgent,
    };
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo-a", "team-repo-b"],
    };

    const merged = mergeConfigs(local, shared);
    expect(merged.workspace).toBe("team-ws");
    expect(merged.repos).toEqual(["team-repo-a", "team-repo-b"]);
  });

  it("should keep local agent when shared has no agent", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      agent: claudeAgent,
    };
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo"],
    };

    const merged = mergeConfigs(local, shared);
    expect(merged.agent).toEqual(claudeAgent);
  });

  it("should use shared agent when both have agent set", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      agent: claudeAgent,
    };
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo"],
      agent: cursorAgent,
    };

    const merged = mergeConfigs(local, shared);
    expect(merged.agent).toEqual(cursorAgent);
  });

  it("should use shared autoRefreshInterval over local", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      autoRefreshInterval: 60,
    };
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo"],
      autoRefreshInterval: 180,
    };

    const merged = mergeConfigs(local, shared);
    expect(merged.autoRefreshInterval).toBe(180);
  });

  it("should keep local autoRefreshInterval when shared has none", () => {
    const local: OpaliteConfig = {
      workspace: "my-ws",
      repos: ["repo-a"],
      autoRefreshInterval: 90,
    };
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo"],
    };

    const merged = mergeConfigs(local, shared);
    expect(merged.autoRefreshInterval).toBe(90);
  });

  it("should return shared config when no local config exists", () => {
    const shared: OpaliteConfig = {
      workspace: "team-ws",
      repos: ["team-repo"],
      agent: cursorAgent,
    };

    const merged = mergeConfigs(null, shared);
    expect(merged.workspace).toBe("team-ws");
    expect(merged.repos).toEqual(["team-repo"]);
    expect(merged.agent).toEqual(cursorAgent);
  });
});
