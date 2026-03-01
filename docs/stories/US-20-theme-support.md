# US-20: Theme support

## User Story

**As a** user,
**I want to** choose between different color themes,
**so that** opalite matches my terminal aesthetic.

## Acceptance Criteria

- Three themes are available: Tokyo Night (default), GitHub Dark, Catppuccin
- The theme is configurable via `display.theme` in `.opalite.yml` or local config
- All screens and components respect the active theme
- Colors degrade gracefully on terminals with limited color support

## Technical Tasks

- [ ] Create `src/theme/github-dark.ts` with GitHub Dark color palette
- [ ] Create `src/theme/catppuccin.ts` with Catppuccin color palette
- [ ] Create a theme loader/selector that reads `display.theme` from config and returns the active theme
- [ ] Update all screens and components to use theme colors from the active theme (not hardcoded)
- [ ] Implement graceful color degradation for terminals with limited color support
- [ ] Add theme selection to `opalite init` wizard (or document config option)

## Files to Create/Modify

- `src/theme/github-dark.ts` (create)
- `src/theme/catppuccin.ts` (create)
- `src/theme/tokyo-night.ts` (modify — ensure consistent theme interface)
- `src/theme/index.ts` (create — theme loader/selector)
- `src/services/config.ts` (modify — read theme from config)

## Dependencies

- US-5 (Dashboard and components must exist to apply themes to)

## Phase

Phase 5 — Polish
