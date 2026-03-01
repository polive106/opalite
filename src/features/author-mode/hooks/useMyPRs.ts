import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOpenPRsForAllRepos, fetchPRComments } from "../../../services/bitbucket";
import type { AuthData } from "../../../services/auth";
import type { PR, Comment } from "../../../types/review";

export interface ReviewerSummary {
  approved: number;
  changesRequested: number;
  pending: number;
}

export function filterMyPRs(prs: PR[], username: string): PR[] {
  return prs.filter((pr) => pr.author.nickname === username);
}

export function countUnresolved(comments: Comment[]): number {
  return comments.filter((c) => !c.resolved && c.parentId === undefined).length;
}

export function getReviewerSummary(pr: PR): ReviewerSummary {
  const reviewers = pr.participants.filter((p) => p.role === "REVIEWER");
  return {
    approved: reviewers.filter((r) => r.state === "approved").length,
    changesRequested: reviewers.filter((r) => r.state === "changes_requested").length,
    pending: reviewers.filter((r) => r.state === null).length,
  };
}

export interface UseMyPRsResult {
  myPRs: PR[];
  unresolvedCounts: Map<number, number>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMyPRs(
  auth: AuthData,
  workspace: string,
  repos: string[],
  username: string
): UseMyPRsResult {
  const [myPRs, setMyPRs] = useState<PR[]>([]);
  const [unresolvedCounts, setUnresolvedCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allPRs = await fetchOpenPRsForAllRepos(auth, workspace, repos);
      const filtered = filterMyPRs(allPRs, username);
      if (!mountedRef.current) return;
      setMyPRs(filtered);

      // Fetch unresolved comment counts for each PR
      const counts = new Map<number, number>();
      await Promise.all(
        filtered.map(async (pr) => {
          const comments = await fetchPRComments(auth, workspace, pr.repo, pr.id);
          counts.set(pr.id, countUnresolved(comments));
        })
      );
      if (mountedRef.current) {
        setUnresolvedCounts(counts);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch PRs");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [auth, workspace, repos.join(","), username]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  return { myPRs, unresolvedCounts, loading, error, refresh: fetchData };
}
