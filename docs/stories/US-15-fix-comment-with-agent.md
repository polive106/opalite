# US-15: Fix a comment with an AI agent

## User Story

**As a** PR author,
**I want to** press `f` on a comment to spawn an AI agent that fixes it,
**so that** I can address review feedback without manually writing the fix.

## Acceptance Criteria

- Pressing `f` in CommentQueue generates a prompt (US-14) and spawns the configured agent in interactive mode
- The agent runs in the current terminal (stdio inherited) so the user can see and interact with it
- The agent command is built from the config template (e.g. `claude "{prompt}"` or `agent "{prompt}"`)
- The agent runs in the repo root directory
- After the agent exits, opalite detects changes via `git diff`
- If changes exist, the AgentFix screen (US-16) is shown
- If no changes, a message is shown: "Agent made no changes"
- If no agent is configured, a helpful error is shown with install instructions

## Technical Tasks

- [ ] Create `src/services/agent.ts` with `AgentConfig` type and command builder (`buildCommand`)
- [ ] Implement `spawnAgentInteractive()`: spawn agent with stdio inherited using `Bun.spawn()`
- [ ] Implement `queryAgent()`: capture text output from agent in print mode
- [ ] Implement `queryAgentJSON<T>()`: capture and parse JSON output from agent
- [ ] Create `src/hooks/useAgent.ts` hook: manage agent spawn lifecycle, detect changes after exit
- [ ] Integrate with CommentQueue: `f` generates prompt, spawns agent, detects changes
- [ ] Show "Agent made no changes" if `git diff` is empty after agent exits
- [ ] Show helpful error if no agent is configured (with install instructions)

## Files to Create/Modify

- `src/services/agent.ts` (create)
- `src/hooks/useAgent.ts` (create)
- `src/screens/CommentQueue.tsx` (modify — wire up `f` to agent flow)

## Dependencies

- US-14 (prompt generation)
- US-3 (agent config from init)

## Phase

Phase 4 — Author Mode
