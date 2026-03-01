#!/usr/bin/env bun

import { parseArgs, getVersion, getHelpText } from "./cli";
import { runLogin } from "./commands/login";
import { runLogout } from "./commands/logout";
import { runInit } from "./commands/init";
import { runUpdate, getUpdateMessage } from "./commands/update";
import { checkAuth } from "./commands/authGuard";

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

    // TUI dashboard will be implemented in US-5+
    console.log("opalite — review dashboard coming soon.");
    process.exit(0);
    break;
  }
}
