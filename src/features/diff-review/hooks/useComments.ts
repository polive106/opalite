import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPRComments } from "../../../services/bitbucket";
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPRComments(auth, workspace, repo, prId);
      if (mountedRef.current) {
        setComments(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch comments");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [auth, workspace, repo, prId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const threads = buildCommentThreads(comments);
  const grouped = groupCommentsByFile(threads);
  const fileCommentCounts = getFileCommentCounts(comments);

  return { comments, threads, grouped, fileCommentCounts, loading, error, refresh: fetchData };
}
