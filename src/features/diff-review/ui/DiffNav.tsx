import { useState, useCallback } from "react";
import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { postPRComment, type PostCommentInput } from "../../../services/bitbucket";
import { useDiff } from "../hooks/useDiff";
import { useComments } from "../hooks/useComments";
import { handleDiffNavKey } from "../hooks/useDiffNavigation";
import { useCommentEditor, handleCommentEditorKey } from "../hooks/useCommentEditor";
import {
  useCommentRefinement,
  handleRefinementKey,
  type RefinementContext,
} from "../hooks/useCommentRefinement";
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
import {
  CommentRefinement,
  formatRefinementHeader,
} from "../widgets/CommentRefinement";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { OpaliteConfig } from "../../../services/config";
import type { PR } from "../../../types/review";
import type { Screen } from "../../../App";
import type { FocusPanel, ViewMode } from "../hooks/useDiffNavigation";

const DIFFNAV_KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "Tab", label: "switch panel" },
  { key: "n/N", label: "next/prev file" },
  { key: "c", label: "comment" },
  { key: "r", label: "reply" },
  { key: "a", label: "approve" },
  { key: "x", label: "request changes" },
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
  config?: OpaliteConfig;
  goBack: () => void;
  navigate?: (screen: Screen) => void;
}

export function DiffNav({ auth, workspace, pr, config, goBack, navigate }: DiffNavProps) {
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

  const defaultConfig: OpaliteConfig = config ?? { workspace, repos: [] };
  const refinement = useCommentRefinement(defaultConfig);

  const [focusPanel, setFocusPanel] = useState<FocusPanel>("tree");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const refinementActive = refinement.state.status !== "idle";

  // Post a comment to Bitbucket and refresh
  const postAndRefresh = useCallback(async (text: string) => {
    const input: PostCommentInput = { content: text };

    const editorState = editor.editorState;
    if (editorState.filePath !== undefined && editorState.lineNumber !== undefined) {
      input.inline = { path: editorState.filePath, to: editorState.lineNumber };
    }
    if (editorState.parentCommentId !== undefined) {
      input.parentId = editorState.parentCommentId;
    }

    await postPRComment(auth, workspace, pr.repo, pr.id, input);
    await refreshComments();
  }, [auth, workspace, pr.repo, pr.id, editor.editorState, refreshComments]);

  useKeyboard((e) => {
    // Refinement active — handle refinement keys
    if (refinementActive) {
      const action = handleRefinementKey(e.name, refinement.state.status, feedbackMode);

      switch (action.action) {
        case "accept": {
          const result = refinement.accept();
          postAndRefresh(result.text);
          editor.close();
          break;
        }
        case "skip": {
          const result = refinement.skip();
          postAndRefresh(result.text);
          editor.close();
          break;
        }
        case "edit": {
          const result = refinement.edit();
          editor.setText(result.text);
          // Editor stays open with refined text for manual tweaking
          break;
        }
        case "enter-feedback":
          setFeedbackMode(true);
          setFeedbackText("");
          break;
        case "send-feedback":
          if (feedbackText.trim() !== "") {
            refinement.reject(feedbackText.trim());
            setFeedbackMode(false);
            setFeedbackText("");
          }
          break;
        case "exit-feedback":
          setFeedbackMode(false);
          setFeedbackText("");
          break;
        case "cancel":
          refinement.cancel();
          editor.close();
          setFeedbackMode(false);
          setFeedbackText("");
          break;
      }
      return;
    }

    // Editor open — handle editor keys
    if (editor.editorState.isOpen) {
      const editorAction = handleCommentEditorKey(e.name);
      if (editorAction.action === "close") {
        editor.close();
      }
      return;
    }

    // Normal DiffNav keys
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
      case "approve":
        navigate?.({ name: "review-submit", pr, initialAction: "approve" });
        break;
      case "request-changes":
        navigate?.({ name: "review-submit", pr, initialAction: "request-changes" });
        break;
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

    // If agent is configured, start refinement instead of posting directly
    const draft = editor.getDraftData();
    const selectedFilePath = files[selectedFileIndex]?.path;
    const fileDiffContent = fileDiffs[selectedFileIndex]?.content ?? "";
    const existingComments = selectedFilePath
      ? (grouped.fileComments[selectedFilePath] ?? [])
      : [];

    const context: RefinementContext = {
      filePath: draft.filePath ?? selectedFilePath ?? "",
      lineNumber: draft.lineNumber,
      prId: pr.id,
      prTitle: pr.title,
      sourceBranch: pr.sourceBranch,
      destinationBranch: pr.destinationBranch,
      fileDiff: fileDiffContent,
      existingComments,
    };

    const result = await refinement.refine(draft.text, context);

    if (result) {
      // No agent configured — post directly (graceful degradation)
      await postAndRefresh(result.text);
      editor.close();
    }
    // If result is null, refinement widget is now showing — user must act
  }, [
    editor.editorState.text,
    editor.getDraftData,
    files,
    selectedFileIndex,
    fileDiffs,
    grouped.fileComments,
    pr,
    refinement.refine,
    postAndRefresh,
    editor.close,
  ]);

  const now = new Date();
  const headerData = formatDiffHeader(pr, now);

  const treeWidth = Math.min(FILE_TREE_WIDTH, Math.floor(width * 0.3));
  const diffWidth = width - treeWidth - 1;

  if (loading && files.length === 0) {
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

  // Refinement widget props
  const refinementHeader = refinementActive
    ? formatRefinementHeader(
        editor.editorState.filePath,
        editor.editorState.lineNumber
      )
    : "";

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
              {`Files (${files.length})`}
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

          {/* Comment refinement widget — replaces editor when active */}
          {refinementActive && (
            <CommentRefinement
              header={refinementHeader}
              draft={refinement.state.draft ?? ""}
              suggestion={refinement.state.suggestion ?? undefined}
              loading={refinement.state.status === "loading"}
              error={refinement.state.error ?? undefined}
              feedbackMode={feedbackMode}
              feedbackText={feedbackText}
              onFeedbackChange={setFeedbackText}
            />
          )}

          {/* Comment editor — hidden when refinement is active */}
          {editor.editorState.isOpen && !refinementActive && (
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
