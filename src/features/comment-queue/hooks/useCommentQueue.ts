import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPRComments, resolveComment, postPRComment } from "../../../services/bitbucket";
import type { AuthData } from "../../../services/auth";
import type { Comment } from "../../../types/review";

export function filterUnresolved(comments: Comment[]): Comment[] {
  return comments.filter((c) => !c.resolved && c.parentId === undefined);
}

export function buildCommentThread(comments: Comment[], parentId: number): Comment[] {
  return comments.filter((c) => c.parentId === parentId);
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 1) + "\u2026";
}

export interface UseCommentQueueResult {
  allComments: Comment[];
  unresolvedComments: Comment[];
  loading: boolean;
  error: string | null;
  resolving: boolean;
  replying: boolean;
  refresh: () => void;
  resolve: (commentId: number) => Promise<void>;
  reply: (commentId: number, content: string) => Promise<void>;
}

export function useCommentQueue(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): UseCommentQueueResult {
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [replying, setReplying] = useState(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const comments = await fetchPRComments(auth, workspace, repoSlug, prId);
      if (mountedRef.current) {
        setAllComments(comments);
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
  }, [auth, workspace, repoSlug, prId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const resolveCommentHandler = useCallback(async (commentId: number) => {
    setResolving(true);
    try {
      await resolveComment(auth, workspace, repoSlug, prId, commentId);
      if (mountedRef.current) {
        await fetchData();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to resolve comment");
      }
    } finally {
      if (mountedRef.current) {
        setResolving(false);
      }
    }
  }, [auth, workspace, repoSlug, prId, fetchData]);

  const replyHandler = useCallback(async (commentId: number, content: string) => {
    setReplying(true);
    try {
      await postPRComment(auth, workspace, repoSlug, prId, {
        content,
        parentId: commentId,
      });
      if (mountedRef.current) {
        await fetchData();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to post reply");
      }
    } finally {
      if (mountedRef.current) {
        setReplying(false);
      }
    }
  }, [auth, workspace, repoSlug, prId, fetchData]);

  const unresolvedComments = filterUnresolved(allComments);

  return {
    allComments,
    unresolvedComments,
    loading,
    error,
    resolving,
    replying,
    refresh: fetchData,
    resolve: resolveCommentHandler,
    reply: replyHandler,
  };
}
