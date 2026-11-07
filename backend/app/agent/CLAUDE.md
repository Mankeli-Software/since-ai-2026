# backend/app/agent/CLAUDE.md

The only package that imports `genkit` or `anthropic`. Engines, tools, turn loop, vision `extract.py`, prompts,
mock scripts. Plan §4.

## Pinned versions: DO NOT UPGRADE

| Package | Pin | Why |
|---|---|---|
| `genkit` | `==0.13.0` | |
| `genkit-anthropic` | `==0.13.0` | we patch its private `_model_info`; only safe on this exact version |
| `genkit-fastapi` | `==0.13.0` | |
| `genkit-google-genai` | `==0.13.0` | Gemini provider (lead-approved) |
| `anthropic` | `==0.112.0` | Genkit 0.13.0's tested lock. A fresh resolve pulls 2.x, which breaks it |

Never install the old `genkit-plugin-*` packages (frozen at 0.9.0).

## Models (`ai.py`)

- Register `claude-sonnet-5-5` and `claude-haiku-5-5` in `genkit_anthropic._model_info.SUPPORTED_ANTHROPIC_MODELS`
  by cloning the newest constrained-output entry of the same family. Spike result (`BASE` in `ai.py`):
  `sonnet-5-5` -> `claude-sonnet-5`, `haiku-5-5` -> `claude-haiku-4-5`.
- `CHAT` = Sonnet 5.5: `thinking="adaptive"`, `thinking_display="summarized"`, `effort="low"`,
  `extra={"cache_control": {"type": "ephemeral"}}`. Summarized keeps thinking blocks non-empty so Genkit sends
  them back on tool turns. Filter reasoning chunks out of SSE `text` events.
- `FAST` = Haiku 5.5: `thinking="disabled"`, `effort="low"`. One-off tasks only.
- Model ids come from `AGENT_MODEL_CHAT` / `AGENT_MODEL_FAST` (`agent/settings.py`, prefix `AGENT_`).
  Unset = default per provider.
- Adaptive thinking at `effort="low"` often skips thinking. Harmless.
- `tool_choice='required'` on Sonnet 5.5 also raises `GenkitError` client-side in 0.13.0.
- `Part` is a flat model. Cache counters appear in `usage.custom` only when non-zero.

| Model | Thinking | Forced tools |
|---|---|---|
| Sonnet 5.5 | adaptive only; `disabled` → 400. `extra={'thinking': {'type':'between_tools'}}` allowed | **never** `tool_choice='required'` (maps to `any` → 400) |
| Opus 5.5 | adaptive only; `between_tools` → 400 | never forced |
| Haiku 5.5 | `disabled` allowed and recommended for `FAST` | `any` accepted, but we don't use it |

## Provider switch (Anthropic default, Gemini optional)

`ai.py` builds `ai`, `CHAT`, `FAST` for one provider. Callers never branch on provider.

| Env var | Default |
|---|---|
| `AGENT_LLM_PROVIDER` | `anthropic` (or `google`) |
| `AGENT_MODEL_CHAT` / `AGENT_MODEL_FAST` | anthropic: `claude-sonnet-5-5` / `claude-haiku-5-5`; google: `gemini-3.1-pro-preview` / `gemini-3.8-flash` |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | read by the plugin on the first call (Gemini name fixed by the plugin) |

Both providers import with no key. `GoogleAI()` raises at construction without a key, so `ai.py` passes the
placeholder `"unset"`; the first real call then fails with 400. Tag history with `engine`: Claude and Gemini
reasoning parts are not interchangeable across a provider switch.

## Gemini rules (from genkit-google-genai 0.13.0 source)

- Spike: all Gemini checks pass live on `gemini-3.1-pro-preview` (see spike/VERDICT.md). A free-tier key has 0 quota
  for Pro; use a paid key or `AGENT_MODEL_CHAT=gemini-3.8-flash`.
- After an input component resumes, Gemini can return empty text if the prompt says "do nothing else". The system
  prompt must say to acknowledge the answer and continue.
- `GoogleAI.gemini(id, config=GeminiConfig(...))`. Config is flat, unknown fields raise.
- Thinking: `thinking_level` (`MINIMAL|LOW|MEDIUM|HIGH`, Gemini 3+) or `thinking_budget` (2.5). Never both.
  Some Flash ids reject `MINIMAL`, so `FAST` uses `LOW`.
- `CHAT`: `thinking_level="LOW"`, `include_thoughts=True`, `max_output_tokens=8000`. `FAST`: `LOW`, 4000.
- Thought signatures live in `Part.metadata["thoughtSignature"]` (`reasoning`, `tool_request`). Store response
  messages unchanged so they replay.
- Caching is implicit: leave `context_cache` unset. Usage: `cached_content_tokens`, `thoughts_tokens`.
- Tool results are still `model_dump_json()`. Structured output works on all current Gemini entries.

## Engine rules

- **Tool results are JSON:** `genkit_engine.py` wraps every tool to return `result.model_dump_json()`
  (Genkit defaults to `str(output)`, a Python repr).
- Return `.text` or `.output`, **never** a `ModelResponse` (leaks system prompt and tools).
- System prompt + sorted tool list are **byte-stable** (no timestamps). Per-turn state digest goes in the user turn.
- History is append-only, stored unchanged (incl. reasoning), tagged with `engine`.
- Vision `ExtractedSession` stays flat (`cells: list[Cell]`, all fields required).
- Fallback: `LLM_ENGINE=anthropic` → `engines/anthropic_engine.py` (`AsyncAnthropic().beta.messages.tool_runner`),
  same tools and SSE events.

## Cost and abuse guard (#18, plan §4.2)

`guard.py` (no genkit) + `metering.py` (Genkit middleware). All counters are in memory, so prod stays at
`--max-instances=1` until they move to Firestore. The Anthropic workspace spend limit is the real backstop.

- **Every model call** passes `use=[meter("<flow>", MODEL)]` on `ai.generate*`: it adds `max_output_tokens` when
  missing, writes one JSON `model_call` log line and counts toward the daily cap. Call `guard.bind(session_id, budget)`
  first so the line carries the session id (the engine does this per turn).
- **Every route that can trigger a model call** calls a guard check first: `check_turn` (turns),
  `check_vision` (screenshot reads), `check_session_create` (`POST /api/sessions`). They raise 429 with
  `{code, message}`; `X-Demo-Key` (`api/guard_deps.DemoKeyHeader`) skips them all.
- Past `AGENT_DAILY_MODEL_CALL_CAP`, `pick_engine` gives **new** sessions `scripted` + a `SessionNotice`
  (`fallback: replay` for personas, `form` for own fittings), and live vision returns 429. Existing sessions keep
  their engine; the per-session budget (600 calls / 3M tokens) guards them.
- Knobs (`agent/settings.py`): `AGENT_TURNS_PER_MINUTE` (100), `AGENT_SESSIONS_PER_MINUTE` (600),
  `AGENT_DAILY_MODEL_CALL_CAP` (20000), `AGENT_SESSION_MAX_MODEL_CALLS` (600), `AGENT_SESSION_MAX_TOKENS` (3M),
  `AGENT_MAX_TOOL_TURNS` (10; Genkit fails the whole turn when hit), `DEMO_KEY` / `AGENT_DEMO_KEYS` (comma-separated).

## Screenshot import (`extract.py`, #19)

- `VisionExtractor`: Sonnet vision → flat `ExtractedSession` (launch monitor) or `RoundStatsRead` (round stats).
  Uploads ≤ 8 MB, re-encoded and downscaled to 1568 px (Pillow; also strips metadata). Invalid structured output
  retries once (V1); provider errors are a retryable 502 `extraction_failed`.
- Every string read from an image goes through `cap()` (`^[\w %./°-]{0,32}$`); the prompt tells the model to ignore
  text instructions in the image. Raw images are never stored.
- `LLM_MODE=mock` returns `mock/extract/*.json` (synthetic; launch-monitor row 3 carry is a deliberate misread so the
  review table shows a flagged cell) and never imports Genkit.
- The route (`api/routes/evidence_screenshot.py`) runs `evidence.plausibility.extraction.validate_extraction` and
  returns an `ExtractionReview` (`schemas/extraction.py`). Nothing is used until the golfer confirms.

## Turns and interrupts

- An input `ui_*` tool (`kind="ui_input"`) **interrupts** the turn. At most one per turn: any later input tool in
  the same response gets `"ignored: one input component per turn"`.
- The reply `{kind: "ui_response", component_id, value, display_text}` resumes that `tool_use` as its `tool_result`.
- Per-session lock (409 if busy); the turn runs in a background task and commits messages + state atomically.
- 8 SSE events with monotonic `seq`: `turn_start, text, ui, stage, state, mascot, done, error`. No GZip on SSE.

## Add a domain tool

One file `agent/tools/<name>.py`, one `@fitter_tool` (see `backend/CLAUDE.md` for the `ToolContext` example).
The tool calls pure code in `fitting/`, `evidence/`, `confidence/`; it never computes numbers itself, and the model
never invents them. `ui_*` tools are generated from `schemas/ui/`, never hand-written.

## Mock scripts (scripted engine, `LLM_MODE=mock`)

- `agent/mock/scripts/<persona>.yaml`: steps of `text`, `tool_call`, `ui`, replayed against the **real** tools.
  A string like `$state.best` or `$run_fit.best.head_score` in a step is filled from the state or an earlier
  tool output of the same turn, so display blocks quote the tools' numbers.
- Personas: Mikko (spine), Hannu, Lars, Anders. No others (L8). Must work with zero API keys.
- `own.yaml` is not a persona: it is the Flow v3 walkthrough for an own fitting (no demo golfer).
- Scripts never branch, so a skipped import must still leave a sane fit. Bind result cards to `$state`
  (e.g. `spec: $state.best`) instead of copying specs into the YAML.
- `just record <persona>` writes `web/public/mock/<persona>.jsonl` (gitignored, never hand-edited).
- Traces: `just genkit`, then the Dev UI at `localhost:4000`.
- Tone (L18): mild language, no swing tips, no practice advice, never name competitors.

## Spike

`spike/genkit_spike.py` runs the 7 checks (`SPIKE_PROVIDER=google` runs 2-7 on Gemini; check 1 is Anthropic-only).
`spike/VERDICT.md` has the results and the live-run command.
