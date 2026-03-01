import { useState } from "react";
import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";

const KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "select" },
];

export interface AgentSelectProps {
  agents: string[];
  onSelect: (agent: string | undefined) => void;
}

function NoAgentScreen({ onSkip }: { onSkip: () => void }) {
  const { width, height } = useTerminalDimensions();

  useKeyboard((e) => {
    if (e.name === "return") {
      onSkip();
    }
  });

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite init</text>
      </box>

      <box paddingX={1} paddingBottom={1}>
        <text fg={theme.fg}>AI Agent</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(Math.max(width - 2, 40))}</text>
      </box>

      <box flexGrow={1} paddingX={1} paddingY={1} flexDirection="column">
        <text fg={theme.yellow}>No AI agent found in PATH.</text>
        <box paddingTop={1} flexDirection="column">
          <text fg={theme.dimmed}>
            Install Claude Code: npm install -g @anthropic-ai/claude-code
          </text>
          <text fg={theme.dimmed}>
            Install Cursor CLI:  https://cursor.com
          </text>
        </box>
        <box paddingTop={1}>
          <text fg={theme.fg}>Press Enter to skip and continue.</text>
        </box>
      </box>

      <KeyBar bindings={[{ key: "⏎", label: "skip" }]} />
    </box>
  );
}

function AgentPickerScreen({
  agents,
  onSelect,
}: {
  agents: string[];
  onSelect: (agent: string) => void;
}) {
  const { width, height } = useTerminalDimensions();
  const [cursor, setCursor] = useState(0);

  useKeyboard((e) => {
    if (e.name === "down" || e.name === "j") {
      e.preventDefault();
      setCursor((prev) => Math.min(prev + 1, agents.length - 1));
    } else if (e.name === "up" || e.name === "k") {
      e.preventDefault();
      setCursor((prev) => Math.max(prev - 1, 0));
    } else if (e.name === "return") {
      e.preventDefault();
      onSelect(agents[cursor]);
    }
  });

  const contentWidth = Math.max(width - 2, 40);

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite init</text>
      </box>

      <box paddingX={1} paddingBottom={1}>
        <text fg={theme.fg}>Select an AI agent</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>

      <scrollbox flexGrow={1} scrollY={true} paddingX={1}>
        {agents.map((agent, i) => {
          const isCursor = i === cursor;
          const nameColor = isCursor ? theme.accent : theme.fg;
          const bgColor = isCursor ? theme.selection : theme.bg;

          return (
            <box
              key={agent}
              flexDirection="row"
              backgroundColor={bgColor}
              width={contentWidth}
            >
              <text fg={nameColor}>{agent}</text>
            </box>
          );
        })}
      </scrollbox>

      <KeyBar bindings={KEY_BINDINGS} />
    </box>
  );
}

export function AgentSelect({ agents, onSelect }: AgentSelectProps) {
  if (agents.length === 0) {
    return <NoAgentScreen onSkip={() => onSelect(undefined)} />;
  }

  return <AgentPickerScreen agents={agents} onSelect={onSelect} />;
}
