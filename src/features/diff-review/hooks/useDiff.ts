import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchDiffStatFiles,
  fetchPRDiff,
  type DiffStatFile,
} from "../../../services/bitbucket";
import { queryKeys } from "../../../services/queryKeys";
import type { AuthData } from "../../../services/auth";

export interface DiffFileContent {
  path: string;
  content: string;
}

export function parseDiffToFiles(rawDiff: string): DiffFileContent[] {
  if (!rawDiff.trim()) return [];

  const files: DiffFileContent[] = [];
  const diffHeaderRegex = /^diff --git a\/.+ b\/(.+)$/;
  const lines = rawDiff.split("\n");

  let currentPath: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(diffHeaderRegex);
    if (match) {
      if (currentPath !== null) {
        files.push({ path: currentPath, content: currentLines.join("\n") });
      }
      currentPath = match[1];
      currentLines = [line];
    } else if (currentPath !== null) {
      currentLines.push(line);
    }
  }

  if (currentPath !== null) {
    files.push({ path: currentPath, content: currentLines.join("\n") });
  }

  return files;
}

export interface UseDiffResult {
  files: DiffStatFile[];
  fileDiffs: DiffFileContent[];
  rawDiff: string;
  loading: boolean;
  error: string | null;
}

export function useDiff(
  auth: AuthData,
  workspace: string,
  repo: string,
  prId: number
): UseDiffResult {
  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.diff(workspace, repo, prId),
    queryFn: async () => {
      const [diffStatFiles, diff] = await Promise.all([
        fetchDiffStatFiles(auth, workspace, repo, prId),
        fetchPRDiff(auth, workspace, repo, prId),
      ]);
      return { files: diffStatFiles, rawDiff: diff, fileDiffs: parseDiffToFiles(diff) };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch diff") : null;

  return {
    files: data?.files ?? [],
    fileDiffs: data?.fileDiffs ?? [],
    rawDiff: data?.rawDiff ?? "",
    loading,
    error,
  };
}
