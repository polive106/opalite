import { Dashboard } from "./features/dashboard/ui/Dashboard";
import { DiffNav } from "./features/diff-review/ui/DiffNav";
import { ReviewSubmit } from "./features/diff-review/ui/ReviewSubmit";
import { MyPRsScreen } from "./features/author-mode/ui/MyPRs";
import { PlaceholderScreen } from "./features/shared/widgets/PlaceholderScreen";
import { useScreenStack } from "./features/shared/hooks/useScreenStack";
import type { AuthData } from "./services/auth";
import type { PR } from "./types/review";
import type { ReviewAction } from "./features/diff-review/hooks/useReviewSubmit";

export type Screen =
  | { name: "dashboard" }
  | { name: "diffnav"; pr: PR }
  | { name: "review-submit"; pr: PR; initialAction: ReviewAction }
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
  initialScreen?: Screen;
}

export function App({
  auth,
  workspace,
  repos,
  warningHours = 24,
  criticalHours = 48,
  autoRefreshInterval,
  initialScreen = { name: "dashboard" },
}: AppProps) {
  const { current, navigate, goBack } = useScreenStack(initialScreen);

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
      return (
        <DiffNav
          auth={auth}
          workspace={workspace}
          pr={current.pr}
          goBack={goBack}
          navigate={navigate}
        />
      );
    case "review-submit":
      return (
        <ReviewSubmit
          auth={auth}
          workspace={workspace}
          pr={current.pr}
          initialAction={current.initialAction}
          goBack={goBack}
        />
      );
    case "my-prs":
      return (
        <MyPRsScreen
          auth={auth}
          workspace={workspace}
          repos={repos}
          warningHours={warningHours}
          criticalHours={criticalHours}
          navigate={navigate}
          goBack={goBack}
        />
      );
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
