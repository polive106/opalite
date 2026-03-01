import {
  checkForUpdate,
  formatUpdateNotice,
  getCurrentVersion,
} from "../services/update";

export type UpdateActionResult =
  | { success: true; output: string }
  | { success: false; error: string };

export async function getUpdateMessage(
  currentVersion: string = getCurrentVersion()
): Promise<string | null> {
  const result = await checkForUpdate(currentVersion);

  if (!result || !result.updateAvailable) {
    return null;
  }

  return formatUpdateNotice(result);
}

export async function runUpdateAction(): Promise<UpdateActionResult> {
  try {
    const proc = Bun.spawn(["bash", "-c", "curl -fsSL https://raw.githubusercontent.com/polive106/opalite/main/install.sh | bash"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      return {
        success: false,
        error: `Update failed (exit code ${exitCode}): ${stderr}`.trim(),
      };
    }

    return {
      success: true,
      output: stdout.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export async function runUpdate(): Promise<void> {
  console.log("Checking for updates...");

  const result = await checkForUpdate();

  if (!result) {
    console.error("Failed to check for updates. Please check your internet connection.");
    process.exit(1);
    return;
  }

  if (!result.updateAvailable) {
    console.log(`Already on the latest version (v${result.currentVersion}).`);
    return;
  }

  console.log(`Updating from v${result.currentVersion} to v${result.latestVersion}...`);

  const updateResult = await runUpdateAction();

  if (updateResult.success) {
    if (updateResult.output) {
      console.log(updateResult.output);
    }
    console.log(`Successfully updated to v${result.latestVersion}.`);
  } else {
    console.error(`Error: ${updateResult.error}`);
    process.exit(1);
  }
}
