# US-24: Comment refinement prompt builder

> Part of EP-01: AI-Assisted Review (`docs/epics/EP-01-ai-assisted-review.md`)

## User Story

**As a** developer,
**I want** a function that builds a well-structured prompt for comment refinement,
**so that** the agent has all the context it needs to improve a review comment.

## Acceptance Criteria

- `buildRefinementPrompt(input)` returns a string prompt containing: file path, line number, PR metadata, file diff, existing comments, and the reviewer's draft
- `buildRejectionPrompt(input)` extends the prompt with the previous suggestion and the reviewer's feedback
- Existing comments are formatted as `"author (line N): comment text"` for inline comments and `"author: comment text"` for general comments
- The diff context is the full diff for the current file (not the entire PR)
- Prompts produce valid, complete context strings

## Technical Tasks

- [x] Create `src/services/prompt.ts`
- [x] Define `RefinementPromptInput` type: `{ filePath, lineNumber, prId, prTitle, sourceBranch, destinationBranch, fileDiff, existingComments: Comment[], draft }`
- [x] Implement `formatCommentsForPrompt(comments: Comment[]): string` — format comment threads as readable text for the agent
- [x] Implement `buildRefinementPrompt(input: RefinementPromptInput): string` — full prompt with context + instructions
- [x] Define `RejectionPromptInput` extending `RefinementPromptInput` with `{ previousSuggestion, rejectionReason }`
- [x] Implement `buildRejectionPrompt(input: RejectionPromptInput): string` — includes previous suggestion + feedback
- [x] Write unit tests verifying: all fields present in output, edge cases (no existing comments, no line number, empty draft)

## Prompt Template

```
You are helping a code reviewer write a clear, constructive PR comment.

## Context
File: {filePath}
Line: {lineNumber}
PR: #{prId} — {prTitle}
Branch: {sourceBranch} → {destinationBranch}

## File diff
{fileDiff}

## Existing comments on this file
{existingComments}

## Reviewer's draft comment
{draftComment}

## Instructions
Rewrite the reviewer's draft comment to be:
1. Specific — reference the exact code, variable names, or line numbers
2. Constructive — explain WHY it's a problem and WHAT to do instead
3. Concise — 1-3 sentences, no filler
4. Professional — respectful tone, assume good intent from the author

Return ONLY the refined comment text, nothing else.
```

## Files to Create/Modify

- `src/services/prompt.ts` (create)
- `__tests__/unit/services/prompt.test.ts` (create)

## Dependencies

- None (uses existing `Comment` type from `src/types/review.ts`)

## Notes

- This service will later be extended with prompts for US-14 (agent fix prompts) and Phase B (AI second pass). Keep the architecture extensible.

## Phase

Phase 5 — AI-Assisted Review (EP-01)
