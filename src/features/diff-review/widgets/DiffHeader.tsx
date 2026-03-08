import { theme } from "../../../theme/tokyo-night";
import { formatAge } from "../../dashboard/hooks/usePRs";
import { RefreshIndicator } from "../../shared/widgets/RefreshIndicator";
import type { PR } from "../../../types/review";

export interface DiffHeaderData {
  prNumber: number;
  title: string;
  author: string;
  sourceBranch: string;
  destinationBranch: string;
  age: string;
  repo: string;
}

export function formatDiffHeader(pr: PR, now: Date): DiffHeaderData {
  return {
    prNumber: pr.id,
    title: pr.title,
    author: pr.author.nickname,
    sourceBranch: pr.sourceBranch,
    destinationBranch: pr.destinationBranch,
    age: formatAge(pr.createdOn, now),
    repo: pr.repo,
  };
}

interface DiffHeaderProps {
  data: DiffHeaderData;
}

export function DiffHeader({ data }: DiffHeaderProps) {
  return (
    <box flexDirection="column" paddingX={1} paddingY={1}>
      <box flexDirection="row">
        <text fg={theme.accent}>{`#${data.prNumber}`}</text>
        <text fg={theme.fg}> {data.title}</text>
        <box flexGrow={1} />
        <RefreshIndicator />
        <text fg={theme.dimmed}> {data.age}</text>
      </box>
      <box flexDirection="row">
        <text fg={theme.dimmed}>{data.repo} · </text>
        <text fg={theme.green}>{data.sourceBranch}</text>
        <text fg={theme.dimmed}> → </text>
        <text fg={theme.accent}>{data.destinationBranch}</text>
        <text fg={theme.dimmed}> · {data.author}</text>
      </box>
    </box>
  );
}
