---
"opalite": minor
---

Wire AI comment refinement into the DiffNav comment flow. When a reviewer submits a comment and an agent is configured, the draft is refined through a conversational AI loop (accept/skip/edit/reject) before posting to Bitbucket. Gracefully degrades to direct posting when no agent is configured.
