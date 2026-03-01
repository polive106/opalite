import { theme } from "../../../theme/tokyo-night";
import type { DiffStatFile } from "../../../services/bitbucket";

export interface FileTreeEntryData {
  filename: string;
  directory: string;
  fullPath: string;
  statusIndicator: string;
  linesAdded: number;
  linesRemoved: number;
  status: string;
  commentCount: number;
}

const STATUS_MAP: Record<string, string> = {
  modified: "M",
  added: "A",
  removed: "D",
  renamed: "R",
};

export function formatFileTreeEntry(file: DiffStatFile): FileTreeEntryData {
  const lastSlash = file.path.lastIndexOf("/");
  const filename = lastSlash >= 0 ? file.path.slice(lastSlash + 1) : file.path;
  const directory = lastSlash >= 0 ? file.path.slice(0, lastSlash + 1) : "";

  return {
    filename,
    directory,
    fullPath: file.path,
    statusIndicator: STATUS_MAP[file.status] ?? "M",
    linesAdded: file.linesAdded,
    linesRemoved: file.linesRemoved,
    status: file.status,
    commentCount: 0,
  };
}

export function formatFileTreeEntryWithComments(
  file: DiffStatFile,
  commentCounts: Record<string, number>
): FileTreeEntryData {
  const entry = formatFileTreeEntry(file);
  return {
    ...entry,
    commentCount: commentCounts[file.path] ?? 0,
  };
}

const STATUS_COLOR_MAP: Record<string, string> = {
  A: theme.green,
  D: theme.red,
  M: theme.yellow,
  R: theme.accent,
};

interface FileTreeProps {
  files: DiffStatFile[];
  selectedIndex: number;
  focused: boolean;
  height: number;
  commentCounts?: Record<string, number>;
}

export function FileTree({ files, selectedIndex, focused, height, commentCounts }: FileTreeProps) {
  const entries = commentCounts
    ? files.map((f) => formatFileTreeEntryWithComments(f, commentCounts))
    : files.map((f) => formatFileTreeEntry(f));

  return (
    <box flexDirection="column" height={height}>
      {entries.map((entry, i) => {
        const selected = i === selectedIndex;
        const bgColor = selected ? (focused ? theme.selection : theme.border) : undefined;
        const statusColor = STATUS_COLOR_MAP[entry.statusIndicator] ?? theme.dimmed;

        return (
          <box
            key={entry.fullPath}
            flexDirection="row"
            backgroundColor={bgColor}
            paddingX={1}
          >
            <text fg={statusColor}>{entry.statusIndicator} </text>
            <text fg={theme.dimmed}>{entry.directory}</text>
            <text fg={theme.fg}>{entry.filename}</text>
            {entry.commentCount > 0 && (
              <text fg={theme.comment}> [{entry.commentCount}]</text>
            )}
            <box flexGrow={1} />
            <text fg={theme.green}>+{entry.linesAdded}</text>
            <text fg={theme.dimmed}> </text>
            <text fg={theme.red}>-{entry.linesRemoved}</text>
          </box>
        );
      })}
    </box>
  );
}
