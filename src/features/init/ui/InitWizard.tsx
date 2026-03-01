import { useState, useEffect, useCallback } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../../../theme/tokyo-night";
import { WorkspaceSelect } from "./WorkspaceSelect";
import { RepoSelect } from "./RepoSelect";
import { AgentSelect } from "./AgentSelect";
import {
  fetchWorkspaces,
  fetchRepos,
  detectAgents,
  type Workspace,
  type Repository,
} from "../../../commands/init";
import type { AuthData } from "../../../services/auth";
import type { OpaliteConfig } from "../../../services/config";

type WizardStep =
  | { name: "loading-workspaces" }
  | { name: "select-workspace"; workspaces: Workspace[] }
  | { name: "loading-repos"; workspace: string }
  | { name: "select-repos"; workspace: string; repos: Repository[] }
  | { name: "select-agent"; workspace: string; repos: string[] }
  | { name: "done" };

export interface InitWizardProps {
  auth: AuthData;
  onComplete: (config: OpaliteConfig) => void;
  onError: (message: string) => void;
}

function LoadingScreen({ message }: { message: string }) {
  const { width, height } = useTerminalDimensions();

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      <box flexDirection="row" paddingX={1} paddingTop={1}>
        <text fg={theme.accent}>opalite init</text>
      </box>
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg={theme.dimmed}>{message}</text>
      </box>
    </box>
  );
}

export function InitWizard({ auth, onComplete, onError }: InitWizardProps) {
  const [step, setStep] = useState<WizardStep>({ name: "loading-workspaces" });

  useEffect(() => {
    if (step.name === "loading-workspaces") {
      fetchWorkspaces(auth)
        .then((workspaces) => {
          if (workspaces.length === 0) {
            onError(
              "No workspaces found. Make sure your Bitbucket account has access to at least one workspace."
            );
            return;
          }
          if (workspaces.length === 1) {
            setStep({ name: "loading-repos", workspace: workspaces[0].slug });
            return;
          }
          setStep({ name: "select-workspace", workspaces });
        })
        .catch((err: Error) => {
          onError(err.message);
        });
    }
  }, [step.name === "loading-workspaces"]);

  useEffect(() => {
    if (step.name === "loading-repos") {
      fetchRepos(auth, step.workspace)
        .then((repos) => {
          if (repos.length === 0) {
            onError("No repos found in this workspace.");
            return;
          }
          setStep({ name: "select-repos", workspace: step.workspace, repos });
        })
        .catch((err: Error) => {
          onError(err.message);
        });
    }
  }, [step.name === "loading-repos"]);

  const handleWorkspaceSelect = useCallback((workspace: string) => {
    setStep({ name: "loading-repos", workspace });
  }, []);

  const handleRepoConfirm = useCallback(
    (repoSlugs: string[]) => {
      if (step.name === "select-repos") {
        setStep({
          name: "select-agent",
          workspace: step.workspace,
          repos: repoSlugs,
        });
      }
    },
    [step]
  );

  const handleAgentSelect = useCallback(
    (agent: string | undefined) => {
      if (step.name === "select-agent") {
        const config: OpaliteConfig = {
          workspace: step.workspace,
          repos: step.repos,
          ...(agent ? { agent } : {}),
        };
        setStep({ name: "done" });
        onComplete(config);
      }
    },
    [step, onComplete]
  );

  switch (step.name) {
    case "loading-workspaces":
      return <LoadingScreen message="Fetching your workspaces..." />;

    case "select-workspace":
      return (
        <WorkspaceSelect
          workspaces={step.workspaces}
          onSelect={handleWorkspaceSelect}
        />
      );

    case "loading-repos":
      return <LoadingScreen message={`Fetching repos for ${step.workspace}...`} />;

    case "select-repos":
      return (
        <RepoSelect
          repos={step.repos}
          workspace={step.workspace}
          onConfirm={handleRepoConfirm}
        />
      );

    case "select-agent":
      return (
        <AgentSelect
          agents={detectAgents()}
          onSelect={handleAgentSelect}
        />
      );

    case "done":
      return <LoadingScreen message="Saving configuration..." />;
  }
}
