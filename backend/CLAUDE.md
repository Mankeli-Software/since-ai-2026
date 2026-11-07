# backend/CLAUDE.md

FastAPI app on Python 3.12, managed with **uv 0.13.x** (`[tool.uv] required-version = ">=0.13,<0.14"`).
Run everything from the repo root through `just` (plan §10.4); the justfile sets `PYTHONPATH=<repo>/vendor`.

## Tools

- `uv sync --project backend` installs; `uv run --project backend <cmd>` runs. Never `pip install`.
- Dependencies are frozen after the skeleton PR. Ask the lead before adding one; never hand-edit `uv.lock`
  (resolve conflicts with `uv lock`).
- `just lint` = `ruff check .` + `ruff format --check .` + `lint-imports` (+ web). Fix with `uv run ruff format .`.
- pyright resolves the pack via `[tool.pyright] extraPaths = ["../vendor"]`.
- No tests (L17): check by `just dev` + curl, or `uv run python -c "from app... import ...; print(...)"`.

## Layers (import-linter, plan §2.2). Each may import only from the lines below it

```
api          routes, adapters (the only HTTP/network I/O)
agent        LLM code: engines, tools, extract.py (only importer of genkit / anthropic)
confidence   Monte Carlo, close calls, gate, next_question
fitting      mapping, recommend, flight, tinker, explain
evidence     pure parsers, plausibility, fuse
pack         the only importer of takomo_fit
schemas      Pydantic only; imports nothing from app
```

- `core/` imports only `schemas`. `persistence/` imports only `schemas` and `core`.
  `app/export.py` (contract export) sits beside `main.py` because it needs `create_app()`.
- `evidence/`, `fitting/`, `confidence/`: no I/O, no LLM, no `genkit`/`anthropic`/`httpx`/`takomo_fit.score`.
- `httpx` only in `api/`. `pandas` never in `app/` (dev group only, for offline scripts).

## Settings

- `app/config.py` holds **global** settings only: `LLM_MODE`, `STORE`, `ALLOWED_FRAME_ANCESTORS`, `PORT`.
- Each package owns its own `<package>/settings.py` with an env prefix (`EVIDENCE_`, `AGENT_`, ...).
  Don't add lane settings to `config.py`.

## Where new things go (new files, never a shared registry)

- Route: `app/api/routes/<lane>_<topic>.py`, one `APIRouter` per file (sorted autodiscovery in `main.py`).
- Domain tool: `app/agent/tools/<name>.py`, one `@fitter_tool` per file.
- Gen-UI component: `app/schemas/ui/<name>.py` (auto-registers `ui_<name>` and joins the `UIBlock` union),
  plus `web/src/features/genui/blocks/<name>.tsx` and `fixtures/ui/<name>.json`.
- Session state: `app/schemas/state/{fit,evidence,confidence}.py`, composed into frozen `FittingState`.
- Schemas are hand-written and additive-only. `python -m app.export` (via `just gen`) emits `generated/`.

## The `ToolContext` convention (`app/core/tooling.py`)

```python
from pydantic import BaseModel
from app.core.tooling import ToolContext, fitter_tool

class UpdateProfileIn(BaseModel):
    height_cm: float | None = None

class UpdateProfileOut(BaseModel):
    version: int

@fitter_tool("update_profile")                      # kind="domain" by default; ui tools are generated
async def update_profile(ctx: ToolContext, args: UpdateProfileIn) -> UpdateProfileOut:
    ...                                             # call fitting/evidence/confidence (pure) here
    await ctx.emit(state_event)                     # push text/ui/stage/state events
    return UpdateProfileOut(version=ctx.session.state.version)
```

- `ctx.session` is mutable for this turn only; the turn commits atomically. `ctx.store`, `ctx.budget` are also there.
- Tools return Pydantic models; numbers come from deterministic code, never from the model.
- Run any tool by hand with no engine: `run_tool(name, args, session)`.
- Heavy numpy/physics work goes through `run_in_threadpool`. `POST /api/tinker` stays under 100 ms, no LLM.
