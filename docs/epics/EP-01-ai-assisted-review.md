# EP-01: AI-Assisted PR Review

> Epic spec for adding AI-powered comment refinement to opalite's reviewer mode.

---

## Problem

Writing good review comments is hard. Engineers often:
- Write vague comments ("this doesn't look right") that don't help the author
- Struggle to articulate *why* something is a problem and *what* to do instead
- Spend time wordsmithing when they should be reviewing
- Miss issues because they're focused on writing comments for the issues they already found

The company already has an automated AI reviewer that does a first pass. What's missing is **AI assistance during the human review** — helping engineers write clearer, more constructive comments, and then doing a second pass to catch anything the human missed.

---

## Vision

Two-phase AI-assisted review workflow:

### Phase A: Manual Review with AI Comment Refinement
The engineer reviews the PR file-by-file as they normally would. When they write a comment, an AI agent refines it — making it clearer, more constructive, and more actionable. This is a conversational loop: the engineer can reject the suggestion and explain why, and the agent tries again until the engineer is satisfied.

### Phase B: AI Second Pass (future)
After the manual review is complete, the AI does a second pass over the diff. It has full context: the diff itself, all existing comments (from the automated reviewer + other humans), and the comments the engineer just wrote. It proposes additional comments for anything that was missed. The engineer triages these one by one.

**This epic covers Phase A. Phase B will be a separate epic.**

---

## User Flow (Phase A)

```
1. Engineer selects a PR from the dashboard → enters DiffNav
2. Engineer browses diff file-by-file (existing flow)
3. Engineer spots something → presses `c` → types their draft comment
4. Engineer presses Enter to submit
   ┌─────────────────────────────────────────────────┐
   │ Instead of posting directly to Bitbucket...     │
   │                                                 │
   │ → Agent is spawned with:                        │
   │   - The file diff (current file)                │
   │   - Existing comments on this file              │
   │   - The engineer's draft comment                │
   │   - The line number / file path                 │
   │                                                 │
   │ → Agent returns a refined comment suggestion    │
   └─────────────────────────────────────────────────┘
5. Refinement screen appears:
   ┌─────────────────────────────────────────────────┐
   │  Your draft:                                    │
   │  "this error handling is wrong"                 │
   │                                                 │
   │  ─── Suggested refinement ───                   │
   │  "The catch block on L42 swallows the           │
   │   exception silently. Consider re-throwing      │
   │   or logging the error so failures aren't       │
   │   hidden in production."                        │
   │                                                 │
   │  [a] Accept  [s] Skip (post original)           │
   │  [e] Edit    [r] Reject + explain why           │
   └─────────────────────────────────────────────────┘
6a. Accept → refined comment is posted to Bitbucket
6b. Skip → original draft is posted as-is
6c. Edit → refined text is loaded into the comment editor for manual tweaking → Enter posts it
6d. Reject + explain → engineer types why they don't like it →
    agent tries again with the feedback → back to step 5
    (loop continues until accept, skip, or Esc to cancel entirely)
```

---

## Architecture

### Where this fits in the existing codebase

This feature lives entirely within the `diff-review` feature slice and adds one new service. It hooks into the existing comment submission flow — intercepting the moment between "user presses Enter" and "comment is posted to Bitbucket."

```
src/
├── services/
│   ├── agent.ts                          # NEW — agent CLI spawning (print mode)
│   └── prompt.ts                         # NEW — prompt templates for comment refinement
├── features/
│   └── diff-review/
│       ├── hooks/
│       │   ├── useCommentEditor.ts        # MODIFY — add refinement state to submit flow
│       │   └── useCommentRefinement.ts    # NEW — refinement loop state machine
│       ├── widgets/
│       │   └── CommentRefinement.tsx      # NEW — side-by-side draft vs suggestion UI
│       └── ui/
│           └── DiffNav.tsx                # MODIFY — wire refinement into comment flow
```

### Data flow

```
User types draft → Enter
  │
  ▼
useCommentEditor.submit()
  │ (instead of posting directly)
  ▼
useCommentRefinement.refine(draft, context)
  │
  ▼
buildRefinementPrompt(draft, fileDiff, existingComments, filePath, lineNumber)
  │
  ▼
queryAgent(prompt, agentConfig)  ← spawns claude/cursor CLI in print mode
  │
  ▼
Agent returns refined text
  │
  ▼
CommentRefinement widget shows draft vs suggestion
  │
  ├── Accept → postPRComment(refined text)
  ├── Skip   → postPRComment(original draft)
  ├── Edit   → load refined text into editor → user tweaks → post
  └── Reject + feedback → buildRefinementPrompt(draft, feedback, previousSuggestion) → loop
```

### Agent spawning

The agent service (`src/services/agent.ts`) wraps `Bun.spawn()` to call the configured agent CLI. This epic only needs **print mode** (capture stdout), not interactive mode.

The agent CLI is configured in `.opalite.yml` or `~/.config/opalite/config.yml`:

```yaml
agent:
  default: claude-code
  claude-code:
    interactive: claude "{prompt}"
    print: claude --print "{prompt}"
    print_json: claude --print --output-format json "{prompt}"
  cursor:
    interactive: agent "{prompt}"
    print: agent -p "{prompt}"
    print_json: agent -p --output-format json "{prompt}"
```

The `queryAgent()` function:
1. Reads the configured agent and its `print` command template
2. Replaces `{prompt}` with the actual prompt
3. Spawns the process via `Bun.spawn()`, captures stdout
4. Returns the text output

If no agent is configured, the comment is posted directly (no refinement) with a one-time hint: "Tip: Configure an AI agent in your config to get comment suggestions."

### Prompt design

The refinement prompt includes all the context the agent needs to write a good review comment:

```
You are helping a code reviewer write a clear, constructive PR comment.

## Context

**File:** {filePath}
**Line:** {lineNumber}
**PR:** #{prId} — {prTitle}
**Branch:** {sourceBranch} → {destinationBranch}

## File diff

{fileDiff}

## Existing comments on this file

{existingComments — formatted as "author (line N): comment text"}

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

For rejection feedback, the prompt is extended:

```
## Previous suggestion

{previousSuggestion}

## Reviewer's feedback on the suggestion

{rejectionReason}

## Instructions

The reviewer didn't accept your previous suggestion. Take their feedback into account
and try again. Return ONLY the refined comment text, nothing else.
```

---

## Stories

### US-23: Agent service (print mode)

**As a** developer,
**I want** a service that spawns the configured agent CLI and captures its output,
**so that** AI features can query the agent programmatically.

**Acceptance Criteria:**
- `queryAgent(prompt, config)` spawns the agent in print mode and returns stdout as a string
- The command is built from the config template by replacing `{prompt}` with the actual prompt
- The prompt is passed via stdin (piped) to avoid shell escaping issues with long prompts
- If the agent process exits with a non-zero code, an error is thrown with the stderr output
- If no agent is configured, `queryAgent` returns `null` (not an error — graceful degradation)
- Timeout of 60 seconds — if the agent doesn't respond, the promise rejects

**Technical Tasks:**
- [ ] Create `src/services/agent.ts` with `AgentConfig` type
- [ ] Implement `buildAgentCommand(template: string): string[]` — parse template into command + args, replacing `{prompt}` placeholder
- [ ] Implement `queryAgent(prompt: string, config: OpaliteConfig): Promise<string | null>` — spawn in print mode, pipe prompt via stdin, capture stdout
- [ ] Implement `getAgentConfig(config: OpaliteConfig): AgentConfig | null` — read agent config, return null if not configured
- [ ] Handle edge cases: agent not installed (ENOENT), timeout, non-zero exit, empty output
- [ ] Write unit tests with mocked `Bun.spawn()`

**Files to Create/Modify:**
- `src/services/agent.ts` (create)
- `src/types/agent.ts` (create — AgentConfig, AgentMode types)
- `__tests__/unit/services/agent.test.ts` (create)

**Dependencies:** None (US-3 config already has `agent` field)

**Note:** This story is a prerequisite for US-15 (fix comment with agent) as well. The interactive mode and JSON mode from US-15 can be added to this service later. This story only implements print mode.

---

### US-24: Comment refinement prompt builder

**As a** developer,
**I want** a function that builds a well-structured prompt for comment refinement,
**so that** the agent has all the context it needs to improve a review comment.

**Acceptance Criteria:**
- `buildRefinementPrompt(input)` returns a string prompt containing: file path, line number, PR metadata, file diff, existing comments, and the reviewer's draft
- `buildRejectionPrompt(input)` extends the prompt with the previous suggestion and the reviewer's feedback
- Existing comments are formatted as `"author (line N): comment text"` for inline comments and `"author: comment text"` for general comments
- The diff context is the full diff for the current file (not the entire PR)
- Prompts are tested to produce valid, complete context strings

**Technical Tasks:**
- [ ] Create `src/services/prompt.ts`
- [ ] Implement `RefinementPromptInput` type: `{ filePath, lineNumber, prId, prTitle, sourceBranch, destinationBranch, fileDiff, existingComments: Comment[], draft }`
- [ ] Implement `buildRefinementPrompt(input: RefinementPromptInput): string`
- [ ] Implement `RejectionPromptInput` extending `RefinementPromptInput` with `{ previousSuggestion, rejectionReason }`
- [ ] Implement `buildRejectionPrompt(input: RejectionPromptInput): string`
- [ ] Implement `formatCommentsForPrompt(comments: Comment[]): string` — helper to format comment threads as readable text
- [ ] Write unit tests verifying prompt structure, all fields included, edge cases (no existing comments, no line number for general comments)

**Files to Create/Modify:**
- `src/services/prompt.ts` (create)
- `__tests__/unit/services/prompt.test.ts` (create)

**Dependencies:** None (uses existing `Comment` type from `src/types/review.ts`)

**Note:** This service will later be extended with prompts for US-14 (agent fix prompts) and Phase B (AI second pass). The architecture should allow adding new prompt types easily.

---

### US-25: Comment refinement loop hook

**As a** developer,
**I want** a hook that manages the refinement loop state machine,
**so that** the UI can drive the accept/reject/edit cycle.

**Acceptance Criteria:**
- `useCommentRefinement()` manages the state: idle → loading → showing-suggestion → (accept | skip | edit | reject+feedback → loading → ...)
- When triggered with a draft comment + context, it calls `queryAgent()` and transitions to showing-suggestion
- Accept: returns the refined text, transitions to idle
- Skip: returns the original draft, transitions to idle
- Edit: returns the refined text for editing, transitions to idle
- Reject: takes feedback string, calls `queryAgent()` again with rejection prompt, transitions back to loading → showing-suggestion
- Error handling: if agent fails, shows error and offers to post original draft
- If no agent is configured, immediately returns the original draft (no refinement step)
- Tracks the full conversation history (draft → suggestion → rejection → suggestion → ...) for multi-round context

**State machine:**
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
                      (returns
                       final text)
```

**Technical Tasks:**
- [ ] Create `src/features/diff-review/hooks/useCommentRefinement.ts`
- [ ] Define `RefinementState` type: `{ status: 'idle' | 'loading' | 'suggestion' | 'error', draft: string, suggestion?: string, error?: string, history: Array<{ suggestion: string, feedback: string }> }`
- [ ] Implement `useCommentRefinement(config: OpaliteConfig)` hook returning `{ state, refine, accept, skip, edit, reject }`
- [ ] `refine(draft, context)` — build prompt, call agent, update state
- [ ] `accept()` — return suggestion, reset state
- [ ] `skip()` — return original draft, reset state
- [ ] `edit()` — return suggestion for manual editing, reset state
- [ ] `reject(feedback)` — build rejection prompt with history, call agent, update state
- [ ] Handle multi-round: each rejection appends to history, prompt includes full conversation
- [ ] Handle no-agent gracefully: `refine()` immediately returns the draft as-is
- [ ] Write unit tests for state transitions with mocked `queryAgent()`

**Files to Create/Modify:**
- `src/features/diff-review/hooks/useCommentRefinement.ts` (create)
- `__tests__/features/diff-review/hooks/useCommentRefinement.test.ts` (create)

**Dependencies:** US-23 (agent service), US-24 (prompt builder)

---

### US-26: Comment refinement widget

**As a** reviewer,
**I want to** see my draft comment alongside the AI's suggested refinement,
**so that** I can decide whether to accept, edit, reject, or skip the suggestion.

**Acceptance Criteria:**
- The widget shows the original draft and the AI suggestion side by side (vertically stacked)
- A loading state is shown while the agent is processing ("Refining comment..." with a spinner or dimmed text)
- An error state shows the error message and offers to post the original draft
- Keybindings are displayed at the bottom: `a` accept, `s` skip, `e` edit, `r` reject
- When rejecting, an input field appears for the feedback ("Why? ") — Enter sends, Esc cancels back to the suggestion
- The widget is a pure presentational component (props-driven, no business logic)

**Layout:**
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

**Rejection feedback sub-state:**
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

**Technical Tasks:**
- [ ] Create `src/features/diff-review/widgets/CommentRefinement.tsx`
- [ ] Implement `CommentRefinementProps`: `{ header, draft, suggestion?, loading, error?, feedbackMode, feedbackText, onFeedbackChange }`
- [ ] Implement `formatRefinementHeader(filePath, lineNumber): string`
- [ ] Implement loading state: dimmed "Refining comment..." text
- [ ] Implement suggestion state: draft box + suggestion box + keybinding bar
- [ ] Implement error state: error message + "s:post original  Esc:cancel"
- [ ] Implement feedback sub-state: draft + suggestion + feedback input + "Enter:send  Esc:cancel"
- [ ] All rendering uses OpenTUI primitives: `<box>`, `<text>`, `<input>`
- [ ] Write widget tests for each visual state (loading, suggestion, error, feedback)

**Files to Create/Modify:**
- `src/features/diff-review/widgets/CommentRefinement.tsx` (create)
- `__tests__/features/diff-review/widgets/CommentRefinement.test.ts` (create)

**Dependencies:** None (pure presentational, receives all data as props)

---

### US-27: Wire refinement into DiffNav comment flow

**As a** reviewer,
**I want** the refinement loop to appear automatically after I write a comment,
**so that** I get AI help without extra steps.

**Acceptance Criteria:**
- When the user submits a comment (Enter in CommentEditor), the refinement flow starts instead of posting directly
- If no agent is configured, the comment is posted directly (existing behavior, no change)
- The CommentRefinement widget replaces the CommentEditor in the DiffNav layout while active
- Accept: posts the refined comment to Bitbucket, refreshes comments, closes the refinement
- Skip: posts the original draft to Bitbucket, refreshes comments, closes the refinement
- Edit: loads the refined text back into the CommentEditor for manual tweaking (user is back in editor mode)
- Reject: shows feedback input, sends feedback to agent, shows new suggestion (loop)
- Esc at any point: cancels entirely (no comment posted, back to diff browsing)
- Keyboard handling: refinement keys (`a`, `s`, `e`, `r`, `Esc`) are active only when refinement widget is showing, and they don't conflict with DiffNav keys (DiffNav keys are suppressed during refinement, same as during comment editing)
- After posting (accept/skip/edit+submit), a brief success flash: "Comment posted" in green, then back to diff

**Technical Tasks:**
- [ ] Modify `DiffNav.tsx`: add `useCommentRefinement()` hook
- [ ] Modify comment submit flow: `handleSubmit` triggers `refinement.refine(draft, context)` instead of `editor.submit()`
- [ ] Build context for refinement: current file diff, existing comments for current file, PR metadata
- [ ] Add keyboard handler for refinement state: `a` accept, `s` skip, `e` edit, `r` reject, `Esc` cancel
- [ ] Render `CommentRefinement` widget when refinement is active (replaces `CommentEditor` in the layout)
- [ ] On accept/skip: call `postPRComment()` with the final text, refresh comments, close refinement
- [ ] On edit: set CommentEditor text to refined suggestion, close refinement, re-open editor
- [ ] Suppress DiffNav keybindings when refinement is active (same pattern as `editorOpen` check)
- [ ] Handle graceful degradation: if `queryAgent()` returns null (no agent), post directly
- [ ] Write integration test: mock fetch + mock agent → full flow from draft → refinement → accept → posted

**Files to Create/Modify:**
- `src/features/diff-review/ui/DiffNav.tsx` (modify)
- `src/features/diff-review/hooks/useCommentEditor.ts` (modify — decouple submit from post, expose draft for refinement)
- `__tests__/features/diff-review/integration/CommentRefinement.test.ts` (create)

**Dependencies:** US-23, US-24, US-25, US-26

---

## Implementation Order

```
US-23: Agent service ─────────┐
                               ├──► US-25: Refinement hook ──┐
US-24: Prompt builder ────────┘                               ├──► US-27: Wire into DiffNav
                                                              │
US-26: Refinement widget ─────────────────────────────────────┘
```

US-23 and US-24 can be built in parallel (no dependencies on each other).
US-26 can be built in parallel with US-25 (widget is pure presentational).
US-27 ties everything together.

**Suggested dev order:**
1. US-23 + US-24 + US-26 in parallel (all independent)
2. US-25 (needs US-23 + US-24)
3. US-27 (needs everything)

---

## Config Changes

### Existing config (no changes needed)

The `agent` field in `.opalite.yml` / `~/.config/opalite/config.yml` already supports the command templates needed:

```yaml
agent:
  default: claude-code
  claude-code:
    print: claude --print "{prompt}"
  cursor:
    print: agent -p "{prompt}"
```

### Future consideration

If teams want to disable AI refinement (e.g., the automated reviewer is enough), a config flag could be added:

```yaml
review:
  ai_refinement: true  # default true when agent is configured
```

This is NOT needed for the initial implementation — if an agent is configured, refinement is on. If not, it's off.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No agent configured | Comment posts directly (existing behavior). One-time hint in status bar. |
| Agent not installed (ENOENT) | Error shown: "Agent not found. Check your config or run `opalite init`." Offer to post original. |
| Agent times out (>60s) | Error shown: "Agent timed out." Offer to post original. |
| Agent returns empty output | Error shown: "Agent returned empty suggestion." Offer to post original. |
| Agent returns very long suggestion | Suggestion is shown in a scrollable box. No truncation. |
| User rejects 5+ times | No limit. The loop continues. History is truncated to last 3 rounds in the prompt to avoid exceeding context limits. |
| Bitbucket API fails on post | Existing error handling in `postPRComment()` applies. Error shown, user can retry. |
| User presses Esc during loading | Agent process is killed, refinement cancelled, no comment posted. |
| Comment is a reply (not inline) | Refinement still works. Prompt includes parent comment thread for context. |
| General comment (no file/line) | Refinement works. Prompt omits file/line context, includes PR-level diff summary instead. |

---

## Relationship to Existing Stories

| Story | Relationship |
|-------|-------------|
| **US-10** (leave comments) | US-27 modifies the submit flow introduced by US-10. The comment editor itself is unchanged. |
| **US-15** (fix comment with agent) | US-23 (agent service) is a shared prerequisite. US-15 needs interactive mode, this epic only needs print mode. Both will use `src/services/agent.ts`. |
| **US-14** (generate agent prompts) | US-24 (prompt builder) is a separate service but lives in the same file (`src/services/prompt.ts`). US-14's fix prompts will be added later. |
| **US-18** (AI review suggestions) | Phase B of this epic. Will build on the agent service and prompt builder from this epic. |
| **US-19** (AI comment assist — Tab) | Superseded by this epic. US-19 was a simpler "Tab to autocomplete" approach. This epic replaces it with a richer refinement loop. The `Tab` handler stub in CommentEditor can be removed. |

---

## Testing Strategy

Follows the project's three-layer testing architecture:

### Layer 1: Widget tests
- `CommentRefinement.tsx` rendering for each state (loading, suggestion, error, feedback)
- Pure data formatting functions

### Layer 2: Hook tests
- `useCommentRefinement` state machine transitions
- Agent service `queryAgent()` with mocked `Bun.spawn()`
- Prompt builder output validation

### Layer 3: Integration tests
- Full flow: mock `globalThis.fetch` (Bitbucket) + mock agent spawn → draft comment → refinement → accept → comment posted
- Rejection loop: draft → suggestion → reject with feedback → new suggestion → accept
- Error recovery: agent fails → user posts original
- No-agent graceful degradation: comment posts directly

---

## Open Questions

1. **Should refinement be optional per-comment?** Currently, every comment goes through refinement if an agent is configured. An alternative: press `Enter` to post directly, press a different key (e.g., `Ctrl+Enter`) to post with refinement. This gives the user control but adds friction.

2. **Should we show a diff between draft and suggestion?** For long comments, highlighting what the agent changed could be helpful. OpenTUI's `<diff>` component could be used, but it might be overkill for 1-3 sentence comments.

3. **Reply refinement context:** When refining a reply, should the prompt include the full thread (parent + all replies) or just the parent comment? Full thread gives better context but uses more tokens.
