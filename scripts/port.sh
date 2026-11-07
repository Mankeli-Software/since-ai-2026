#!/usr/bin/env bash
# Print this worktree's API port. Found once, then cached in <repo>/.port (gitignored).
# The web dev server uses API_PORT + 1, so both ports must be free.
# Override for one run with API_PORT=xxxx; delete .port to pick a new one.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="$root/.port"

if [[ -s "$cache" ]] && [[ "$(<"$cache")" =~ ^[0-9]+$ ]]; then
  cat "$cache"
  exit 0
fi

# True if something is listening on 127.0.0.1:$1.
in_use() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Start from a per-worktree offset so parallel worktrees rarely collide,
# then probe even ports in 8100..8998 for a free (port, port+1) pair.
lo=8100 span=450
start=$(( $(printf '%s' "$root" | cksum | cut -d' ' -f1) % span ))
for (( i = 0; i < span; i++ )); do
  port=$(( lo + 2 * ((start + i) % span) ))
  if ! in_use "$port" && ! in_use "$((port + 1))"; then
    printf '%s\n' "$port" >"$cache"
    printf '%s\n' "$port"
    exit 0
  fi
done

echo "port.sh: no free port pair in $lo-$((lo + 2 * span))" >&2
exit 1
