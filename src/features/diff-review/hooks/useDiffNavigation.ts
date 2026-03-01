import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";

export type FocusPanel = "tree" | "diff";
export type ViewMode = "split" | "unified";

export interface DiffNavState {
  focusPanel: FocusPanel;
  selectedFileIndex: number;
  viewMode: ViewMode;
}

export type DiffNavKeyAction =
  | { action: "toggle-focus"; panel: FocusPanel }
  | { action: "select-file"; index: number }
  | { action: "scroll-diff"; direction: "up" | "down" }
  | { action: "toggle-view-mode"; mode: ViewMode }
  | { action: "back" }
  | { action: "quit" }
  | { action: "none" };

export function handleDiffNavKey(
  keyName: string,
  state: DiffNavState,
  fileCount: number
): DiffNavKeyAction {
  if (keyName === "Escape" || keyName === "b") {
    return { action: "back" };
  }

  if (keyName === "q") {
    return { action: "quit" };
  }

  if (keyName === "Tab") {
    return {
      action: "toggle-focus",
      panel: state.focusPanel === "tree" ? "diff" : "tree",
    };
  }

  if (keyName === "u") {
    return {
      action: "toggle-view-mode",
      mode: state.viewMode === "split" ? "unified" : "split",
    };
  }

  if (keyName === "n") {
    if (fileCount === 0) return { action: "none" };
    return {
      action: "select-file",
      index: Math.min(state.selectedFileIndex + 1, fileCount - 1),
    };
  }

  if (keyName === "N") {
    if (fileCount === 0) return { action: "none" };
    return {
      action: "select-file",
      index: Math.max(state.selectedFileIndex - 1, 0),
    };
  }

  const isDown = keyName === "ArrowDown" || keyName === "j";
  const isUp = keyName === "ArrowUp" || keyName === "k";

  if (isDown || isUp) {
    if (fileCount === 0) return { action: "none" };

    if (state.focusPanel === "tree") {
      const newIndex = isDown
        ? Math.min(state.selectedFileIndex + 1, fileCount - 1)
        : Math.max(state.selectedFileIndex - 1, 0);
      return { action: "select-file", index: newIndex };
    }

    return { action: "scroll-diff", direction: isDown ? "down" : "up" };
  }

  return { action: "none" };
}

export function useDiffNavigation(
  fileCount: number,
  goBack: () => void
) {
  const [focusPanel, setFocusPanel] = useState<FocusPanel>("tree");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  useKeyboard((e) => {
    const result = handleDiffNavKey(
      e.name,
      { focusPanel, selectedFileIndex, viewMode },
      fileCount
    );

    switch (result.action) {
      case "toggle-focus":
        setFocusPanel(result.panel);
        break;
      case "select-file":
        setSelectedFileIndex(result.index);
        break;
      case "toggle-view-mode":
        setViewMode(result.mode);
        break;
      case "back":
        goBack();
        break;
      case "quit":
        process.exit(0);
        break;
    }
  });

  return { focusPanel, selectedFileIndex, viewMode };
}
