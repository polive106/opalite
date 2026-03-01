import { bbFetch, type AuthData, type BbFetchOptions } from "./auth";
import type { BitbucketPR, BitbucketComment, PaginatedResponse } from "../types/bitbucket";
import type { PR, Comment } from "../types/review";

export interface DiffStatEntry {
  lines_added: number;
  lines_removed: number;
  status: string;
}

export interface DiffStatFile {
  path: string;
  status: string;
  linesAdded: number;
  linesRemoved: number;
}

interface DiffStatRawEntry {
  lines_added: number;
  lines_removed: number;
  status: string;
  old: { path: string } | null;
  new: { path: string } | null;
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
    participants: (bbPR.participants ?? []).map((p) => ({
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

export async function fetchDiffStatFiles(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<DiffStatFile[]> {
  try {
    const files: DiffStatFile[] = [];
    let endpoint: string | undefined =
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diffstat`;

    while (endpoint) {
      const response = await bbFetch(endpoint, auth);
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as PaginatedResponse<DiffStatRawEntry>;
      for (const entry of data.values) {
        const path = entry.new?.path ?? entry.old?.path ?? "unknown";
        files.push({
          path,
          status: entry.status,
          linesAdded: entry.lines_added,
          linesRemoved: entry.lines_removed,
        });
      }
      endpoint = data.next;
      if (endpoint && endpoint.startsWith("http")) {
        const parsed = new URL(endpoint);
        endpoint = parsed.pathname + parsed.search;
      }
    }

    return files;
  } catch {
    return [];
  }
}

export async function fetchPRDiff(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<string> {
  try {
    const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diff`;
    const response = await bbFetch(endpoint, auth);
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  }
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
  const errors: Error[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allPRs.push(...result.value);
    } else {
      errors.push(
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
      );
    }
  }

  if (allPRs.length === 0 && errors.length > 0) {
    throw errors[0];
  }

  return allPRs;
}

function toDomainComment(bb: BitbucketComment): Comment {
  return {
    id: bb.id,
    author: {
      displayName: bb.user.display_name,
      nickname: bb.user.nickname,
    },
    content: bb.content.raw,
    createdOn: new Date(bb.created_on),
    isInline: bb.inline !== undefined,
    filePath: bb.inline?.path,
    lineNumber: bb.inline?.to ?? bb.inline?.from,
    resolved: bb.resolved ?? false,
    deleted: bb.deleted,
    parentId: bb.parent?.id,
    replies: [],
  };
}

export interface PostCommentInput {
  content: string;
  inline?: { path: string; to: number };
  parentId?: number;
}

export async function postPRComment(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number,
  input: PostCommentInput
): Promise<Comment> {
  const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

  const body: Record<string, unknown> = {
    content: { raw: input.content },
  };

  if (input.inline) {
    body.inline = { path: input.inline.path, to: input.inline.to };
  }

  if (input.parentId !== undefined) {
    body.parent = { id: input.parentId };
  }

  const response = await bbFetch(endpoint, auth, { method: "POST", body });

  if (!response.ok) {
    throw new Error(`Failed to post comment (HTTP ${response.status}).`);
  }

  const data = (await response.json()) as BitbucketComment;
  return toDomainComment(data);
}

export async function approvePR(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<void> {
  const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/approve`;
  const response = await bbFetch(endpoint, auth, { method: "POST" });

  if (!response.ok) {
    throw new Error(`Failed to approve PR (HTTP ${response.status}).`);
  }
}

export async function requestChangesPR(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<void> {
  const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/request-changes`;
  const response = await bbFetch(endpoint, auth, { method: "POST" });

  if (!response.ok) {
    throw new Error(`Failed to request changes on PR (HTTP ${response.status}).`);
  }
}

export async function unapprovePR(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<void> {
  const endpoint = `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/approve`;
  const response = await bbFetch(endpoint, auth, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Failed to unapprove PR (HTTP ${response.status}).`);
  }
}

export async function fetchPRComments(
  auth: AuthData,
  workspace: string,
  repoSlug: string,
  prId: number
): Promise<Comment[]> {
  try {
    const allComments: BitbucketComment[] = [];
    let endpoint: string | undefined =
      `/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;

    while (endpoint) {
      const response = await bbFetch(endpoint, auth);
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as PaginatedResponse<BitbucketComment>;
      allComments.push(...data.values);
      endpoint = data.next;
      if (endpoint && endpoint.startsWith("http")) {
        const parsed = new URL(endpoint);
        endpoint = parsed.pathname + parsed.search;
      }
    }

    return allComments
      .filter((c) => !c.deleted)
      .map(toDomainComment);
  } catch (err) {
    if (err instanceof Error && err.message.includes("opalite login")) {
      throw err;
    }
    return [];
  }
}
