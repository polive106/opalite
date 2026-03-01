import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { usePRs, formatLastFetch, DEFAULT_AUTO_REFRESH_INTERVAL } from "../hooks/usePRs";
import { useDashboardNavigation } from "../hooks/useDashboardNavigation";
import { PRRow, formatPRRow } from "../widgets/PRRow";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { PR } from "../../../types/review";
import type { Screen } from "../../../App";

const DASHBOARD_KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "review" },
  { key: "m", label: "my PRs" },
  { key: "r", label: "refresh" },
  { key: "q", label: "quit" },
];

export interface DashboardProps {
  auth: AuthData;
  workspace: string;
  repos: string[];
  warningHours: number;
  criticalHours: number;
  autoRefreshInterval?: number;
  navigate: (screen: Screen) => void;
}

export function Dashboard({
  auth,
  workspace,
  repos,
  warningHours,
  criticalHours,
  autoRefreshInterval = DEFAULT_AUTO_REFRESH_INTERVAL,
  navigate,
}: DashboardProps) {
  const { width, height } = useTerminalDimensions();
  const { groups, loading, error, summary, lastFetch, refresh, prs } = usePRs(
    auth,
    workspace,
    repos,
    autoRefreshInterval
  );

  // Build flat list of PRs for navigation
  const flatPRs: PR[] = [];
  for (const group of groups) {
    for (const pr of group.prs) {
      flatPRs.push(pr);
    }
  }

  const { selectedIndex } = useDashboardNavigation(flatPRs, navigate, refresh);

  const now = new Date();
  const lastFetchText = lastFetch
    ? `⟳ ${formatLastFetch(lastFetch, now)}`
    : "";

  const contentWidth = Math.max(width - 2, 40);

  if (loading && prs.length === 0) {
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
          <text fg={theme.dimmed}>{workspace}</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.dimmed}>Loading PRs...</text>
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
          <text fg={theme.dimmed}>{workspace}</text>
        </box>
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.red}>{error}</text>
        </box>
      </box>
    );
  }

  let currentFlatIndex = 0;

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
        <text fg={theme.dimmed}>{workspace}</text>
      </box>

      {/* Subheader */}
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>Open PRs across {workspace}</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{lastFetchText}</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>

      {/* PR List */}
      <scrollbox flexGrow={1} scrollY={true} paddingX={1}>
        {groups.length === 0 ? (
          <box paddingY={1}>
            <text fg={theme.dimmed}>No open PRs found.</text>
          </box>
        ) : (
          groups.map((group) => {
            const repoHeader = (
              <box key={`header-${group.repo}`} paddingTop={1}>
                <text fg={theme.accent}>{group.repo}</text>
              </box>
            );

            const prRows = group.prs.map((pr) => {
              const index = currentFlatIndex++;
              const data = formatPRRow(
                pr,
                now,
                warningHours,
                criticalHours,
                contentWidth - 20
              );
              return (
                <box key={`pr-${pr.repo}-${pr.id}`}>
                  <PRRow
                    data={data}
                    selected={index === selectedIndex}
                    width={contentWidth}
                  />
                </box>
              );
            });

            return (
              <box key={`group-${group.repo}`} flexDirection="column">
                {repoHeader}
                {prRows}
              </box>
            );
          })
        )}
      </scrollbox>

      {/* Summary line */}
      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>
      <box flexDirection="row" paddingX={1}>
        <text fg={theme.fg}>
          {summary.total} PRs open · oldest: {summary.oldestAge} · avg:{" "}
          {summary.averageAge}
        </text>
      </box>

      {/* KeyBar */}
      <KeyBar bindings={DASHBOARD_KEY_BINDINGS} />
    </box>
  );
}
