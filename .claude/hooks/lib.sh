# Shared helpers for the hooks in this folder (sourced, not run). Bash 3.2 safe (macOS).

# Reads the hook JSON from stdin. Sets HOOK_FILE (the absolute, normalised path of the file the
# tool edits; empty if none) and HOOK_REL (that path relative to the repo or worktree root, with
# any `.claude/worktrees/<name>/` prefix stripped; empty if the file is outside the project).
hook_read_paths() {
  local input file cwd project
  input=$(cat)
  if command -v jq >/dev/null 2>&1; then
    file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
    cwd=$(jq -r '.cwd // empty' <<<"$input")
  elif command -v python3 >/dev/null 2>&1; then
    file=$(python3 -c 'import json,sys; t=json.load(sys.stdin).get("tool_input") or {}; print(t.get("file_path") or t.get("notebook_path") or "")' <<<"$input")
    cwd=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd") or "")' <<<"$input")
  else
    echo "hook: need jq or python3 to read the hook input" >&2
    return 1
  fi
  HOOK_FILE=""
  HOOK_REL=""
  [ -n "$file" ] || return 0
  cwd=${cwd:-$PWD}
  case $file in /*) ;; *) file="$cwd/$file" ;; esac
  HOOK_FILE=$(hook_normalise "$file")
  project=$(hook_normalise "${CLAUDE_PROJECT_DIR:-$cwd}")
  HOOK_REL=$(hook_relative "$HOOK_FILE" "$project") || HOOK_REL=""
}

# Collapses `.`, `..` and repeated slashes without touching the filesystem (no symlink resolution).
hook_normalise() {
  local IFS=/ part
  local -a parts out=()
  read -ra parts <<<"$1"
  for part in "${parts[@]}"; do
    case $part in
      '' | .) ;;
      ..) [ ${#out[@]} -gt 0 ] && out=("${out[@]:0:${#out[@]}-1}") ;;
      *) out+=("$part") ;;
    esac
  done
  if [ ${#out[@]} -eq 0 ]; then echo /; else printf '/%s' "${out[@]}"; echo; fi
}

# hook_relative <abs file> <abs project dir>: prints the repo-relative path or returns 1.
# Checks the project dir and, when the project dir is itself a worktree, the main checkout too.
hook_relative() {
  local file=$1 root rel
  local -a roots=("$2")
  if [[ $2 =~ ^(.*)/\.claude/worktrees/[^/]+$ ]]; then roots+=("${BASH_REMATCH[1]}"); fi
  for root in "${roots[@]}"; do
    case $file in
      "$root"/*) rel=${file#"$root"/} ;;
      *) continue ;;
    esac
    if [[ $rel =~ ^\.claude/worktrees/[^/]+/(.*)$ ]]; then rel=${BASH_REMATCH[1]}; fi
    echo "$rel"
    return 0
  done
  return 1
}
