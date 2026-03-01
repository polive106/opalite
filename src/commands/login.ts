import {
  validateTokenFormat,
  saveAuthFile,
  getAuthHeader,
  getDefaultAuthPath,
  type AuthData,
} from "../services/auth";

type LoginResult =
  | { success: true; displayName: string; username: string }
  | { success: false; error: string };

export function getLoginInstructions(): string {
  return `To log in, you'll need a Bitbucket API token with scopes.

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label (e.g. "opalite")
4. Select scopes: read:user:bitbucket, read:workspace:bitbucket, read:repository:bitbucket, write:repository:bitbucket, read:pullrequest:bitbucket, write:pullrequest:bitbucket
5. Create it and copy the token — it starts with ATAT
`;
}

export async function validateAndLogin(
  email: string,
  token: string,
  authPath: string = getDefaultAuthPath()
): Promise<LoginResult> {
  if (!validateTokenFormat(token)) {
    return {
      success: false,
      error: "Invalid token format. Bitbucket API tokens start with ATAT.",
    };
  }

  const tempAuth: AuthData = {
    email,
    apiToken: token,
    displayName: "",
    username: "",
  };

  let response: Response;
  try {
    response = await fetch("https://api.bitbucket.org/2.0/user", {
      headers: {
        Authorization: getAuthHeader(tempAuth),
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${(error as Error).message}`,
    };
  }

  if (response.status === 401) {
    return {
      success: false,
      error:
        "Your API token has expired. Run `opalite login` to add a new one.",
    };
  }

  if (response.status === 403) {
    const body = (await response.json()) as {
      error?: {
        detail?: { required?: string[]; granted?: string[] };
      };
    };
    const required = body.error?.detail?.required ?? [];
    const granted = body.error?.detail?.granted ?? [];
    const missing = required.filter((s) => !granted.includes(s));
    return {
      success: false,
      error: missing.length > 0
        ? `Your API token is missing required scopes: ${missing.join(", ")}.\nCreate a new token with all required scopes and run \`opalite login\` again.`
        : `Your API token lacks required permissions (HTTP 403).`,
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: `Failed to validate credentials (HTTP ${response.status}).`,
    };
  }

  const user = (await response.json()) as {
    display_name: string;
    username: string;
  };

  const authData: AuthData = {
    email,
    apiToken: token,
    displayName: user.display_name,
    username: user.username,
  };

  await saveAuthFile(authData, authPath);

  return {
    success: true,
    displayName: user.display_name,
    username: user.username,
  };
}

export async function runLogin(
  authPath: string = getDefaultAuthPath()
): Promise<void> {
  console.log(getLoginInstructions());

  process.stdout.write("Atlassian email: ");
  const email = (await readLine()).trim();
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }

  process.stdout.write("API token (hidden): ");
  setStdinEcho(false);
  const token = (await readLine()).trim();
  setStdinEcho(true);
  console.log(); // newline after hidden input

  if (!token) {
    console.error("API token is required.");
    process.exit(1);
  }

  const result = await validateAndLogin(email, token, authPath);

  if (result.success) {
    console.log(`\nLogged in as ${result.displayName} (${result.username})`);
  } else {
    console.error(`\nError: ${result.error}`);
    process.exit(1);
  }
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.resume();
    const onData = (chunk: string) => {
      data += chunk;
      if (data.includes("\n")) {
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve(data.split("\n")[0]);
      }
    };
    process.stdin.on("data", onData);
  });
}

function setStdinEcho(enabled: boolean): void {
  if (process.stdin.isTTY) {
    const flag = enabled ? "echo" : "-echo";
    Bun.spawnSync(["stty", flag], { stdin: "inherit" });
  }
}
