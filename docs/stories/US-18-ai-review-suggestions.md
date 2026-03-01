# US-18: AI review suggestions

## User Story

**As a** reviewer,
**I want** opalite to suggest review comments using the AI agent,
**so that** I can catch issues I might miss.

## Acceptance Criteria

- In DiffNav, a keyboard shortcut triggers AI review on the current file
- The agent is called in non-interactive print mode with JSON output
- Suggestions are displayed inline in the diff with severity indicators (critical, improvement, nitpick)
- The user can convert a suggestion into a posted comment with one keypress
- Existing comments are included in the prompt to avoid duplicates

## Technical Tasks

- [ ] Define JSON schema for AI review suggestions (file, line, severity, suggestion text)
- [ ] Create review prompt template: include file diff, existing comments, and instructions to return structured JSON
- [ ] Call agent in print JSON mode via `queryAgentJSON()` with the review prompt
- [ ] Parse and display suggestions inline in the diff view with severity color-coding (critical=red, improvement=yellow, nitpick=dimmed)
- [ ] Add keybinding in DiffNav to trigger AI review on current file
- [ ] Add keybinding to convert a suggestion into a posted Bitbucket comment
- [ ] Show loading indicator while agent is running

## Files to Create/Modify

- `src/services/agent.ts` (modify — add review suggestion logic)
- `src/screens/DiffNav.tsx` (modify — add AI review keybinding and suggestion display)
- `src/types/agent.ts` (create — AI suggestion types)

## Dependencies

- US-8 (DiffNav screen must exist)
- US-15 (agent service must exist)
- US-10 (comment posting to convert suggestions to comments)

## Phase

Phase 5 — Polish
