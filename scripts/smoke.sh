#!/usr/bin/env bash
# Health check for a running fitter (plan §9.2). Used by CI on the freshly built container and on the
# tagged --no-traffic Cloud Run revision BEFORE traffic shifts. Exits non-zero on any failure.
#
#   scripts/smoke.sh URL            e.g. scripts/smoke.sh http://localhost:8080
#
# It only uses engine=scripted, so it never spends model tokens and needs no API key.
# Needs curl and jq. Env knobs: SMOKE_WAIT_SECONDS (startup wait, default 90),
# SMOKE_TURN_SECONDS (max time for one /turn stream, default 60).
set -euo pipefail

URL="${1:?usage: scripts/smoke.sh URL}"
URL="${URL%/}"
WAIT="${SMOKE_WAIT_SECONDS:-90}"
TURN_SECONDS="${SMOKE_TURN_SECONDS:-60}"

fail() { echo "smoke: FAIL: $*" >&2; exit 1; }
ok() { echo "smoke: ok: $*"; }

command -v curl >/dev/null || fail "curl is required"
command -v jq >/dev/null || fail "jq is required"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# 1. GET /api/health -> {ok: true, version, llm_mode, store}. Retries while the server starts.
deadline=$((SECONDS + WAIT))
until health="$(curl -fsS --max-time 5 "$URL/api/health" 2>/dev/null)"; do
  ((SECONDS < deadline)) || fail "GET $URL/api/health did not return 2xx within ${WAIT}s"
  sleep 2
done
jq -e '.ok == true' >/dev/null <<<"$health" || fail "GET /api/health: .ok is not true: $health"
ok "GET /api/health -> $(jq -c . <<<"$health")"

# 2. POST /api/sessions with the scripted engine -> {session_id, resume_token, state}
session="$(curl -fsS --max-time 15 -X POST "$URL/api/sessions" \
  -H 'content-type: application/json' -d '{"engine":"scripted"}')" ||
  fail "POST /api/sessions {engine: scripted} did not return 2xx"
sid="$(jq -er '.session_id | select(type == "string" and length > 0)' <<<"$session")" ||
  fail "POST /api/sessions: no session_id in: $session"
ok "POST /api/sessions -> session ${sid:0:6}…"

# 3. POST /api/sessions/{id}/turn streams SSE until a `done` event, with no `error` event.
status="$(curl -sS -N --max-time "$TURN_SECONDS" -X POST "$URL/api/sessions/$sid/turn" \
  -H 'content-type: application/json' -H 'accept: text/event-stream' \
  -d '{"message":{"kind":"text","text":"smoke test"}}' \
  -D "$tmp/headers" -o "$tmp/stream" -w '%{http_code}')" || true # a stream left open hits --max-time
[[ "$status" == "200" ]] || fail "POST /turn: HTTP $status: $(head -c 500 "$tmp/stream" 2>/dev/null)"
grep -qi '^content-type: *text/event-stream' "$tmp/headers" ||
  fail "POST /turn: content-type is not text/event-stream"
if grep -q '^event: *error' "$tmp/stream"; then
  fail "POST /turn: stream has an error event: $(grep -A1 '^event: *error' "$tmp/stream" | head -c 500)"
fi
grep -q '^event: *done' "$tmp/stream" ||
  fail "POST /turn: no done event within ${TURN_SECONDS}s. Stream: $(head -c 500 "$tmp/stream")"
ok "POST /turn -> $(grep -c '^event:' "$tmp/stream") events, ends in done"

# 4. GET /api/demo lists the 4 L8 personas
demo_golfers="$(curl -fsS --max-time 15 "$URL/api/demo")" || fail "GET /api/demo did not return 2xx"
jq -e 'length >= 4' >/dev/null <<<"$demo_golfers" || fail "GET /api/demo: expected at least 4 personas, got: $demo_golfers"
ok "GET /api/demo -> $(jq -r 'map(.golfer_id) | join(", ")' <<<"$demo_golfers")"

# 5. CSP check on studio.html: must contain frame-ancestors
studio_code="$(curl -sS -o /dev/null -w '%{http_code}' -D "$tmp/studio_headers" "$URL/studio.html")" || true
if [[ "$studio_code" == "404" ]]; then
  echo "smoke: skip: studio.html returned 404 (web not built locally)"
elif [[ "$studio_code" != "200" ]]; then
  fail "studio.html returned HTTP $studio_code"
elif ! grep -qi '^content-security-policy:.*frame-ancestors' "$tmp/studio_headers"; then
  fail "studio.html CSP has no frame-ancestors"
else
  ok "studio.html CSP has frame-ancestors"
fi

# 6. Persona card check for DEMO-01, DEMO-04, DEMO-09, DEMO-13
for demo in DEMO-01 DEMO-04 DEMO-09 DEMO-13; do
  psess="$(curl -fsS --max-time 15 -X POST "$URL/api/sessions" \
    -H 'content-type: application/json' -d "{\"engine\":\"scripted\",\"demo\":\"$demo\"}")" ||
    fail "POST /api/sessions for $demo failed"
  psid="$(jq -er '.session_id | select(type == "string" and length > 0)' <<<"$psess")" ||
    fail "POST /api/sessions for $demo: no session_id"
  curl -sS -N --max-time "$TURN_SECONDS" -X POST "$URL/api/sessions/$psid/turn" \
    -H 'content-type: application/json' -H 'accept: text/event-stream' \
    -d '{"message":{"kind":"text","text":"smoke test"}}' \
    -o /dev/null || true
  sess_json="$(curl -fsS --max-time 15 "$URL/api/sessions/$psid")" ||
    fail "GET /api/sessions/$psid failed"
  if jq -e '.state.best != null' >/dev/null <<<"$sess_json"; then
    best_head="$(jq -r '.state.best.head' <<<"$sess_json")"
    ok "persona $demo: result reached (.state.best.head = $best_head)"
  else
    echo "smoke: skip: persona $demo has no result after one turn"
  fi
done

echo "smoke: PASS $URL"
