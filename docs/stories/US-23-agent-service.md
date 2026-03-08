# US-23: Agent service (print mode)

> Part of EP-01: AI-Assisted Review (`docs/epics/EP-01-ai-assisted-review.md`)

## User Story

**As a** developer,
**I want** a service that spawns the configured agent CLI and captures its output,
**so that** AI features can query the agent programmatically.

## Acceptance Criteria

- `queryAgent(prompt, config)` spawns the agent in print mode and returns stdout as a string
- The command is built from the config template by replacing `{prompt}` with the actual prompt
- The prompt is passed via stdin (piped) to avoid shell escaping issues with long prompts
- If the agent process exits with a non-zero code, an error is thrown with the stderr output
- If no agent is configured, `queryAgent` returns `null` (not an error — graceful degradation)
- Timeout of 60 seconds — if the agent doesn't respond, the promise rejects

## Technical Tasks

- [x] Create `src/types/agent.ts` with `AgentConfig` type: `{ default: string, [agentName]: { interactive, print, print_json } }`
- [x] Create `src/services/agent.ts`
- [x] Implement `getAgentConfig(config: OpaliteConfig): AgentConfig | null` — read agent config, return null if not configured
- [x] Implement `buildAgentCommand(template: string): string[]` — parse command template into command + args array
- [x] Implement `queryAgent(prompt: string, config: OpaliteConfig): Promise<string | null>` — spawn in print mode, pipe prompt via stdin, capture stdout, return text
- [x] Handle edge cases: agent not installed (ENOENT → clear error), timeout (60s), non-zero exit (throw with stderr), empty output (throw)
- [x] Write unit tests with mocked `Bun.spawn()`

## Files to Create/Modify

- `src/types/agent.ts` (create)
- `src/services/agent.ts` (create)
- `__tests__/unit/services/agent.test.ts` (create)

## Dependencies

- None (US-3 config already has `agent` field)

## Notes

- This service is also a prerequisite for US-15 (fix comment with agent). US-15 needs interactive mode, which can be added later.
- Only print mode is needed for this story. Interactive and print-JSON modes will be added when their stories are implemented.

## Phase

Phase 5 — AI-Assisted Review (EP-01)
