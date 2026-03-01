import { theme } from "../../../theme/tokyo-night";
import type { Comment } from "../../../types/review";

export interface CommentData {
  id: number;
  author: string;
  content: string;
  age: string;
  resolved: boolean;
  filePath?: string;
  lineNumber?: number;
}

export interface CommentThreadData {
  parent: CommentData;
  replies: CommentData[];
  replyCount: number;
}

export function formatCommentAge(createdOn: Date, now: Date): string {
  const diffMs = now.getTime() - createdOn.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return `${diffMinutes}m`;
}

export function formatComment(comment: Comment, now: Date): CommentData {
  return {
    id: comment.id,
    author: comment.author.nickname,
    content: comment.content,
    age: formatCommentAge(comment.createdOn, now),
    resolved: comment.resolved,
    filePath: comment.filePath,
    lineNumber: comment.lineNumber,
  };
}

export function formatCommentThread(thread: Comment, now: Date): CommentThreadData {
  return {
    parent: formatComment(thread, now),
    replies: thread.replies.map((r) => formatComment(r, now)),
    replyCount: thread.replies.length,
  };
}

interface CommentItemProps {
  data: CommentData;
  indent?: boolean;
}

function CommentItem({ data, indent }: CommentItemProps) {
  const paddingLeft = indent ? 4 : 2;
  return (
    <box flexDirection="column" paddingLeft={paddingLeft} paddingBottom={1}>
      <box flexDirection="row">
        <text fg={theme.accent}>{data.author}</text>
        <text fg={theme.dimmed}> · {data.age}</text>
        {data.resolved && <text fg={theme.green}> [resolved]</text>}
      </box>
      <box paddingLeft={1}>
        <text fg={theme.fg}>{data.content}</text>
      </box>
    </box>
  );
}

interface CommentThreadProps {
  data: CommentThreadData;
}

export function CommentThread({ data }: CommentThreadProps) {
  return (
    <box flexDirection="column">
      <CommentItem data={data.parent} />
      {data.replies.map((reply) => (
        <CommentItem key={reply.id} data={reply} indent={true} />
      ))}
    </box>
  );
}

interface CommentListProps {
  threads: CommentThreadData[];
  title: string;
}

export function CommentList({ threads, title }: CommentListProps) {
  if (threads.length === 0) return null;

  return (
    <box flexDirection="column" paddingY={1}>
      <box paddingX={1}>
        <text fg={theme.comment}>
          {`${title} (${threads.length})`}
        </text>
      </box>
      {threads.map((thread) => (
        <CommentThread key={thread.parent.id} data={thread} />
      ))}
    </box>
  );
}
