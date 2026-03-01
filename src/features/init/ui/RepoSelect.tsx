import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import { useRepoSelect } from "../hooks/useRepoSelect";
import type { Repository } from "../../../commands/init";

const KEY_BINDINGS: KeyBinding[] = [
  { key: "↑↓", label: "navigate" },
  { key: "␣", label: "toggle" },
  { key: "a", label: "all" },
  { key: "⏎", label: "confirm" },
];

export interface RepoRowData {
  name: string;
  slug: string;
  checkText: string;
  checkColor: string;
  nameColor: string;
  bgColor: string;
}

export function formatRepoRow(
  repo: Repository,
  isCursor: boolean,
  isSelected: boolean
): RepoRowData {
  return {
    name: repo.name,
    slug: repo.slug,
    checkText: isSelected ? "[x]" : "[ ]",
    checkColor: isSelected ? theme.green : theme.dimmed,
    nameColor: isCursor ? theme.accent : theme.fg,
    bgColor: isCursor ? theme.selection : theme.bg,
  };
}

export function formatSelectionStatus(
  selectedCount: number,
  totalCount: number
): string {
  const base = `${selectedCount} of ${totalCount} selected`;
  if (selectedCount === 0) {
    return `${base} — select at least one to continue`;
  }
  return base;
}

export interface RepoSelectProps {
  repos: Repository[];
  workspace: string;
  onConfirm: (repoSlugs: string[]) => void;
}

export function RepoSelect({ repos, workspace, onConfirm }: RepoSelectProps) {
  const { width, height } = useTerminalDimensions();
  const { cursor, selected } = useRepoSelect(repos.length, (indices) => {
    const slugs = indices.map((i) => repos[i].slug);
    onConfirm(slugs);
  });

  const contentWidth = Math.max(width - 2, 40);

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite init</text>
        <box flexGrow={1} />
        <text fg={theme.dimmed}>{workspace}</text>
      </box>

      <box paddingX={1} paddingBottom={1}>
        <text fg={theme.fg}>Select repos to watch</text>
      </box>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>

      <scrollbox flexGrow={1} scrollY={true} paddingX={1} focused={false}>
        {repos.map((repo, i) => {
          const data = formatRepoRow(repo, i === cursor, selected.has(i));

          return (
            <box
              key={repo.slug}
              flexDirection="row"
              backgroundColor={data.bgColor}
              width={contentWidth}
            >
              <text fg={data.checkColor}>{data.checkText} </text>
              <text fg={data.nameColor}>{data.name} </text>
              <text fg={theme.dimmed}>({data.slug})</text>
            </box>
          );
        })}
      </scrollbox>

      <box paddingX={1}>
        <text fg={theme.border}>{"─".repeat(contentWidth)}</text>
      </box>
      <box paddingX={1}>
        <text fg={theme.dimmed}>
          {formatSelectionStatus(selected.size, repos.length)}
        </text>
      </box>

      <KeyBar bindings={KEY_BINDINGS} />
    </box>
  );
}
