#!/usr/bin/env bash
set -euo pipefail

# Block git commit if no changeset file exists.
# Changesets are markdown files in .changeset/ (excluding config.json and README.md).

INPUT=$(cat /dev/stdin)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only check git commit commands (skip amend, merge commits, etc.)
if [[ "$COMMAND" =~ git[[:space:]]+commit ]] && [[ "$COMMAND" != *"--amend"* ]]; then
  CHANGESET_DIR=".changeset"

  # Count changeset files (anything that isn't config.json or README.md)
  CHANGESET_COUNT=$(find "$CHANGESET_DIR" -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null | wc -l)

  if [[ "$CHANGESET_COUNT" -eq 0 ]]; then
    echo "CHANGESET REQUIRED: No changeset file found."
    echo ""
    echo "Before committing, create a changeset file to document the version bump:"
    echo ""
    echo "  Create a file .changeset/<short-descriptive-name>.md with:"
    echo ""
    echo '  ---'
    echo '  "opalite": patch'
    echo '  ---'
    echo ""
    echo "  Your description of what changed here."
    echo ""
    echo "Use 'patch' for fixes, 'minor' for new features, 'major' for breaking changes."
    exit 2
  fi
fi
