import { theme } from "../../../theme/tokyo-night";
import { KeyBar } from "../../shared/widgets/KeyBar";
import type { KeyBinding } from "../../shared/widgets/KeyBar";

export type RefinementVisualState =
  | "loading"
  | "suggestion"
  | "error"
  | "feedback";

export function formatRefinementHeader(
  filePath?: string,
  lineNumber?: number
): string {
  if (filePath && lineNumber !== undefined) {
    return `Comment on ${filePath}:${lineNumber}`;
  }

  if (filePath) {
    return `Comment on ${filePath}`;
  }

  return "Comment refinement";
}

export function formatRefinementKeyBar(
  state: RefinementVisualState
): KeyBinding[] {
  switch (state) {
    case "suggestion":
      return [
        { key: "a", label: "accept" },
        { key: "s", label: "skip" },
        { key: "e", label: "edit" },
        { key: "r", label: "reject+feedback" },
      ];
    case "loading":
      return [{ key: "Esc", label: "cancel" }];
    case "error":
      return [
        { key: "s", label: "post original" },
        { key: "Esc", label: "cancel" },
      ];
    case "feedback":
      return [
        { key: "Enter", label: "send" },
        { key: "Esc", label: "cancel" },
      ];
  }
}

export interface CommentRefinementProps {
  header: string;
  draft: string;
  suggestion?: string;
  loading: boolean;
  error?: string;
  feedbackMode: boolean;
  feedbackText: string;
  onFeedbackChange: (text: string) => void;
}

export function CommentRefinement({
  header,
  draft,
  suggestion,
  loading,
  error,
  feedbackMode,
  feedbackText,
  onFeedbackChange,
}: CommentRefinementProps) {
  const visualState: RefinementVisualState = loading
    ? "loading"
    : error
      ? "error"
      : feedbackMode
        ? "feedback"
        : "suggestion";

  const bindings = formatRefinementKeyBar(visualState);

  return (
    <box
      flexDirection="column"
      border={["top", "bottom"]}
      borderColor={theme.accent}
      paddingX={1}
      paddingY={0}
    >
      <box paddingBottom={1}>
        <text fg={theme.accent}>{header}</text>
      </box>

      <box flexDirection="column" paddingBottom={1}>
        <text fg={theme.dimmed}>Your draft:</text>
        <box
          border={["top", "bottom", "left", "right"]}
          borderColor={theme.border}
          paddingX={1}
        >
          <text fg={theme.fg}>{draft}</text>
        </box>
      </box>

      {visualState === "loading" && (
        <box paddingBottom={1}>
          <text fg={theme.dimmed}>Refining comment...</text>
        </box>
      )}

      {visualState === "error" && (
        <box paddingBottom={1}>
          <text fg={theme.red}>Error: {error}</text>
        </box>
      )}

      {(visualState === "suggestion" || visualState === "feedback") &&
        suggestion && (
          <box flexDirection="column" paddingBottom={1}>
            <text fg={theme.dimmed}>Suggested refinement:</text>
            <box
              border={["top", "bottom", "left", "right"]}
              borderColor={theme.border}
              paddingX={1}
            >
              <text fg={theme.fg}>{suggestion}</text>
            </box>
          </box>
        )}

      {visualState === "feedback" && (
        <box flexDirection="column" paddingBottom={1}>
          <text fg={theme.dimmed}>Why do you want to change it?</text>
          <box
            border={["top", "bottom", "left", "right"]}
            borderColor={theme.border}
            paddingX={1}
          >
            <input
              value={feedbackText}
              onChange={onFeedbackChange}
              placeholder="Enter your feedback..."
              focused={true}
            />
          </box>
        </box>
      )}

      <KeyBar bindings={bindings} />
    </box>
  );
}
