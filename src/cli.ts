import packageJson from "../package.json";

const KNOWN_COMMANDS = ["login", "logout", "init", "my", "update"] as const;
type KnownCommand = (typeof KNOWN_COMMANDS)[number];

export type ParsedArgs =
  | { action: "version" }
  | { action: "help" }
  | { action: "run" }
  | { action: "command"; command: KnownCommand }
  | { action: "unknown"; command: string };

export function getVersion(): string {
  return packageJson.version;
}

export function getHelpText(): string {
  return `opalite v${getVersion()} — Terminal PR review & fix tool for Bitbucket Cloud

Usage: opalite [command] [options]

Commands:
  login       Log in to Bitbucket Cloud
  logout      Log out and remove stored credentials
  init        Initialize opalite in the current repository
  my          Show your open PRs (author mode)
  update      Check for and install updates

Options:
  --version, -v   Print version
  --help, -h      Print this help message

Run without arguments to open the review dashboard.`;
}

export function parseArgs(args: string[]): ParsedArgs {
  if (args.length === 0) {
    return { action: "run" };
  }

  const first = args[0];

  if (first === "--version" || first === "-v") {
    return { action: "version" };
  }

  if (first === "--help" || first === "-h") {
    return { action: "help" };
  }

  if (KNOWN_COMMANDS.includes(first as KnownCommand)) {
    return { action: "command", command: first as KnownCommand };
  }

  return { action: "unknown", command: first };
}
