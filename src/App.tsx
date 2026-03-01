import { Dashboard } from "./features/dashboard/ui/Dashboard";
import { PlaceholderScreen } from "./features/shared/widgets/PlaceholderScreen";
import { useScreenStack } from "./features/shared/hooks/useScreenStack";
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
  const { current, navigate, goBack } = useScreenStack({ name: "dashboard" });

  switch (current.name) {
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
    case "diffnav":
    case "review-submit":
    case "my-prs":
    case "comment-queue":
    case "agent-fix":
      return (
        <PlaceholderScreen
          screenName={current.name}
          goBack={goBack}
        />
      );
  }
}
