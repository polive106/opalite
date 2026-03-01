import { describe, expect, it } from "bun:test";
import { parseArgs, getVersion, getHelpText } from "../../src/cli";

describe("getVersion", () => {
  it("should return the version from package.json", () => {
    const version = getVersion();
    expect(version).toBe("0.1.0");
  });
});

describe("getHelpText", () => {
  it("should include the program name", () => {
    const help = getHelpText();
    expect(help).toContain("opalite");
  });

  it("should list available commands", () => {
    const help = getHelpText();
    expect(help).toContain("login");
    expect(help).toContain("logout");
    expect(help).toContain("init");
    expect(help).toContain("my");
    expect(help).toContain("update");
  });

  it("should list available flags", () => {
    const help = getHelpText();
    expect(help).toContain("--version");
    expect(help).toContain("--help");
  });
});

describe("parseArgs", () => {
  it("should return { action: 'version' } for --version", () => {
    expect(parseArgs(["--version"])).toEqual({ action: "version" });
  });

  it("should return { action: 'version' } for -v", () => {
    expect(parseArgs(["-v"])).toEqual({ action: "version" });
  });

  it("should return { action: 'help' } for --help", () => {
    expect(parseArgs(["--help"])).toEqual({ action: "help" });
  });

  it("should return { action: 'help' } for -h", () => {
    expect(parseArgs(["-h"])).toEqual({ action: "help" });
  });

  it("should return { action: 'command', command } for known subcommands", () => {
    expect(parseArgs(["login"])).toEqual({ action: "command", command: "login" });
    expect(parseArgs(["logout"])).toEqual({ action: "command", command: "logout" });
    expect(parseArgs(["init"])).toEqual({ action: "command", command: "init" });
    expect(parseArgs(["my"])).toEqual({ action: "command", command: "my" });
    expect(parseArgs(["update"])).toEqual({ action: "command", command: "update" });
  });

  it("should return { action: 'unknown', command } for unknown subcommands", () => {
    expect(parseArgs(["foobar"])).toEqual({ action: "unknown", command: "foobar" });
  });

  it("should return { action: 'run' } for no arguments", () => {
    expect(parseArgs([])).toEqual({ action: "run" });
  });
});
