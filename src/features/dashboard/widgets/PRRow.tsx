import { theme } from "../../../theme/tokyo-night";
import {
  formatAge,
  getAgeColor,
} from "../hooks/usePRs";
import type { PR } from "../../../types/review";

export interface PRRowData {
  id: number;
  title: string;
  displayTitle: string;
  author: string;
  age: string;
  ageColor: "green" | "yellow" | "red";
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  commentCount: number;
}

export function formatPRRow(
  pr: PR,
  now: Date,
  warningHours: number,
  criticalHours: number,
  maxTitleLength?: number
): PRRowData {
  const age = formatAge(pr.createdOn, now);
  const ageColor = getAgeColor(pr.createdOn, now, warningHours, criticalHours);
  let displayTitle = pr.title;
  if (maxTitleLength && displayTitle.length > maxTitleLength) {
    displayTitle = displayTitle.slice(0, maxTitleLength - 1) + "…";
  }

  return {
    id: pr.id,
    title: pr.title,
    displayTitle,
    author: pr.author.nickname,
    age,
    ageColor,
    filesChanged: pr.filesChanged,
    linesAdded: pr.linesAdded,
    linesRemoved: pr.linesRemoved,
    commentCount: pr.commentCount,
  };
}

const ageColorMap = {
  green: theme.green,
  yellow: theme.yellow,
  red: theme.red,
};

interface PRRowProps {
  data: PRRowData;
  selected: boolean;
  width: number;
}

export function PRRow({ data, selected, width }: PRRowProps) {
  const bgColor = selected ? theme.selection : undefined;
  const ageHexColor = ageColorMap[data.ageColor];
  const statsText = `${data.filesChanged} files · +${data.linesAdded} -${data.linesRemoved} · ${data.author} · 💬 ${data.commentCount}`;

  return (
    <box
      flexDirection="column"
      width={width}
      backgroundColor={bgColor}
      paddingX={1}
    >
      <box flexDirection="row" width="100%">
        <text fg={ageHexColor}>▸ </text>
        <text fg={theme.dimmed}>#{data.id}  </text>
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
