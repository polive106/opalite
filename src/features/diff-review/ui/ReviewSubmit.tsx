import { useCallback } from "react";
import { useTerminalDimensions, useKeyboard } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import {
  useReviewSubmit,
  type ReviewAction,
} from "../hooks/useReviewSubmit";
import {
  ReviewConfirmation,
  formatReviewTitle,
  formatReviewStatus,
} from "../widgets/ReviewConfirmation";
import { KeyBar, type KeyBinding } from "../../shared/widgets/KeyBar";
import type { AuthData } from "../../../services/auth";
import type { PR } from "../../../types/review";

const REVIEW_KEY_BINDINGS: KeyBinding[] = [
  { key: "Enter", label: "submit" },
  { key: "Esc", label: "cancel" },
];

export interface ReviewSubmitProps {
  auth: AuthData;
  workspace: string;
  pr: PR;
  initialAction: ReviewAction;
  goBack: () => void;
}

export function ReviewSubmit({
  auth,
  workspace,
  pr,
  initialAction,
  goBack,
}: ReviewSubmitProps) {
  const { width, height } = useTerminalDimensions();
  const { state, changeAction, changeComment, submit } = useReviewSubmit(
    auth,
    workspace,
    pr.repo,
    pr.id,
    initialAction
  );

  const handleSubmit = useCallback(async () => {
    if (state.submitting) return;
    const success = await submit();
    if (success) {
      goBack();
    }
  }, [state.submitting, submit, goBack]);

  useKeyboard((e) => {
    if (e.name === "Escape" && !state.submitting) {
      goBack();
    }
  });

  const title = formatReviewTitle(state.action, pr.title, pr.id);
  const status = formatReviewStatus(state.submitting, state.error);

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <box
          flexDirection="column"
          border={["top", "right", "bottom", "left"]}
          borderColor={theme.accent}
          width={Math.min(60, width - 4)}
        >
          <ReviewConfirmation
            title={title}
            action={state.action}
            generalComment={state.generalComment}
            status={status}
            onActionChange={changeAction}
            onCommentChange={changeComment}
            onSubmit={handleSubmit}
            onCancel={goBack}
          />
        </box>
      </box>

      <KeyBar bindings={REVIEW_KEY_BINDINGS} />
    </box>
  );
}
