import { bbFetch, type AuthData } from "./auth";
import type { BitbucketPR, PaginatedResponse } from "../types/bitbucket";
import type { PR } from "../types/review";

export interface DiffStatEntry {
  lines_added: number;
  lines_removed: number;
  status: string;
}

function toDomainPR(
  bbPR: BitbucketPR,
  repoSlug: string,
  diffStat: { filesChanged: number; linesAdded: number; linesRemoved: number }
): PR {
  return {
    id: bbPR.id,
    title: bbPR.title,
    description: bbPR.description,
    sourceBranch: bbPR.source.branch.name,
    destinationBranch: bbPR.destination.branch.name,
    author: {
      displayName: bbPR.author.display_name,
      nickname: bbPR.author.nickname,
    },
    repo: repoSlug,
    commentCount: bbPR.comment_count,
    createdOn: new Date(bbPR.created_on),
    updatedOn: new Date(bbPR.updated_on),
    filesChanged: diffStat.filesChanged,
    linesAdded: diffStat.linesAdded,
    linesRemoved: diffStat.linesRemoved,
    url: bbPR.links.html.href,
    participants: bbPR.participants.map((p) => ({
      displayName: p.user.display_name,
      nickname: p.user.nickname,
      role: p.role,
      approved: p.approved,
      state: p.state,
    })),
  };
}

async function fetchDiffStat(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<{ filesChanged: number; linesAdded: number; linesRemoved: number }> {
  try {
    const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diffstat`;
    const response = await bbFetch(endpoint, auth);
    if (!response.ok) {
      return { filesChanged: 0, linesAdded: 0, linesRemoved: 0 };
    }
    const data = (await response.json()) as PaginatedResponse<DiffStatEntry>;
    let linesAdded = 0;
    let linesRemoved = 0;
    for (const entry of data.values) {
      linesAdded += entry.lines_added;
      linesRemoved += entry.lines_removed;
    }
    return { filesChanged: data.values.length, linesAdded, linesRemoved };
  } catch {
    return { filesChanged: 0, linesAdded: 0, linesRemoved: 0 };
  }
}

export async function fetchOpenPRs(
  auth: AuthData,
  workspace: string,
  repoSlug: string
): Promise<PR[]> {
  const allPRs: BitbucketPR[] = [];
  let endpoint: string | undefined =
    `/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=OPEN`;

  while (endpoint) {
    const response = await bbFetch(endpoint, auth);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch PRs for ${repoSlug} (HTTP ${response.status}).`
      );
    }
    const data = (await response.json()) as PaginatedResponse<BitbucketPR>;
    allPRs.push(...data.values);
    endpoint = data.next;
    if (endpoint && endpoint.startsWith("http")) {
      const parsed = new URL(endpoint);
      endpoint = parsed.pathname + parsed.search;
    }
  }

  const prs = await Promise.all(
    allPRs.map(async (bbPR) => {
      const diffStat = await fetchDiffStat(auth, workspace, repoSlug, bbPR.id);
      return toDomainPR(bbPR, repoSlug, diffStat);
    })
  );

  return prs;
}

export async function fetchOpenPRsForAllRepos(
  auth: AuthData,
  workspace: string,
  repos: string[]
): Promise<PR[]> {
  if (repos.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    repos.map((repo) => fetchOpenPRs(auth, workspace, repo))
  );

  const allPRs: PR[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allPRs.push(...result.value);
    }
  }

  return allPRs;
}
