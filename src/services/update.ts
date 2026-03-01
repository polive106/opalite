import packageJson from "../../package.json";

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
}

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/polive106/opalite/releases/latest";
const TIMEOUT_MS = 2000;

export function getCurrentVersion(): string {
  return packageJson.version;
}

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const c = currentParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

export async function checkForUpdate(
  currentVersion: string = getCurrentVersion()
): Promise<UpdateCheckResult | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { tag_name: string };
    const latestVersion = data.tag_name.replace(/^v/, "");
    const updateAvailable = compareVersions(currentVersion, latestVersion);

    return {
      updateAvailable,
      latestVersion,
      currentVersion,
    };
  } catch {
    return null;
  }
}

export function formatUpdateNotice(result: UpdateCheckResult): string {
  return `opalite v${result.latestVersion} available (current: v${result.currentVersion}) — run 'opalite update' to upgrade`;
}
