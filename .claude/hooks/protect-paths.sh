#!/usr/bin/env bash
# PreToolUse hook for Edit|Write|NotebookEdit (plan §10.5). Blocks edits to vendored and generated
# files: anchored paths relative to the repo root (or to a worktree under .claude/worktrees/).
# Exit 2 blocks the tool call and shows stderr to Claude; exit 0 lets the normal permission flow run.
# backend/app/schemas/ is hand-written and stays editable.

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

if ! hook_read_paths; then
  echo "protect-paths: could not read the hook input, blocking to be safe" >&2
  exit 2
fi
[ -n "$HOOK_REL" ] || exit 0

protected='^(data|vendor|generated)/|^web/src/api/schema\.gen\.ts$|^backend/uv\.lock$|^web/pnpm-lock\.yaml$'
if [[ $HOOK_REL =~ $protected ]]; then
  echo "protected: vendored or generated ($HOOK_REL)" >&2
  exit 2
fi
exit 0
