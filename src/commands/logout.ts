import { deleteAuthFile, getDefaultAuthPath } from "../services/auth";

interface LogoutResult {
  success: boolean;
  message: string;
}

export async function runLogoutAction(
  authPath: string = getDefaultAuthPath()
): Promise<LogoutResult> {
  await deleteAuthFile(authPath);
  return {
    success: true,
    message: "Logged out successfully. Credentials have been removed.",
  };
}

export async function runLogout(
  authPath: string = getDefaultAuthPath()
): Promise<void> {
  const result = await runLogoutAction(authPath);
  console.log(result.message);
}
