import { theme } from "../../../theme/tokyo-night";
import { formatAge, getAgeColor } from "../../dashboard/hooks/usePRs";
import type { PR } from "../../../types/review";
import type { ReviewerSummary } from "../hooks/useMyPRs";

export interface MyPRRowData {
  id: number;
  title: string;
  displayTitle: string;
  repo: string;
  age: string;
  ageColor: "green" | "yellow" | "red";
  commentCount: number;
  unresolvedCount: number;
  reviewerSummary: ReviewerSummary;
  reviewerStatusText: string;
}

export function formatMyPRRow(
  pr: PR,
  now: Date,
  unresolvedCount: number,
  reviewerSummary: ReviewerSummary,
  warningHours: number,
  criticalHours: number,
  maxTitleLength?: number
): MyPRRowData {
  const age = formatAge(pr.createdOn, now);
  const ageColor = getAgeColor(pr.createdOn, now, warningHours, criticalHours);
  let displayTitle = pr.title;
  if (maxTitleLength && displayTitle.length > maxTitleLength) {
    displayTitle = displayTitle.slice(0, maxTitleLength - 1) + "\u2026";
  }

  const parts: string[] = [];
  if (reviewerSummary.approved > 0) {
    parts.push(`\u2713${reviewerSummary.approved}`);
  }
  if (reviewerSummary.changesRequested > 0) {
    parts.push(`\u2717${reviewerSummary.changesRequested}`);
  }
  if (reviewerSummary.pending > 0) {
    parts.push(`?${reviewerSummary.pending}`);
  }
  const reviewerStatusText = parts.join(" ");

  return {
    id: pr.id,
    title: pr.title,
    displayTitle,
    repo: pr.repo,
    age,
    ageColor,
    commentCount: pr.commentCount,
    unresolvedCount,
    reviewerSummary,
    reviewerStatusText,
  };
}

const ageColorMap = {
  green: theme.green,
  yellow: theme.yellow,
  red: theme.red,
};

interface MyPRRowProps {
  data: MyPRRowData;
  selected: boolean;
  width: number;
}

export function MyPRRow({ data, selected, width }: MyPRRowProps) {
  const bgColor = selected ? theme.selection : undefined;
  const ageHexColor = ageColorMap[data.ageColor];
  const unresolvedText = data.unresolvedCount > 0
    ? `${data.unresolvedCount} unresolved`
    : "0 unresolved";
  const statsText = `${data.repo} \u00b7 ${data.commentCount} comments (${unresolvedText}) \u00b7 ${data.reviewerStatusText}`;

  return (
    <box
      flexDirection="column"
      width={width}
      backgroundColor={bgColor}
      paddingX={1}
    >
      <box flexDirection="row" width="100%">
        <text fg={ageHexColor}>{"\u25b8"} </text>
        <text fg={theme.dimmed}>{`#${data.id}  `}</text>
        <text fg={theme.fg}>{data.displayTitle}</text>
        <box flexGrow={1} />
        <text fg={ageHexColor}>{data.age}</text>
      </box>
      <box flexDirection="row" width="100%" paddingLeft={5}>
        <text fg={theme.dimmed}>{statsText}</text>
      </box>
    </box>
  );
}
