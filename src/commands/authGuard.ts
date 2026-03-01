import { loadAuthFile, getDefaultAuthPath } from "../services/auth";

type AuthCheckResult =
  | { authenticated: true }
  | { authenticated: false; message: string };

export async function checkAuth(
  authPath: string = getDefaultAuthPath()
): Promise<AuthCheckResult> {
  const auth = await loadAuthFile(authPath);

  if (!auth) {
    return {
      authenticated: false,
      message: 'Run `opalite login` first.',
    };
  }

  return { authenticated: true };
}
