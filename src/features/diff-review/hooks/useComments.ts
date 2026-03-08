import { useQuery } from "@tanstack/react-query";
import { fetchPRComments } from "../../../services/bitbucket";
import { queryClient } from "../../../services/queryClient";
import { queryKeys } from "../../../services/queryKeys";
import type { AuthData } from "../../../services/auth";
import type { Comment } from "../../../types/review";

export interface GroupedComments {
  generalComments: Comment[];
  fileComments: Record<string, Comment[]>;
}

export function buildCommentThreads(comments: Comment[]): Comment[] {
  const commentMap = new Map<number, Comment>();
  const topLevel: Comment[] = [];

  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = commentMap.get(comment.id)!;
    if (comment.parentId !== undefined) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        topLevel.push(node);
      }
    } else {
      topLevel.push(node);
    }
  }

  return topLevel;
}

export function groupCommentsByFile(comments: Comment[]): GroupedComments {
  const generalComments: Comment[] = [];
  const fileComments: Record<string, Comment[]> = {};

  for (const comment of comments) {
    if (comment.isInline && comment.filePath) {
      if (!fileComments[comment.filePath]) {
        fileComments[comment.filePath] = [];
      }
      fileComments[comment.filePath].push(comment);
    } else {
      generalComments.push(comment);
    }
  }

  return { generalComments, fileComments };
}

export function getFileCommentCounts(comments: Comment[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const comment of comments) {
    if (comment.isInline && comment.filePath) {
      counts[comment.filePath] = (counts[comment.filePath] ?? 0) + 1;
    }
  }

  return counts;
}

export interface UseCommentsResult {
  comments: Comment[];
  threads: Comment[];
  grouped: GroupedComments;
  fileCommentCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useComments(
  auth: AuthData,
  workspace: string,
  repo: string,
  prId: number
): UseCommentsResult {
  const { data: comments = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.comments(workspace, repo, prId),
    queryFn: () => fetchPRComments(auth, workspace, repo, prId),
    staleTime: 1 * 60 * 1000,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch comments") : null;

  const threads = buildCommentThreads(comments);
  const grouped = groupCommentsByFile(threads);
  const fileCommentCounts = getFileCommentCounts(comments);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.comments(workspace, repo, prId) });
  };

  return { comments, threads, grouped, fileCommentCounts, loading, error, refresh };
}
