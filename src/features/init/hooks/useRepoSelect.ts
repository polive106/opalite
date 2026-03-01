import { useState } from "react";
import { useKeyboard } from "@opentui/react";

export interface RepoSelectState {
  cursor: number;
  selected: Set<number>;
}

export type RepoSelectAction =
  | { action: "move"; cursor: number }
  | { action: "toggle"; cursor: number; selected: Set<number> }
  | { action: "toggle-all"; selected: Set<number> }
  | { action: "confirm"; selectedIndices: number[] }
  | { action: "none" };

export function handleRepoSelectKey(
  keyName: string,
  state: RepoSelectState,
  totalRepos: number
): RepoSelectAction {
  if (keyName === "down" || keyName === "j") {
    return {
      action: "move",
      cursor: Math.min(state.cursor + 1, totalRepos - 1),
    };
  }
  if (keyName === "up" || keyName === "k") {
    return {
      action: "move",
      cursor: Math.max(state.cursor - 1, 0),
    };
  }
  if (keyName === "space") {
    const next = new Set(state.selected);
    if (next.has(state.cursor)) {
      next.delete(state.cursor);
    } else {
      next.add(state.cursor);
    }
    return { action: "toggle", cursor: state.cursor, selected: next };
  }
  if (keyName === "a") {
    if (state.selected.size === totalRepos) {
      return { action: "toggle-all", selected: new Set() };
    }
    const all = new Set<number>();
    for (let i = 0; i < totalRepos; i++) {
      all.add(i);
    }
    return { action: "toggle-all", selected: all };
  }
  if (keyName === "return") {
    if (state.selected.size > 0) {
      return {
        action: "confirm",
        selectedIndices: [...state.selected].sort(),
      };
    }
  }
  return { action: "none" };
}

export function useRepoSelect(
  totalRepos: number,
  onConfirm: (indices: number[]) => void
) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useKeyboard((e) => {
    const result = handleRepoSelectKey(
      e.name,
      { cursor, selected },
      totalRepos
    );

    if (result.action !== "none") {
      e.preventDefault();
    }

    switch (result.action) {
      case "move":
        setCursor(result.cursor);
        break;
      case "toggle":
        setSelected(result.selected);
        break;
      case "toggle-all":
        setSelected(result.selected);
        break;
      case "confirm":
        onConfirm(result.selectedIndices);
        break;
    }
  });

  return { cursor, selected };
}
