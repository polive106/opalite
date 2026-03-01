import { join, dirname } from "path";
import { homedir } from "os";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";

export interface AuthData {
  email: string;
  apiToken: string;
  displayName: string;
  username: string;
}

const BITBUCKET_API_BASE = "https://api.bitbucket.org";

export function getDefaultAuthPath(): string {
  return join(homedir(), ".config", "opalite", "auth.json");
}

export function validateTokenFormat(token: string): boolean {
  return token.startsWith("ATAT");
}

export function getAuthHeader(auth: AuthData): string {
  return `Basic ${btoa(`${auth.email}:${auth.apiToken}`)}`;
}

export async function saveAuthFile(
  auth: AuthData,
  path: string = getDefaultAuthPath()
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(auth, null, 2));
}

export async function loadAuthFile(
  path: string = getDefaultAuthPath()
): Promise<AuthData | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as AuthData;
  } catch {
    return null;
  }
}

export async function deleteAuthFile(
  path: string = getDefaultAuthPath()
): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // File doesn't exist, nothing to do
  }
}

export async function bbFetch(
  endpoint: string,
  auth: AuthData
): Promise<Response> {
  const url = `${BITBUCKET_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(auth),
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    throw new Error(
      "Your API token has expired. Run `opalite login` to add a new one."
    );
  }

  return response;
}
