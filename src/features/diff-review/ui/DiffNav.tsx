import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { useDiff } from "../hooks/useDiff";
import { useComments } from "../hooks/useComments";
import { useDiffNavigation } from "../hooks/useDiffNavigation";
import { FileTree } from "../widgets/FileTree";
import { DiffHeader, formatDiffHeader } from "../widgets/DiffHeader";
import {
  CommentList,
  formatCommentThread,
} from "../widgets/CommentThread";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { PR } from "../../../types/review";

const DIFFNAV_KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "Tab", label: "switch panel" },
  { key: "n/N", label: "next/prev file" },
  { key: "u", label: "split/unified" },
  { key: "b", label: "back" },
  { key: "q", label: "quit" },
];

const FILE_TREE_WIDTH = 40;

export interface DiffNavProps {
  auth: AuthData;
  workspace: string;
  pr: PR;
  goBack: () => void;
}

export function DiffNav({ auth, workspace, pr, goBack }: DiffNavProps) {
  const { width, height } = useTerminalDimensions();
  const { files, fileDiffs, loading, error } = useDiff(
    auth,
    workspace,
    pr.repo,
    pr.id
  );
  const { grouped, fileCommentCounts, loading: commentsLoading } = useComments(
    auth,
    workspace,
    pr.repo,
    pr.id
  );
  const { focusPanel, selectedFileIndex, viewMode } = useDiffNavigation(
    files.length,
    goBack
  );

  const now = new Date();
  const headerData = formatDiffHeader(pr, now);

  const treeWidth = Math.min(FILE_TREE_WIDTH, Math.floor(width * 0.3));
  const diffWidth = width - treeWidth - 1;

  if (loading) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor={theme.bg}
      >
        <DiffHeader data={headerData} />
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.dimmed}>Loading diff...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor={theme.bg}
      >
        <DiffHeader data={headerData} />
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.red}>{error}</text>
        </box>
        <KeyBar bindings={DIFFNAV_KEY_BINDINGS} />
      </box>
    );
  }

  const selectedFileDiff = fileDiffs[selectedFileIndex]?.content ?? "";
  const selectedFilePath = files[selectedFileIndex]?.path;
  const contentHeight = height - 5;

  // Get inline comments for the currently selected file
  const selectedFileComments = selectedFilePath
    ? (grouped.fileComments[selectedFilePath] ?? [])
    : [];
  const selectedFileThreads = selectedFileComments.map((c) =>
    formatCommentThread(c, now)
  );

  // Format general comment threads
  const generalThreads = grouped.generalComments.map((c) =>
    formatCommentThread(c, now)
  );

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <DiffHeader data={headerData} />

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(Math.max(width - 2, 40))}</text>
      </box>

      <box flexDirection="row" flexGrow={1}>
        {/* File tree sidebar */}
        <box
          width={treeWidth}
          flexDirection="column"
          border={["right"]}
          borderColor={theme.border}
        >
          <box paddingX={1}>
            <text fg={theme.accent}>
              Files ({files.length})
            </text>
          </box>
          <scrollbox scrollY={true} flexGrow={1}>
            <FileTree
              files={files}
              selectedIndex={selectedFileIndex}
              focused={focusPanel === "tree"}
              height={contentHeight}
              commentCounts={fileCommentCounts}
            />
          </scrollbox>
        </box>

        {/* Diff viewer + comments */}
        <box
          flexGrow={1}
          flexDirection="column"
          width={diffWidth}
        >
          {files.length > 0 && (
            <box paddingX={1}>
              <text fg={theme.fg}>{selectedFilePath ?? ""}</text>
            </box>
          )}
          <scrollbox scrollY={true} flexGrow={1}>
            {selectedFileDiff ? (
              <box flexDirection="column">
                <diff diff={selectedFileDiff} view={viewMode} />
                {!commentsLoading && selectedFileThreads.length > 0 && (
                  <CommentList threads={selectedFileThreads} title="Inline Comments" />
                )}
              </box>
            ) : (
              <box paddingX={1} paddingY={1}>
                <text fg={theme.dimmed}>No diff to display</text>
              </box>
            )}
          </scrollbox>

          {/* General comments section */}
          {!commentsLoading && generalThreads.length > 0 && (
            <box border={["top"]} borderColor={theme.border}>
              <scrollbox scrollY={true} maxHeight={Math.floor(height * 0.3)}>
                <CommentList threads={generalThreads} title="General Comments" />
              </scrollbox>
            </box>
          )}
        </box>
      </box>

      <KeyBar bindings={DIFFNAV_KEY_BINDINGS} />
    </box>
  );
}
