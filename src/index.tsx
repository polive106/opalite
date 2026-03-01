#!/usr/bin/env bun

import { parseArgs, getVersion, getHelpText } from "./cli";
import { runLogin } from "./commands/login";
import { runLogout } from "./commands/logout";
import { runInit } from "./commands/init";
import { runUpdate, getUpdateMessage } from "./commands/update";
import { checkAuth } from "./commands/authGuard";
import { loadAuthFile } from "./services/auth";
import { loadConfig, mergeConfigs } from "./services/config";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";

const args = process.argv.slice(2);
const parsed = parseArgs(args);

switch (parsed.action) {
  case "version":
    console.log(`opalite v${getVersion()}`);
    process.exit(0);
    break;

  case "help":
    console.log(getHelpText());
    process.exit(0);
    break;

  case "unknown":
    console.error(`Unknown command: ${parsed.command}\n`);
    console.log(getHelpText());
    process.exit(1);
    break;

  case "command": {
    if (parsed.command === "login") {
      await runLogin();
      process.exit(0);
      break;
    }

    if (parsed.command === "logout") {
      await runLogout();
      process.exit(0);
      break;
    }

    // All other commands require authentication
    const authCheck = await checkAuth();
    if (!authCheck.authenticated) {
      console.error(authCheck.message);
      process.exit(1);
    }

    if (parsed.command === "update") {
      await runUpdate();
      process.exit(0);
      break;
    }

    if (parsed.command === "init") {
      await runInit();
      process.exit(0);
      break;
    }

    // Subcommands will be implemented in later stories
    console.log(`Command '${parsed.command}' is not yet implemented.`);
    process.exit(0);
    break;
  }

  case "run": {
    // Non-blocking update check on startup
    const updateNotice = getUpdateMessage();

    // TUI dashboard requires authentication
    const authCheck = await checkAuth();
    if (!authCheck.authenticated) {
      console.error(authCheck.message);
      process.exit(1);
    }

    // Show update notice if available (non-blocking — awaited after auth check)
    const notice = await updateNotice;
    if (notice) {
      console.log(notice);
    }

    // Load auth and config for TUI dashboard
    const auth = await loadAuthFile();
    if (!auth) {
      console.error("Failed to load auth. Run `opalite login` first.");
      process.exit(1);
      break;
    }

    const localConfig = await loadConfig();
    const sharedConfig = await loadConfig(".opalite.yml");
    const config = mergeConfigs(localConfig, sharedConfig);

    if (!config.workspace || config.repos.length === 0) {
      console.error("No workspace or repos configured. Run `opalite init` first.");
      process.exit(1);
      break;
    }

    // Launch TUI dashboard
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      useAlternateScreen: true,
    });
    createRoot(renderer).render(
      <App
        auth={auth}
        workspace={config.workspace}
        repos={config.repos}
        autoRefreshInterval={config.autoRefreshInterval}
      />
    );
    break;
  }
}
