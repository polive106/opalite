import { describe, expect, it, beforeEach, afterEach, spyOn, mock } from "bun:test";
import type { OpaliteConfig } from "../../../src/services/config";
import type { AgentConfig } from "../../../src/types/agent";
import {
  getAgentConfig,
  buildAgentCommand,
  queryAgent,
} from "../../../src/services/agent";

const claudeAgentConfig: AgentConfig = {
  default: "claude-code",
  "claude-code": {
    print: 'claude --print "{prompt}"',
  },
};

const cursorAgentConfig: AgentConfig = {
  default: "cursor",
  cursor: {
    print: 'agent -p "{prompt}"',
  },
};

function makeConfig(agent?: AgentConfig): OpaliteConfig {
  return {
    workspace: "test-ws",
    repos: ["repo-a"],
    agent,
  };
}

describe("getAgentConfig", () => {
  it("should return the agent config when configured", () => {
    const config = makeConfig(claudeAgentConfig);
    const result = getAgentConfig(config);
    expect(result).toEqual(claudeAgentConfig);
  });

  it("should return null when no agent is configured", () => {
    const config = makeConfig();
    const result = getAgentConfig(config);
    expect(result).toBeNull();
  });
});

describe("buildAgentCommand", () => {
  it("should parse a simple command template into command and args", () => {
    const result = buildAgentCommand('claude --print "{prompt}"');
    expect(result).toEqual(["claude", "--print", "{prompt}"]);
  });

  it("should parse cursor agent command template", () => {
    const result = buildAgentCommand('agent -p "{prompt}"');
    expect(result).toEqual(["agent", "-p", "{prompt}"]);
  });

  it("should handle command with no args", () => {
    const result = buildAgentCommand("claude");
    expect(result).toEqual(["claude"]);
  });

  it("should preserve quoted strings with spaces as single args", () => {
    const result = buildAgentCommand('claude --print --flag "some value"');
    expect(result).toEqual(["claude", "--print", "--flag", "some value"]);
  });
});

describe("queryAgent", () => {
  let spawnSpy: ReturnType<typeof spyOn>;

  function mockSpawn(
    stdout: string,
    exitCode: number = 0,
    stderr: string = ""
  ) {
    const stdoutStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout));
        controller.close();
      },
    });
    const stderrStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stderr));
        controller.close();
      },
    });
    const stdinWriter = { write: () => Promise.resolve(0), end: () => {} };

    const proc = {
      stdout: stdoutStream,
      stderr: stderrStream,
      stdin: stdinWriter,
      exited: Promise.resolve(exitCode),
      pid: 12345,
      kill: () => {},
    };

    spawnSpy = spyOn(Bun, "spawn").mockReturnValue(proc as never);
    return proc;
  }

  afterEach(() => {
    spawnSpy?.mockRestore();
  });

  it("should return null when no agent is configured", async () => {
    const config = makeConfig();
    const result = await queryAgent("test prompt", config);
    expect(result).toBeNull();
  });

  it("should spawn the agent and return stdout", async () => {
    mockSpawn("Refined comment text");
    const config = makeConfig(claudeAgentConfig);

    const result = await queryAgent("Refine this comment", config);

    expect(result).toBe("Refined comment text");
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });

  it("should pipe the prompt via stdin", async () => {
    const proc = mockSpawn("output");
    const writeSpy = spyOn(proc.stdin, "write");
    const endSpy = spyOn(proc.stdin, "end");

    const config = makeConfig(claudeAgentConfig);
    await queryAgent("my prompt text", config);

    expect(writeSpy).toHaveBeenCalledWith("my prompt text");
    expect(endSpy).toHaveBeenCalled();
  });

  it("should use the correct command from config template", async () => {
    mockSpawn("output");
    const config = makeConfig(cursorAgentConfig);

    await queryAgent("test", config);

    const spawnCall = spawnSpy.mock.calls[0];
    const cmd = spawnCall[0] as string[];
    expect(cmd[0]).toBe("agent");
    expect(cmd[1]).toBe("-p");
  });

  it("should throw when agent process exits with non-zero code", async () => {
    mockSpawn("", 1, "Agent crashed");
    const config = makeConfig(claudeAgentConfig);

    await expect(queryAgent("test", config)).rejects.toThrow("Agent crashed");
  });

  it("should throw when agent returns empty output", async () => {
    mockSpawn("");
    const config = makeConfig(claudeAgentConfig);

    await expect(queryAgent("test", config)).rejects.toThrow("empty");
  });

  it("should throw when agent returns whitespace-only output", async () => {
    mockSpawn("   \n  ");
    const config = makeConfig(claudeAgentConfig);

    await expect(queryAgent("test", config)).rejects.toThrow("empty");
  });

  it("should trim whitespace from agent output", async () => {
    mockSpawn("  refined comment  \n");
    const config = makeConfig(claudeAgentConfig);

    const result = await queryAgent("test", config);
    expect(result).toBe("refined comment");
  });

  it("should throw on timeout", async () => {
    const neverResolve = new Promise<number>(() => {});
    const stdoutStream = new ReadableStream({
      start() {},
    });
    const stderrStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const stdinWriter = { write: () => Promise.resolve(0), end: () => {} };

    const proc = {
      stdout: stdoutStream,
      stderr: stderrStream,
      stdin: stdinWriter,
      exited: neverResolve,
      pid: 12345,
      kill: () => {},
    };

    spawnSpy = spyOn(Bun, "spawn").mockReturnValue(proc as never);
    const config = makeConfig(claudeAgentConfig);

    await expect(
      queryAgent("test", config, { timeoutMs: 50 })
    ).rejects.toThrow("timed out");
  });

  it("should throw a clear error when agent is not installed (ENOENT)", async () => {
    spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
      throw new Error("spawn ENOENT: claude");
    });
    const config = makeConfig(claudeAgentConfig);

    await expect(queryAgent("test", config)).rejects.toThrow("not found");
  });
});
