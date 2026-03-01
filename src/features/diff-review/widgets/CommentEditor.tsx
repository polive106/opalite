import { theme } from "../../../theme/tokyo-night";
import type { CommentEditorMode } from "../hooks/useCommentEditor";

export interface EditorStatusData {
  text: string;
  isError: boolean;
}

export function formatEditorHeader(
  mode: CommentEditorMode,
  filePath?: string,
  lineNumber?: number
): string {
  if (mode === "reply") {
    return "Reply to comment";
  }

  if (filePath && lineNumber !== undefined) {
    return `Comment on ${filePath}:${lineNumber}`;
  }

  if (filePath) {
    return `Comment on ${filePath}`;
  }

  return "New comment";
}

export function formatEditorStatus(
  submitting: boolean,
  error: string | null
): EditorStatusData {
  if (submitting) {
    return { text: "Posting...", isError: false };
  }

  if (error) {
    return { text: `${error} · Enter retry · Esc cancel`, isError: true };
  }

  return { text: "Enter submit · Esc cancel", isError: false };
}

export interface CommentEditorProps {
  header: string;
  text: string;
  status: EditorStatusData;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CommentEditor({
  header,
  text,
  status,
  onTextChange,
  onSubmit,
}: CommentEditorProps) {
  return (
    <box
      flexDirection="column"
      border={["top", "bottom"]}
      borderColor={theme.accent}
      paddingX={1}
      paddingY={0}
    >
      <box paddingBottom={0}>
        <text fg={theme.accent}>{header}</text>
      </box>
      <input
        value={text}
        onChange={onTextChange}
        onSubmit={() => onSubmit()}
        placeholder="Type your comment..."
        focused={true}
      />
      <box paddingTop={0}>
        <text fg={status.isError ? theme.red : theme.dimmed}>
          {status.text}
        </text>
      </box>
    </box>
  );
}
