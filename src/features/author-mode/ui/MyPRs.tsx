import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { useMyPRs, getReviewerSummary } from "../hooks/useMyPRs";
import { useMyPRsNavigation } from "../hooks/useMyPRsNavigation";
import { MyPRRow, formatMyPRRow } from "../widgets/MyPRRow";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { Screen } from "../../../App";

const MY_PRS_KEY_BINDINGS: KeyBinding[] = [
  { key: "\u2191\u2193", label: "navigate" },
  { key: "\u23ce", label: "comments" },
  { key: "d", label: "dashboard" },
  { key: "r", label: "refresh" },
  { key: "q", label: "quit" },
];

export interface MyPRsProps {
  auth: AuthData;
  workspace: string;
  repos: string[];
  warningHours: number;
  criticalHours: number;
  navigate: (screen: Screen) => void;
  goBack: () => void;
}

export function MyPRsScreen({
  auth,
  workspace,
  repos,
  warningHours,
  criticalHours,
  navigate,
  goBack,
}: MyPRsProps) {
  const { width, height } = useTerminalDimensions();
  const { myPRs, unresolvedCounts, loading, error, refresh } = useMyPRs(
    auth,
    workspace,
    repos,
    auth.username
  );

  const { selectedIndex } = useMyPRsNavigation(myPRs, navigate, goBack, refresh);

  const now = new Date();
  const contentWidth = Math.max(width - 2, 40);

  if (loading && myPRs.length === 0) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor={theme.bg}
      >
        <box flexDirection="row" paddingX={1} paddingY={1}>
          <text fg={theme.accent}>opalite</text>
          <box flexGrow={1} />
          <text fg={theme.dimmed}>My PRs</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.dimmed}>Loading your PRs...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box
        width={width}
        height={height}
        flexDirection="column"
        backgroundColor={theme.bg}
      >
        <box flexDirection="row" paddingX={1} paddingY={1}>
          <text fg={theme.accent}>opalite</text>
          <box flexGrow={1} />
          <text fg={theme.dimmed}>My PRs</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.red}>{error}</text>
        </box>
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      {/* Header */}
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>My PRs</text>
      </box>

      {/* Subheader */}
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>Your open PRs across {workspace}</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{`${myPRs.length} PRs`}</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"\u2500".repeat(contentWidth)}</text>
      </box>

      {/* PR List */}
      <scrollbox flexGrow={1} scrollY={true} paddingX={1}>
        {myPRs.length === 0 ? (
          <box paddingY={1}>
            <text fg={theme.dimmed}>No open PRs found for your account.</text>
          </box>
        ) : (
          myPRs.map((pr, index) => {
            const unresolvedCount = unresolvedCounts.get(pr.id) ?? 0;
            const reviewerSummary = getReviewerSummary(pr);
            const data = formatMyPRRow(
              pr,
              now,
              unresolvedCount,
              reviewerSummary,
              warningHours,
              criticalHours,
              contentWidth - 20
            );
            return (
              <box key={`mypr-${pr.repo}-${pr.id}`}>
                <MyPRRow
                  data={data}
                  selected={index === selectedIndex}
                  width={contentWidth}
                />
              </box>
            );
          })
        )}
      </scrollbox>

      {/* Summary */}
      <box paddingX={1}>
        <text fg={theme.border}>{"\u2500".repeat(contentWidth)}</text>
      </box>
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>
          {`${myPRs.length} open PR${myPRs.length !== 1 ? "s" : ""}`}
        </text>
      </box>

      {/* KeyBar */}
      <KeyBar bindings={MY_PRS_KEY_BINDINGS} />
    </box>
  );
}
