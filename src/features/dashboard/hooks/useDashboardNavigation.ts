import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { PR } from "../../../types/review";
import type { Screen } from "../../../App";

export interface DashboardNavigationState {
  selectedIndex: number;
}

export type DashboardKeyAction =
  | { action: "select"; index: number }
  | { action: "navigate"; pr: PR }
  | { action: "refresh" }
  | { action: "my-prs" }
  | { action: "quit" }
  | { action: "none" };

export function handleDashboardKey(
  keyName: string,
  state: DashboardNavigationState,
  flatPRs: PR[]
): DashboardKeyAction {
  if (keyName === "q") {
    return { action: "quit" };
  }
  if (keyName === "r") {
    return { action: "refresh" };
  }
  if (keyName === "m") {
    return { action: "my-prs" };
  }
  if (flatPRs.length === 0) {
    return { action: "none" };
  }
  if (keyName === "down" || keyName === "j") {
    return {
      action: "select",
      index: Math.min(state.selectedIndex + 1, flatPRs.length - 1),
    };
  }
  if (keyName === "up" || keyName === "k") {
    return {
      action: "select",
      index: Math.max(state.selectedIndex - 1, 0),
    };
  }
  if (keyName === "return") {
    return { action: "navigate", pr: flatPRs[state.selectedIndex] };
  }
  return { action: "none" };
}

export function useDashboardNavigation(
  flatPRs: PR[],
  navigate: (screen: Screen) => void,
  refresh: () => void
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((e) => {
    const result = handleDashboardKey(
      e.name,
      { selectedIndex },
      flatPRs
    );

    switch (result.action) {
      case "select":
        setSelectedIndex(result.index);
        break;
      case "navigate":
        navigate({ name: "diffnav", pr: result.pr });
        break;
      case "refresh":
        refresh();
        break;
      case "my-prs":
        navigate({ name: "my-prs" });
        break;
      case "quit":
        process.exit(0);
        break;
    }
  });

  return { selectedIndex };
}
