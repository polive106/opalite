import { useState, useCallback } from "react";
import type { Screen } from "../../../App";

const BACK_KEYS = new Set(["Escape", "b"]);

export function pushScreen(stack: Screen[], screen: Screen): Screen[] {
  return [...stack, screen];
}

export function popScreen(stack: Screen[]): Screen[] {
  if (stack.length <= 1) return stack;
  return stack.slice(0, -1);
}

export function currentScreen(stack: Screen[]): Screen {
  return stack[stack.length - 1];
}

export function isBackKey(keyName: string): boolean {
  return BACK_KEYS.has(keyName);
}

export function useScreenStack(initialScreen: Screen) {
  const [stack, setStack] = useState<Screen[]>([initialScreen]);

  const navigate = useCallback((target: Screen) => {
    setStack((prev) => pushScreen(prev, target));
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => popScreen(prev));
  }, []);

  return {
    current: currentScreen(stack),
    navigate,
    goBack,
    canGoBack: stack.length > 1,
    stackDepth: stack.length,
  };
}
