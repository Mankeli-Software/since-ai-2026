# Takomo Fitter Studio. Run every recipe from the repo (or worktree) root. Plan §10.4.
# No `test` recipe on purpose: we have no test pipeline (L17). Verify with `just check` + `just dev`.

set dotenv-load

export LLM_MODE := env("LLM_MODE", "mock")
export PYTHONPATH := justfile_directory() + "/vendor"
lab := justfile_directory() + "/data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026"
# Finds a free port once per worktree and caches it in .port. Web runs on api_port + 1.
api_port := env("API_PORT", `scripts/port.sh`)
web_missing := "web/ not scaffolded yet (#35), skipping the web step"

# List recipes
default:
    @{{just_executable()}} --list

# Install backend + web deps, then generate the contracts
setup:
    uv sync --project backend
    @if [ -f web/package.json ]; then pnpm -C web install; else echo "{{web_missing}}"; fi
    {{just_executable()}} gen

# Export OpenAPI + JSON schemas to generated/, then web/src/api/schema.gen.ts (nothing generated is committed)
gen:
    cd backend && PYTHONPATH=../vendor uv run python -m app.core.export --out ../generated
    @if [ -f web/package.json ]; then pnpm -C web gen; else echo "{{web_missing}}"; fi

# Backend (uvicorn --reload) on api_port + web (vite) on api_port+1
dev: gen
    #!/usr/bin/env bash
    set -euo pipefail
    web_port=$(({{api_port}} + 1))
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
    echo "api: http://localhost:{{api_port}}  web: http://localhost:$web_port  LLM_MODE=$LLM_MODE"
    uv run --project backend uvicorn app.main:app --reload --port {{api_port}} --app-dir backend &
    if [ -f web/package.json ]; then
      API_PORT={{api_port}} pnpm -C web dev --port "$web_port" --strictPort &
    else
      echo "{{web_missing}}"
    fi
    wait

# Backend under the Genkit Dev UI (traces at http://localhost:4000)
genkit:
    genkit start -- uv run --project backend uvicorn app.main:app --reload --port {{api_port}} --app-dir backend

# ruff check + ruff format --check + lint-imports, then web typecheck + lint
lint:
    cd backend && uv run ruff check . && uv run ruff format --check . && uv run lint-imports
    @if [ -f web/package.json ]; then pnpm -C web typecheck && pnpm -C web lint; else echo "{{web_missing}}"; fi

# The local gate: gen + lint (what CI checks, minus build + smoke)
check: gen lint

# Demo fixtures (never from labels), priors.json, thresholds.json
gen-data:
    uv run --project backend python scripts/gen_fixtures.py
    PYTHONPATH={{PYTHONPATH}}:{{lab}} uv run --project backend python scripts/gen_priors.py
    PYTHONPATH={{PYTHONPATH}}:{{lab}} uv run --project backend python scripts/gen_thresholds.py

# Score mapping + recommend_fit on data/dev with takomo_fit.score (offline accuracy, not a test)
score *args:
    PYTHONPATH={{PYTHONPATH}}:{{lab}} uv run --project backend python scripts/score_dev.py {{args}}

# Write mankeli_takomo_test_predictions.csv (5,000 rows on data/test)
preds *args:
    PYTHONPATH={{PYTHONPATH}}:{{lab}} uv run --project backend python scripts/make_test_predictions.py {{args}}

# Record a scripted SSE run to web/public/mock/<persona>.jsonl (gitignored)
record persona:
    uv run --project backend python scripts/record_mocks.py {{persona}}

# Deploy health check against a running server (default: this worktree's api)
smoke url=("http://localhost:" + api_port):
    scripts/smoke.sh {{url}}
