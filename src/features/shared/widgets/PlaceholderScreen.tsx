import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { KeyBar, type KeyBinding } from "./KeyBar";
import { isBackKey } from "../hooks/useScreenStack";

export interface PlaceholderScreenData {
  title: string;
  subtitle: string;
}

const SCREEN_DISPLAY_NAMES: Record<string, string> = {
  diffnav: "Diff Nav",
  "review-submit": "Review Submit",
  "my-prs": "My PRs",
  "comment-queue": "Comment Queue",
  "agent-fix": "Agent Fix",
};

export function formatPlaceholderScreen(screenName: string): PlaceholderScreenData {
  const title =
    SCREEN_DISPLAY_NAMES[screenName] ??
    screenName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return {
    title,
    subtitle: "Coming soon",
  };
}

export const PLACEHOLDER_KEY_BINDINGS: KeyBinding[] = [
  { key: "esc/b", label: "back" },
  { key: "q", label: "quit" },
];

export interface PlaceholderScreenProps {
  screenName: string;
  goBack: () => void;
}

export function PlaceholderScreen({ screenName, goBack }: PlaceholderScreenProps) {
  const { width, height } = useTerminalDimensions();
  const data = formatPlaceholderScreen(screenName);

  useKeyboard((e) => {
    if (isBackKey(e.name)) {
      goBack();
    }
    if (e.name === "q") {
      process.exit(0);
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
        <text fg={theme.accent}>opalite</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{data.title}</text>
      </box>

      <box flexGrow={1} justifyContent="center" alignItems="center">
        <box flexDirection="column" alignItems="center">
          <text fg={theme.fg}>{data.title}</text>
          <text fg={theme.dimmed}>{data.subtitle}</text>
        </box>
      </box>

      <KeyBar bindings={PLACEHOLDER_KEY_BINDINGS} />
    </box>
  );
}
