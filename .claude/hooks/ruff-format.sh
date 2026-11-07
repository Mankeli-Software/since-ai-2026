#!/usr/bin/env bash
# PostToolUse hook for Edit|Write (plan §10.5): runs `ruff format` on an edited .py file under
# backend/. Skips silently when uv or the backend project isn't there, and never fails the edit.
# --frozen keeps uv from rewriting backend/uv.lock.

# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

hook_read_paths 2>/dev/null || exit 0
case $HOOK_REL in
  backend/*.py) ;;
  *) exit 0 ;;
esac
[ -f "$HOOK_FILE" ] || exit 0
command -v uv >/dev/null 2>&1 || exit 0

# The backend/ folder of whichever checkout (main or worktree) holds the file.
backend="${HOOK_FILE%"$HOOK_REL"}backend"
[ -f "$backend/pyproject.toml" ] || exit 0

uv run --quiet --frozen --project "$backend" ruff format --quiet "$HOOK_FILE" >&2 || true
exit 0
