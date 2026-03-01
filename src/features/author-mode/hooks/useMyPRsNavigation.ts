import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { PR } from "../../../types/review";
import type { Screen } from "../../../App";

export interface MyPRsNavigationState {
  selectedIndex: number;
}

export type MyPRsKeyAction =
  | { action: "select"; index: number }
  | { action: "open-comment-queue"; pr: PR }
  | { action: "dashboard" }
  | { action: "refresh" }
  | { action: "quit" }
  | { action: "none" };

export function handleMyPRsKey(
  keyName: string,
  state: MyPRsNavigationState,
  myPRs: PR[]
): MyPRsKeyAction {
  if (keyName === "q") {
    return { action: "quit" };
  }
  if (keyName === "d") {
    return { action: "dashboard" };
  }
  if (keyName === "r") {
    return { action: "refresh" };
  }
  if (myPRs.length === 0) {
    return { action: "none" };
  }
  if (keyName === "down" || keyName === "j") {
    return {
      action: "select",
      index: Math.min(state.selectedIndex + 1, myPRs.length - 1),
    };
  }
  if (keyName === "up" || keyName === "k") {
    return {
      action: "select",
      index: Math.max(state.selectedIndex - 1, 0),
    };
  }
  if (keyName === "return") {
    return { action: "open-comment-queue", pr: myPRs[state.selectedIndex] };
  }
  return { action: "none" };
}

export function useMyPRsNavigation(
  myPRs: PR[],
  navigate: (screen: Screen) => void,
  goBack: () => void,
  refresh: () => void
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((e) => {
    const result = handleMyPRsKey(e.name, { selectedIndex }, myPRs);

    switch (result.action) {
      case "select":
        setSelectedIndex(result.index);
        break;
      case "open-comment-queue":
        navigate({ name: "comment-queue", pr: result.pr });
        break;
      case "dashboard":
        goBack();
        break;
      case "refresh":
        refresh();
        break;
      case "quit":
        process.exit(0);
        break;
    }
  });

  return { selectedIndex };
}
