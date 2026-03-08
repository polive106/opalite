---
"opalite": minor
---

Add agent service for spawning configured AI CLI agents in print mode. Includes `queryAgent()` to capture agent output, `buildAgentCommand()` for template parsing, and `getAgentConfig()` for reading agent configuration. Handles timeout, ENOENT, non-zero exit, and empty output edge cases.
