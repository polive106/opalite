#!/usr/bin/env bun

import { parseArgs, getVersion, getHelpText } from "./cli";

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

  case "command":
    // Subcommands will be implemented in later stories (US-2, US-3, US-4)
    console.log(`Command '${parsed.command}' is not yet implemented.`);
    process.exit(0);
    break;

  case "run":
    // TUI dashboard will be implemented in US-5+
    console.log("opalite — review dashboard coming soon.");
    process.exit(0);
    break;
}
