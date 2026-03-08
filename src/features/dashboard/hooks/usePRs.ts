import { useQuery } from "@tanstack/react-query";

export const DEFAULT_AUTO_REFRESH_INTERVAL = 120;
import { fetchOpenPRsForAllRepos } from "../../../services/bitbucket";
import { queryClient } from "../../../services/queryClient";
import { queryKeys } from "../../../services/queryKeys";
import type { AuthData } from "../../../services/auth";
import type { PR, RepoGroup } from "../../../types/review";

export function groupByRepo(prs: PR[]): RepoGroup[] {
  const map = new Map<string, PR[]>();
  for (const pr of prs) {
    const existing = map.get(pr.repo);
    if (existing) {
      existing.push(pr);
    } else {
      map.set(pr.repo, [pr]);
    }
  }

  const groups: RepoGroup[] = [];
  for (const [repo, repoPRs] of map) {
    groups.push({ repo, prs: sortPRsByAge(repoPRs) });
  }
  groups.sort((a, b) => a.repo.localeCompare(b.repo));
  return groups;
}

export function sortPRsByAge(prs: PR[]): PR[] {
  return [...prs].sort(
    (a, b) => b.createdOn.getTime() - a.createdOn.getTime()
  );
}

export function formatAge(created: Date, now: Date): string {
  const diffMs = now.getTime() - created.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 1) return `${diffDays}d`;
  if (diffHours >= 1) return `${diffHours}h`;
  return `${diffMinutes}m`;
}

export function getAgeColor(
  created: Date,
  now: Date,
  warningHours: number,
  criticalHours: number
): "green" | "yellow" | "red" {
  const diffHours =
    (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (diffHours >= criticalHours) return "red";
  if (diffHours >= warningHours) return "yellow";
  return "green";
}

export interface PRSummary {
  total: number;
  oldestAge: string;
  averageAge: string;
}

export function computeSummary(prs: PR[], now: Date): PRSummary {
  if (prs.length === 0) {
    return { total: 0, oldestAge: "0m", averageAge: "0m" };
  }

  const ages = prs.map((pr) => now.getTime() - pr.createdOn.getTime());
  const oldest = Math.max(...ages);
  const average = ages.reduce((sum, age) => sum + age, 0) / ages.length;

  const oldestDate = new Date(now.getTime() - oldest);
  const averageDate = new Date(now.getTime() - average);

  return {
    total: prs.length,
    oldestAge: formatAge(oldestDate, now),
    averageAge: formatAge(averageDate, now),
  };
}

export function formatLastFetch(fetchTime: Date, now: Date): string {
  const diffSeconds = Math.floor(
    (now.getTime() - fetchTime.getTime()) / 1000
  );
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  return `${diffMinutes} min ago`;
}

export interface UsePRsResult {
  prs: PR[];
  groups: RepoGroup[];
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  summary: PRSummary;
  refresh: () => void;
}

export function usePRs(
  auth: AuthData,
  workspace: string,
  repos: string[],
  autoRefreshInterval: number = DEFAULT_AUTO_REFRESH_INTERVAL
): UsePRsResult {
  const { data: prs = [], isLoading: loading, error: queryError, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.prs(workspace, repos),
    queryFn: () => fetchOpenPRsForAllRepos(auth, workspace, repos),
    staleTime: 2 * 60 * 1000,
    refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : false,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch PRs") : null;
  const lastFetch = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const now = new Date();
  const groups = groupByRepo(prs);
  const summary = computeSummary(prs, now);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.prs(workspace, repos) });
  };

  return {
    prs,
    groups,
    loading,
    error,
    lastFetch,
    summary,
    refresh,
  };
}
