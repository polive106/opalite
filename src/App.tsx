import { useState } from "react";
import { Dashboard } from "./features/dashboard/ui/Dashboard";
import type { AuthData } from "./services/auth";
import type { PR } from "./types/review";

export type Screen =
  | { name: "dashboard" }
  | { name: "diffnav"; pr: PR }
  | { name: "review-submit"; pr: PR }
  | { name: "my-prs" }
  | { name: "comment-queue"; pr: PR }
  | { name: "agent-fix"; pr: PR };

export interface AppProps {
  auth: AuthData;
  workspace: string;
  repos: string[];
  warningHours?: number;
  criticalHours?: number;
  autoRefreshInterval?: number;
}

export function App({
  auth,
  workspace,
  repos,
  warningHours = 24,
  criticalHours = 48,
  autoRefreshInterval,
}: AppProps) {
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });

  const navigate = (target: Screen) => {
    setScreen(target);
  };

  switch (screen.name) {
    case "dashboard":
      return (
        <Dashboard
          auth={auth}
          workspace={workspace}
          repos={repos}
          warningHours={warningHours}
          criticalHours={criticalHours}
          autoRefreshInterval={autoRefreshInterval}
          navigate={navigate}
        />
      );
    default:
      // Other screens will be implemented in later stories
      return (
        <Dashboard
          auth={auth}
          workspace={workspace}
          repos={repos}
          warningHours={warningHours}
          criticalHours={criticalHours}
          autoRefreshInterval={autoRefreshInterval}
          navigate={navigate}
        />
      );
  }
}
