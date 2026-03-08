import { theme } from "../../../theme/tokyo-night";
import { formatAge } from "../../dashboard/hooks/usePRs";
import { truncateContent } from "../hooks/useCommentQueue";
import type { Comment } from "../../../types/review";

export interface CommentRowData {
  id: number;
  number: number;
  author: string;
  location: string;
  content: string;
  displayContent: string;
  age: string;
  isInline: boolean;
  replyCount: number;
}

export function formatCommentRow(
  comment: Comment,
  index: number,
  now: Date,
  maxContentLength?: number
): CommentRowData {
  let location: string;
  if (comment.isInline && comment.filePath) {
    location = comment.lineNumber
      ? `${comment.filePath}:${comment.lineNumber}`
      : comment.filePath;
  } else {
    location = "General";
  }

  const displayContent = maxContentLength
    ? truncateContent(comment.content, maxContentLength)
    : comment.content;

  return {
    id: comment.id,
    number: index + 1,
    author: comment.author.nickname,
    location,
    content: comment.content,
    displayContent,
    age: formatAge(comment.createdOn, now),
    isInline: comment.isInline,
    replyCount: comment.replies.length,
  };
}

interface CommentRowProps {
  data: CommentRowData;
  selected: boolean;
  width: number;
}

export function CommentRow({ data, selected, width }: CommentRowProps) {
  const bgColor = selected ? theme.selection : undefined;

  return (
    <box
      flexDirection="column"
      width={width}
      backgroundColor={bgColor}
      paddingX={1}
      paddingY={0}
    >
      {/* Header: number, author, location, age */}
      <box flexDirection="row" width="100%">
        <text fg={theme.accent}>#{data.number} </text>
        <text fg={theme.comment}>{data.author}</text>
        <text fg={theme.dimmed}> on </text>
        <text fg={theme.fg}>{data.location}</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{data.age}</text>
      </box>
      {/* Comment content */}
      <box paddingLeft={3} width="100%">
        <text fg={theme.fg}>{data.displayContent}</text>
      </box>
      {/* Reply count if any */}
      {data.replyCount > 0 && (
        <box paddingLeft={3}>
          <text fg={theme.dimmed}>
            {data.replyCount} {data.replyCount === 1 ? "reply" : "replies"}
          </text>
        </box>
      )}
    </box>
  );
}
