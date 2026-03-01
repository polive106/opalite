import { useState } from "react";
import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { Workspace } from "../../../commands/init";

const KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "select" },
];

export interface WorkspaceSelectProps {
  workspaces: Workspace[];
  onSelect: (workspace: string) => void;
}

export function WorkspaceSelect({ workspaces, onSelect }: WorkspaceSelectProps) {
  const { width, height } = useTerminalDimensions();
  const [cursor, setCursor] = useState(0);

  useKeyboard((e) => {
    if (e.name === "down" || e.name === "j") {
      e.preventDefault();
      setCursor((prev) => Math.min(prev + 1, workspaces.length - 1));
    } else if (e.name === "up" || e.name === "k") {
      e.preventDefault();
      setCursor((prev) => Math.max(prev - 1, 0));
    } else if (e.name === "return") {
      e.preventDefault();
      onSelect(workspaces[cursor].slug);
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
        <text fg={theme.fg}>Select a workspace</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>

      <scrollbox flexGrow={1} scrollY={true} paddingX={1}>
        {workspaces.map((ws, i) => {
          const isCursor = i === cursor;
          const nameColor = isCursor ? theme.accent : theme.fg;
          const bgColor = isCursor ? theme.selection : theme.bg;

          return (
            <box
              key={ws.slug}
              flexDirection="row"
              backgroundColor={bgColor}
              width={contentWidth}
            >
              <text fg={nameColor}>{ws.name} </text>
              <text fg={theme.dimmed}>({ws.slug})</text>
            </box>
          );
        })}
      </scrollbox>

      <KeyBar bindings={KEY_BINDINGS} />
    </box>
  );
}
