---
name: review-backlog
description: Review the development backlog to determine what to work on next. Use when asked "what's next", "what should I work on", or to get a prioritized view of remaining work.
---

# Review Backlog

Quickly assess the current state of the opalite backlog and determine what to work on next.

## How It Works

Stories are tracked as individual markdown files under `docs/stories/`. Phases and their order are defined in `CLAUDE.md`.

## Step-by-Step Procedure

### 1. Know the Phases

opalite has 5 phases (from CLAUDE.md):

| Phase | Scope |
|-------|-------|
| Phase 1 | Installation & Setup (US-1 to US-4) |
| Phase 2 | Review Dashboard (US-5 to US-7) |
| Phase 3 | Inline Review (US-8 to US-11) |
| Phase 4 | Author Mode (US-12 to US-17) |
| Phase 5 | Polish (US-18 to US-21) |

### 2. Scan Story Files

List all files in `docs/stories/`. Each story file is a standalone markdown file (e.g., `US-05-pr-dashboard.md`). Read each file to check its status — look for checkboxes, status fields, or completion indicators.

### 3. Identify Next Stories

Scan the phases **in order** (Phase 1 → 2 → 3 → 4 → 5). For each phase, find stories that are **not yet complete**. These are the next candidates.

**Priority rules:**
1. Complete phases in order — don't skip ahead unless all stories in the current phase are done.
2. Within a phase, follow story number order (lower number = higher priority).
3. Check the **Dependencies** field in each story — blocked stories cannot be started.

### 4. Check Story Dependencies

Before recommending a story, read its file in `docs/stories/`. Each story has a **Dependencies** field. Verify that all dependencies are completed before recommending it.

### 5. Present the Results

Output a clear summary with these sections:

#### a) Current Progress Overview

A compact table showing each phase, how many stories are done vs total, and a status indicator.

#### b) What's Next

List the **top 3-5 actionable stories** from the current phase (the earliest incomplete phase). Include:
- Story ID and title
- Complexity (if specified)
- Any unmet dependencies
- Status notes from the story file

#### c) Gaps & Risks

Flag:
- Missing story files (referenced in phases but no file exists)
- Unresolved blockers or dependencies that affect upcoming work
- Stories that seem out of date or inconsistent

## Quick Reference: File Locations

| What | Where |
|------|-------|
| Story files | `docs/stories/US-*.md` |
| Phases & project overview | `CLAUDE.md` |
| Full spec / PRD | `docs/prd.md` |

## Example Output

```
## Current Progress

| Phase | Done | Total | Status |
|-------|------|-------|--------|
| 1. Installation & Setup | 4/4 | 4 | Complete |
| 2. Review Dashboard | 1/3 | 3 | In Progress |
| 3. Inline Review | 0/4 | 4 | Not Started |
| 4. Author Mode | 0/6 | 6 | Not Started |
| 5. Polish | 0/4 | 4 | Not Started |

## Next Up (Phase 2)

1. **US-06: PR Navigation** (S) — Pending, depends on US-05 (done)
2. **US-07: Screen Routing** (M) — Pending, depends on US-06

## Gaps & Risks

- US-09 story file missing from docs/stories/
- US-12 depends on US-11 which is not yet started
```
