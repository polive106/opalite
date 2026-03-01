import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchDiffStatFiles,
  fetchPRDiff,
  type DiffStatFile,
} from "../../../services/bitbucket";
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
  const [files, setFiles] = useState<DiffStatFile[]>([]);
  const [fileDiffs, setFileDiffs] = useState<DiffFileContent[]>([]);
  const [rawDiff, setRawDiff] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [diffStatFiles, diff] = await Promise.all([
        fetchDiffStatFiles(auth, workspace, repo, prId),
        fetchPRDiff(auth, workspace, repo, prId),
      ]);
      if (mountedRef.current) {
        setFiles(diffStatFiles);
        setRawDiff(diff);
        setFileDiffs(parseDiffToFiles(diff));
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch diff");
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

  return { files, fileDiffs, rawDiff, loading, error };
}
