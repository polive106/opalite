import { useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { useCommentQueue, buildCommentThread } from "../hooks/useCommentQueue";
import { useCommentQueueNavigation } from "../hooks/useCommentQueueNavigation";
import { CommentRow, formatCommentRow } from "../widgets/CommentRow";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import { RefreshIndicator } from "../../shared/widgets/RefreshIndicator";
import type { AuthData } from "../../../services/auth";
import type { PR, Comment } from "../../../types/review";
import type { Screen } from "../../../App";

const COMMENT_QUEUE_KEY_BINDINGS: KeyBinding[] = [
  { key: "\u2191\u2193", label: "navigate" },
  { key: "f", label: "fix" },
  { key: "F", label: "fix all" },
  { key: "r", label: "reply" },
  { key: "v", label: "resolve" },
  { key: "e", label: "copy prompt" },
  { key: "b", label: "back" },
  { key: "q", label: "quit" },
];

const REPLY_MODE_KEY_BINDINGS: KeyBinding[] = [
  { key: "\u23ce", label: "send" },
  { key: "Esc", label: "cancel" },
];

export interface CommentQueueScreenProps {
  auth: AuthData;
  workspace: string;
  pr: PR;
  navigate: (screen: Screen) => void;
  goBack: () => void;
}

export function CommentQueueScreen({
  auth,
  workspace,
  pr,
  navigate,
  goBack,
}: CommentQueueScreenProps) {
  const { width, height } = useTerminalDimensions();
  const {
    allComments,
    unresolvedComments,
    loading,
    error,
    resolving,
    replying,
    refresh,
    resolve,
    reply,
  } = useCommentQueue(auth, workspace, pr.repo, pr.id);

  const [replyText, setReplyText] = useState("");

  const { selectedIndex, replyMode, replyTarget } = useCommentQueueNavigation(
    unresolvedComments,
    {
      goBack,
      onFix: (comment) => {
        navigate({ name: "agent-fix", pr });
      },
      onBatchFix: () => {
        navigate({ name: "agent-fix", pr });
      },
      onResolve: async (commentId) => {
        await resolve(commentId);
      },
      onCopyPrompt: (_comment) => {
        // US-21 will implement clipboard export
      },
    }
  );

  const now = new Date();
  const contentWidth = Math.max(width - 2, 40);

  const handleReplySubmit = async () => {
    if (replyTarget && replyText.trim()) {
      await reply(replyTarget.id, replyText.trim());
      setReplyText("");
    }
  };

  if (loading && unresolvedComments.length === 0) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor={theme.bg}
      >
        <box flexDirection="row" paddingX={1} paddingY={1}>
          <text fg={theme.accent}>opalite</text>
          <box flexGrow={1} />
          <text fg={theme.dimmed}>Comment Queue</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.dimmed}>Loading comments...</text>
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
        <box flexDirection="row" paddingX={1} paddingY={1}>
          <text fg={theme.accent}>opalite</text>
          <box flexGrow={1} />
          <text fg={theme.dimmed}>Comment Queue</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.red}>{error}</text>
        </box>
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      {/* Header */}
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite</text>
        <box flexGrow={1} />
        <RefreshIndicator />
        <text fg={theme.dimmed}> Comment Queue</text>
      </box>

      {/* Subheader: PR info */}
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>
          #{pr.id} {pr.title}
        </text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>
          {unresolvedComments.length} unresolved
        </text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"\u2500".repeat(contentWidth)}</text>
      </box>

      {/* Comment list */}
      <scrollbox flexGrow={1} scrollY={true} paddingX={1}>
        {unresolvedComments.length === 0 ? (
          <box paddingY={1}>
            <text fg={theme.green}>All comments resolved!</text>
          </box>
        ) : (
          unresolvedComments.map((comment, index) => {
            const replies = buildCommentThread(allComments, comment.id);
            const commentWithReplies = { ...comment, replies };
            const data = formatCommentRow(
              commentWithReplies,
              index,
              now,
              contentWidth - 10
            );
            return (
              <box key={`comment-${comment.id}`} flexDirection="column">
                <CommentRow
                  data={data}
                  selected={index === selectedIndex}
                  width={contentWidth}
                />
                {index < unresolvedComments.length - 1 && (
                  <box paddingX={1}>
                    <text fg={theme.border}>
                      {"\u2500".repeat(Math.max(contentWidth - 2, 10))}
                    </text>
                  </box>
                )}
              </box>
            );
          })
        )}
      </scrollbox>

      {/* Reply editor (shown when in reply mode) */}
      {replyMode && replyTarget && (
        <box flexDirection="column" paddingX={1}>
          <box paddingX={1}>
            <text fg={theme.border}>{"\u2500".repeat(contentWidth)}</text>
          </box>
          <box flexDirection="row" paddingX={1}>
            <text fg={theme.comment}>Reply to #{replyTarget.id}: </text>
          </box>
          <box paddingX={1}>
            <input
              value={replyText}
              onChange={(val: string) => setReplyText(val)}
              onSubmit={handleReplySubmit}
              placeholder="Type your reply..."
              width={contentWidth - 2}
            />
          </box>
        </box>
      )}

      {/* Status bar */}
      {(resolving || replying) && (
        <box paddingX={1}>
          <text fg={theme.dimmed}>
            {resolving ? "Resolving comment..." : "Posting reply..."}
          </text>
        </box>
      )}

      {/* Summary */}
      <box paddingX={1}>
        <text fg={theme.border}>{"\u2500".repeat(contentWidth)}</text>
      </box>
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>
          {unresolvedComments.length} unresolved comment
          {unresolvedComments.length !== 1 ? "s" : ""}
        </text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{pr.repo}</text>
      </box>

      {/* KeyBar */}
      <KeyBar bindings={replyMode ? REPLY_MODE_KEY_BINDINGS : COMMENT_QUEUE_KEY_BINDINGS} />
    </box>
  );
}
