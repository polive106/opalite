export const queryKeys = {
  prs: (workspace: string, repos: string[]) =>
    ["prs", workspace, ...repos.sort()] as const,
  diff: (workspace: string, repo: string, prId: number) =>
    ["diff", workspace, repo, prId] as const,
  comments: (workspace: string, repo: string, prId: number) =>
    ["comments", workspace, repo, prId] as const,
  myPRs: (workspace: string, repos: string[], username: string) =>
    ["myPRs", workspace, ...repos.sort(), username] as const,
};
