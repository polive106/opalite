import type { AgentConfig, AgentCommandTemplates } from "../types/agent";
import type { OpaliteConfig } from "./config";

const DEFAULT_TIMEOUT_MS = 60_000;

export interface QueryAgentOptions {
  timeoutMs?: number;
}

export function getAgentConfig(config: OpaliteConfig): AgentConfig | null {
  return config.agent ?? null;
}

export function buildAgentCommand(template: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (const char of template) {
    if (inQuotes) {
      if (char === quoteChar) {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuotes = true;
      quoteChar = char;
    } else if (char === " ") {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

export async function queryAgent(
  prompt: string,
  config: OpaliteConfig,
  options?: QueryAgentOptions
): Promise<string | null> {
  const agentConfig = getAgentConfig(config);
  if (!agentConfig) {
    return null;
  }

  const defaultAgent = agentConfig.default;
  const templates = agentConfig[defaultAgent] as AgentCommandTemplates;
  const printTemplate = templates?.print;

  if (!printTemplate) {
    return null;
  }

  const cmd = buildAgentCommand(printTemplate);

  let proc;
  try {
    proc = Bun.spawn(cmd, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      throw new Error(
        `Agent not found. Check your config or run \`opalite init\`. (${cmd[0]})`
      );
    }
    throw error;
  }

  proc.stdin.write(prompt);
  proc.stdin.end();

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const exitCode = await Promise.race([
    proc.exited,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Agent timed out after ${timeoutMs}ms`));
      }, timeoutMs)
    ),
  ]);

  if (exitCode !== 0) {
    const stderrText = await new Response(proc.stderr).text();
    throw new Error(stderrText.trim() || `Agent exited with code ${exitCode}`);
  }

  const stdout = await new Response(proc.stdout).text();
  const trimmed = stdout.trim();

  if (trimmed.length === 0) {
    throw new Error("Agent returned empty suggestion.");
  }

  return trimmed;
}
