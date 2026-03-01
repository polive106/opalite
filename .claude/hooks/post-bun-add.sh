#!/usr/bin/env bash
set -euo pipefail

# Only run tests after "bun add" commands
INPUT=$(cat /dev/stdin)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if [[ "$COMMAND" == *"bun add"* ]]; then
  echo "Running tests after dependency change..."
  bun test
fi
