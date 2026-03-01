# US-14: Generate agent prompts from comments

## User Story

**As a** PR author,
**I want** opalite to generate a well-structured prompt from a review comment,
**so that** the AI agent has the right context to fix the issue.

## Acceptance Criteria

- Given a comment, a prompt is generated containing: PR ID, title, branch name, comment author, file path, line number, comment text, ~20 lines of code context around the commented line, and instructions to make minimal changes
- The prompt template is consistent and produces good results with both Claude Code and Cursor CLI
- A batch prompt variant combines multiple comments into a single prompt with numbered sections
- The prompt can be copied to clipboard via the `e` key in CommentQueue

## Technical Tasks

- [ ] Create `src/services/prompt.ts` with single-comment prompt generation function
- [ ] Implement code context extraction: read ~20 lines around the commented line from the source file
- [ ] Build prompt template with PR metadata (ID, title, branch), comment details (author, file, line, content), code context, and instructions
- [ ] Implement batch prompt generation: combine multiple comments into numbered sections
- [ ] Ensure prompts work well with both Claude Code and Cursor CLI command formats

## Files to Create/Modify

- `src/services/prompt.ts` (create)

## Dependencies

- US-13 (CommentQueue provides the comments to generate prompts from)

## Phase

Phase 4 — Author Mode
