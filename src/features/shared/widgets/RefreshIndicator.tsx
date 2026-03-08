import { useIsFetching } from "@tanstack/react-query";
import { theme } from "../../../theme/tokyo-night";

export function RefreshIndicator() {
  const isFetching = useIsFetching();
  if (isFetching === 0) return null;
  return <text fg={theme.yellow}>refreshing...</text>;
}
