import { theme } from "../../../theme/tokyo-night";
import type { ReviewAction } from "../hooks/useReviewSubmit";

const MAX_TITLE_LENGTH = 40;

export interface ReviewActionOption {
  value: ReviewAction;
  label: string;
}

export const REVIEW_ACTION_OPTIONS: ReviewActionOption[] = [
  { value: "approve", label: "Approve" },
  { value: "request-changes", label: "Request Changes" },
  { value: "comment", label: "Comment" },
];

export function formatActionLabel(action: ReviewAction): string {
  const option = REVIEW_ACTION_OPTIONS.find((o) => o.value === action);
  return option?.label ?? action;
}

export function formatReviewTitle(
  action: ReviewAction,
  prTitle: string,
  prId: number
): string {
  const truncated =
    prTitle.length > MAX_TITLE_LENGTH
      ? prTitle.slice(0, MAX_TITLE_LENGTH - 3) + "..."
      : prTitle;
  return `Submit Review — PR #${prId}: ${truncated}`;
}

export interface ReviewStatusData {
  text: string;
  isError: boolean;
}

export function formatReviewStatus(
  submitting: boolean,
  error: string | null
): ReviewStatusData {
  if (submitting) {
    return { text: "Submitting...", isError: false };
  }

  if (error) {
    return { text: `${error} · Enter retry · Esc cancel`, isError: true };
  }

  return { text: "Enter submit · Esc cancel", isError: false };
}

export interface ReviewConfirmationProps {
  title: string;
  action: ReviewAction;
  generalComment: string;
  status: ReviewStatusData;
  onActionChange: (action: ReviewAction) => void;
  onCommentChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ReviewConfirmation({
  title,
  action,
  generalComment,
  status,
  onActionChange,
  onCommentChange,
  onSubmit,
  onCancel,
}: ReviewConfirmationProps) {
  const selectOptions = REVIEW_ACTION_OPTIONS.map((o) => ({
    name: o.label,
    description: "",
  }));
  const selectedIndex = REVIEW_ACTION_OPTIONS.findIndex(
    (o) => o.value === action
  );

  return (
    <box flexDirection="column" paddingX={2} paddingY={1}>
      <box paddingBottom={1}>
        <text fg={theme.accent}>{title}</text>
      </box>

      <box paddingBottom={1}>
        <text fg={theme.fg}>Action: </text>
        <select
          options={selectOptions}
          selectedIndex={selectedIndex}
          onChange={(index: number) => {
            onActionChange(REVIEW_ACTION_OPTIONS[index].value);
          }}
        />
      </box>

      <box paddingBottom={1} flexDirection="column">
        <text fg={theme.fg}>General comment (optional):</text>
        <input
          value={generalComment}
          onChange={onCommentChange}
          onSubmit={onSubmit}
          placeholder="Add a general comment..."
          focused={true}
        />
      </box>

      <box>
        <text fg={status.isError ? theme.red : theme.dimmed}>
          {status.text}
        </text>
      </box>
    </box>
  );
}
