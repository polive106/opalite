# US-21: Export prompt to clipboard

## User Story

**As a** PR author,
**I want to** copy the generated agent prompt to my clipboard,
**so that** I can paste it into an agent manually if I prefer.

## Acceptance Criteria

- In CommentQueue, pressing `e` on a comment copies the generated prompt to the system clipboard
- A confirmation message is shown: "Prompt copied to clipboard"
- Works on macOS (pbcopy), Linux (xclip/xsel), and WSL

## Technical Tasks

- [ ] Create `src/services/clipboard.ts` with cross-platform clipboard write function
- [ ] Detect platform and use appropriate clipboard command: `pbcopy` (macOS), `xclip -selection clipboard` or `xsel --clipboard --input` (Linux), `clip.exe` (WSL)
- [ ] Integrate with CommentQueue: `e` generates prompt (US-14) and copies to clipboard
- [ ] Show "Prompt copied to clipboard" confirmation message after successful copy
- [ ] Handle errors gracefully (clipboard tool not installed, etc.)

## Files to Create/Modify

- `src/services/clipboard.ts` (create)
- `src/screens/CommentQueue.tsx` (modify — wire up `e` to clipboard export)

## Dependencies

- US-14 (prompt generation must exist)
- US-13 (CommentQueue must exist)

## Phase

Phase 5 — Polish
