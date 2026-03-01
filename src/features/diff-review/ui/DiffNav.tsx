import { useState, useCallback } from "react";
import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { useDiff } from "../hooks/useDiff";
import { useComments } from "../hooks/useComments";
import { handleDiffNavKey } from "../hooks/useDiffNavigation";
import { useCommentEditor, handleCommentEditorKey } from "../hooks/useCommentEditor";
import { FileTree } from "../widgets/FileTree";
import { DiffHeader, formatDiffHeader } from "../widgets/DiffHeader";
import {
  CommentList,
  formatCommentThread,
} from "../widgets/CommentThread";
import {
  CommentEditor,
  formatEditorHeader,
  formatEditorStatus,
} from "../widgets/CommentEditor";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { PR } from "../../../types/review";
import type { FocusPanel, ViewMode } from "../hooks/useDiffNavigation";

const DIFFNAV_KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "Tab", label: "switch panel" },
  { key: "n/N", label: "next/prev file" },
  { key: "c", label: "comment" },
  { key: "r", label: "reply" },
  { key: "u", label: "split/unified" },
  { key: "b", label: "back" },
  { key: "q", label: "quit" },
];

const FILE_TREE_WIDTH = 40;
const DEFAULT_COMMENT_LINE = 1;

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
  const { grouped, fileCommentCounts, loading: commentsLoading, refresh: refreshComments } = useComments(
    auth,
    workspace,
    pr.repo,
    pr.id
  );

  const editor = useCommentEditor(auth, workspace, pr.repo, pr.id);

  const [focusPanel, setFocusPanel] = useState<FocusPanel>("tree");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  useKeyboard((e) => {
    if (editor.editorState.isOpen) {
      if (e.name === "Escape") {
        editor.close();
      }
      // Tab → AI suggestion stub (US-19 will implement the actual agent call)
      handleCommentEditorKey(e.name);
      return;
    }

    const result = handleDiffNavKey(
      e.name,
      { focusPanel, selectedFileIndex, viewMode },
      files.length
    );

    switch (result.action) {
      case "toggle-focus":
        setFocusPanel(result.panel);
        break;
      case "select-file":
        setSelectedFileIndex(result.index);
        break;
      case "toggle-view-mode":
        setViewMode(result.mode);
        break;
      case "open-comment-editor": {
        const filePath = files[selectedFileIndex]?.path;
        if (filePath) {
          editor.openInline(filePath, DEFAULT_COMMENT_LINE);
        }
        break;
      }
      case "open-reply-editor": {
        const filePath = files[selectedFileIndex]?.path;
        const fileComments = filePath ? (grouped.fileComments[filePath] ?? []) : [];
        const firstThread = fileComments[0];
        if (firstThread) {
          editor.openReply(firstThread.id);
        } else {
          const firstGeneral = grouped.generalComments[0];
          if (firstGeneral) {
            editor.openReply(firstGeneral.id);
          }
        }
        break;
      }
      case "back":
        goBack();
        break;
      case "quit":
        process.exit(0);
        break;
    }
  });

  const handleSubmit = useCallback(async () => {
    if (editor.editorState.text.trim() === "") return;
    const result = await editor.submit();
    if (result) {
      await refreshComments();
    }
  }, [editor.editorState.text, editor.submit, refreshComments]);

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

  // Comment editor formatting
  const editorHeader = editor.editorState.isOpen
    ? formatEditorHeader(
        editor.editorState.mode,
        editor.editorState.filePath,
        editor.editorState.lineNumber
      )
    : "";
  const editorStatus = formatEditorStatus(
    editor.editorState.submitting,
    editor.editorState.error
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

          {/* Comment editor */}
          {editor.editorState.isOpen && (
            <CommentEditor
              header={editorHeader}
              text={editor.editorState.text}
              status={editorStatus}
              onTextChange={editor.setText}
              onSubmit={handleSubmit}
              onCancel={editor.close}
            />
          )}

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
