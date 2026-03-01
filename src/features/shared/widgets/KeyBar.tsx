import { theme } from "../../../theme/tokyo-night";

export interface KeyBinding {
  key: string;
  label: string;
}

export function formatKeyBindings(bindings: KeyBinding[]): KeyBinding[] {
  return bindings;
}

interface KeyBarProps {
  bindings: KeyBinding[];
}

export function KeyBar({ bindings }: KeyBarProps) {
  return (
    <box flexDirection="row" paddingX={1} paddingBottom={1} gap={2}>
      {bindings.map((binding) => (
        <box key={binding.key} flexDirection="row">
          <text fg={theme.accent}>{binding.key}</text>
          <text fg={theme.dimmed}>{` ${binding.label}`}</text>
        </box>
      ))}
    </box>
  );
}
