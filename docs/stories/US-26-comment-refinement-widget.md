# US-26: Comment refinement widget

> Part of EP-01: AI-Assisted Review (`docs/epics/EP-01-ai-assisted-review.md`)

## User Story

**As a** reviewer,
**I want to** see my draft comment alongside the AI's suggested refinement,
**so that** I can decide whether to accept, edit, reject, or skip the suggestion.

## Acceptance Criteria

- The widget shows the original draft and the AI suggestion vertically stacked
- A loading state is shown while the agent is processing ("Refining comment..." with dimmed text)
- An error state shows the error message and offers to post the original draft
- Keybindings are displayed at the bottom: `a` accept, `s` skip, `e` edit, `r` reject
- When rejecting, an input field appears for feedback ("Why? ") — Enter sends, Esc cancels back to suggestion
- The widget is a pure presentational component (props-driven, no business logic)

## Layout — Suggestion State

```
┌─────────────────────────────────────────────────┐
│  Comment on src/services/auth.ts:42             │
│                                                 │
│  Your draft:                                    │
│  ┌─────────────────────────────────────────────┐│
│  │ this error handling is wrong                ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Suggested refinement:                          │
│  ┌─────────────────────────────────────────────┐│
│  │ The catch block on L42 swallows the         ││
│  │ exception silently. Consider re-throwing    ││
│  │ or logging the error so failures aren't     ││
│  │ hidden in production.                       ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  a:accept  s:skip  e:edit  r:reject+feedback    │
└─────────────────────────────────────────────────┘
```

## Layout — Rejection Feedback State

```
┌─────────────────────────────────────────────────┐
│  Comment on src/services/auth.ts:42             │
│                                                 │
│  Your draft:                                    │
│  ┌─────────────────────────────────────────────┐│
│  │ this error handling is wrong                ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Suggested refinement:                          │
│  ┌─────────────────────────────────────────────┐│
│  │ The catch block on L42 swallows ...         ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Why do you want to change it?                  │
│  ┌─────────────────────────────────────────────┐│
│  │ the issue isn't about logging, it's about   ││
│  │ the retry logic being missing               ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Enter:send  Esc:cancel                         │
└─────────────────────────────────────────────────┘
```

## Layout — Loading State

```
┌─────────────────────────────────────────────────┐
│  Comment on src/services/auth.ts:42             │
│                                                 │
│  Your draft:                                    │
│  ┌─────────────────────────────────────────────┐│
│  │ this error handling is wrong                ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Refining comment...                            │
│                                                 │
│  Esc:cancel                                     │
└─────────────────────────────────────────────────┘
```

## Layout — Error State

```
┌─────────────────────────────────────────────────┐
│  Comment on src/services/auth.ts:42             │
│                                                 │
│  Your draft:                                    │
│  ┌─────────────────────────────────────────────┐│
│  │ this error handling is wrong                ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Error: Agent timed out                         │
│                                                 │
│  s:post original  Esc:cancel                    │
└─────────────────────────────────────────────────┘
```

## Technical Tasks

- [ ] Create `src/features/diff-review/widgets/CommentRefinement.tsx`
- [ ] Define `CommentRefinementProps`: `{ header, draft, suggestion?, loading, error?, feedbackMode, feedbackText, onFeedbackChange }`
- [ ] Implement `formatRefinementHeader(filePath?: string, lineNumber?: number): string` — pure formatting function
- [ ] Implement loading state rendering: dimmed "Refining comment..." text
- [ ] Implement suggestion state rendering: draft box + suggestion box + keybinding bar
- [ ] Implement error state rendering: error message + "s:post original  Esc:cancel"
- [ ] Implement feedback sub-state rendering: adds feedback input below suggestion
- [ ] All rendering uses OpenTUI primitives: `<box>`, `<text>`, `<input>`
- [ ] Write widget tests for each visual state: `formatRefinementHeader()`, loading, suggestion, error, feedback

## Files to Create/Modify

- `src/features/diff-review/widgets/CommentRefinement.tsx` (create)
- `__tests__/features/diff-review/widgets/CommentRefinement.test.ts` (create)

## Dependencies

- None (pure presentational component, receives all data as props)

## Phase

Phase 5 — AI-Assisted Review (EP-01)
