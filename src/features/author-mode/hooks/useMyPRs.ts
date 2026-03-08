import { useQuery } from "@tanstack/react-query";
import { fetchOpenPRsForAllRepos, fetchPRComments } from "../../../services/bitbucket";
import { queryClient } from "../../../services/queryClient";
import { queryKeys } from "../../../services/queryKeys";
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
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.myPRs(workspace, repos, username),
    queryFn: async () => {
      const allPRs = await fetchOpenPRsForAllRepos(auth, workspace, repos);
      const filtered = filterMyPRs(allPRs, username);
      const counts = new Map<number, number>();
      await Promise.all(
        filtered.map(async (pr) => {
          const comments = await fetchPRComments(auth, workspace, pr.repo, pr.id);
          counts.set(pr.id, countUnresolved(comments));
        })
      );
      return { myPRs: filtered, unresolvedCounts: counts };
    },
    staleTime: 2 * 60 * 1000,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch PRs") : null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.myPRs(workspace, repos, username) });
  };

  return {
    myPRs: data?.myPRs ?? [],
    unresolvedCounts: data?.unresolvedCounts ?? new Map(),
    loading,
    error,
    refresh,
  };
}
