# US-25: Comment refinement loop hook

> Part of EP-01: AI-Assisted Review (`docs/epics/EP-01-ai-assisted-review.md`)

## User Story

**As a** developer,
**I want** a hook that manages the refinement loop state machine,
**so that** the UI can drive the accept/reject/edit cycle.

## Acceptance Criteria

- `useCommentRefinement()` manages the state: idle → loading → suggestion → (accept | skip | edit | reject+feedback → loading → ...)
- When triggered with a draft comment + context, it calls `queryAgent()` and transitions to showing-suggestion
- Accept: returns the refined text, transitions to idle
- Skip: returns the original draft, transitions to idle
- Edit: returns the refined text for editing, transitions to idle
- Reject: takes feedback string, calls `queryAgent()` again with rejection prompt, transitions back to loading → showing-suggestion
- Error handling: if agent fails, shows error and offers to post original draft
- If no agent is configured, immediately returns the original draft (no refinement step)
- Tracks the full conversation history (draft → suggestion → rejection → suggestion → ...) for multi-round context

## State Machine

```
                      ┌──────────┐
                      │   idle   │
                      └────┬─────┘
                           │ refine(draft, context)
                           ▼
                      ┌──────────┐
               ┌──────│ loading  │◄─────────────┐
               │      └────┬─────┘              │
               │ error     │ success            │ reject(feedback)
               ▼           ▼                    │
         ┌──────────┐ ┌──────────────┐          │
         │  error   │ │  suggestion  │──────────┘
         └────┬─────┘ └──┬───┬───┬──┘
              │          │   │   │
              │ skip     │   │   │ edit
              ▼     accept  skip  ▼
         ┌──────────┐   │   │  ┌──────────┐
         │   idle   │   ▼   ▼  │   idle   │
         └──────────┘ ┌──────┐ └──────────┘
                      │ idle │   (returns refined
                      └──────┘    text for editor)
```

## Technical Tasks

- [x] Create `src/features/diff-review/hooks/useCommentRefinement.ts`
- [x] Define `RefinementStatus` type: `'idle' | 'loading' | 'suggestion' | 'error'`
- [x] Define `RefinementState` type: `{ status, draft, suggestion?, error?, history: Array<{ suggestion, feedback }> }`
- [x] Implement `useCommentRefinement(config: OpaliteConfig)` returning `{ state, refine, accept, skip, edit, reject, cancel }`
- [x] `refine(draft, context)` — build prompt via `buildRefinementPrompt()`, call `queryAgent()`, update state
- [x] `accept()` — return suggestion, reset to idle
- [x] `skip()` — return original draft, reset to idle
- [x] `edit()` — return suggestion text for loading into editor, reset to idle
- [x] `reject(feedback)` — append to history, build rejection prompt via `buildRejectionPrompt()`, call `queryAgent()`, update state
- [x] `cancel()` — kill agent process if running, reset to idle
- [x] Handle no-agent: `refine()` immediately returns `{ status: 'idle' }` with draft as result
- [x] Handle multi-round: history truncated to last 3 rounds in prompt to avoid context limits
- [x] Write unit tests for all state transitions with mocked `queryAgent()`

## Files to Create/Modify

- `src/features/diff-review/hooks/useCommentRefinement.ts` (create)
- `__tests__/features/diff-review/hooks/useCommentRefinement.test.ts` (create)

## Dependencies

- US-23 (agent service — `queryAgent()`)
- US-24 (prompt builder — `buildRefinementPrompt()`, `buildRejectionPrompt()`)

## Phase

Phase 5 — AI-Assisted Review (EP-01)
