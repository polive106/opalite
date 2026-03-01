# US-19: AI comment assist

## User Story

**As a** reviewer,
**I want to** press Tab while writing a comment to get an AI-suggested comment,
**so that** I can write better review comments faster.

## Acceptance Criteria

- When the comment editor is open, pressing `Tab` calls the agent in print mode with the code context
- The suggestion appears in the editor and can be accepted (Enter), edited, or dismissed (Esc)
- The suggestion is concise (1-2 sentences) and actionable

## Technical Tasks

- [ ] Create a comment suggestion prompt template: include code context, line number, and instructions for concise actionable suggestions
- [ ] Implement `Tab` handler in CommentEditor that calls `queryAgent()` with the suggestion prompt
- [ ] Display the AI suggestion in the input field (replacing or appending to existing text)
- [ ] Allow user to accept (Enter), edit (continue typing), or dismiss (Esc) the suggestion
- [ ] Show loading indicator while agent is generating suggestion

## Files to Create/Modify

- `src/components/CommentEditor.tsx` (modify — add Tab-to-suggest functionality)
- `src/services/prompt.ts` (modify — add comment suggestion prompt template)

## Dependencies

- US-10 (CommentEditor must exist)
- US-15 (agent service must exist)

## Phase

Phase 5 — Polish
