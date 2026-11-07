# backend/app/agent/CLAUDE.md

The only package that imports `genkit` or `anthropic`. Engines, tools, turn loop, vision `extract.py`, prompts,
mock scripts. Plan §4.

## Pinned versions: DO NOT UPGRADE

| Package | Pin | Why |
|---|---|---|
| `genkit` | `==0.13.0` | |
| `genkit-anthropic` | `==0.13.0` | we patch its private `_model_info`; only safe on this exact version |
| `genkit-fastapi` | `==0.13.0` | |
| `anthropic` | `==0.112.0` | Genkit 0.13.0's tested lock. A fresh resolve pulls 2.x, which breaks it |

Never install the old `genkit-plugin-*` packages (frozen at 0.9.0).

## Models (`ai.py`)

- Register `claude-sonnet-5-5` and `claude-haiku-5-5` in `genkit_anthropic._model_info.SUPPORTED_ANTHROPIC_MODELS`
  by cloning the newest constrained-output entry of the same family (spike output fills `BASE`; don't guess).
- `CHAT` = Sonnet 5.5: `thinking="adaptive"`, `thinking_display="summarized"`, `effort="low"`,
  `extra={"cache_control": {"type": "ephemeral"}}`. Summarized keeps thinking blocks non-empty so Genkit sends
  them back on tool turns. Filter reasoning chunks out of SSE `text` events.
- `FAST` = Haiku 5.5: `thinking="disabled"`, `effort="low"`. One-off tasks only.
- Model ids come from `AGENT_MODEL_CHAT` / `AGENT_MODEL_FAST` (`agent/settings.py`, prefix `AGENT_`).

| Model | Thinking | Forced tools |
|---|---|---|
| Sonnet 5.5 | adaptive only; `disabled` → 400. `extra={'thinking': {'type':'between_tools'}}` allowed | **never** `tool_choice='required'` (maps to `any` → 400) |
| Opus 5.5 | adaptive only; `between_tools` → 400 | never forced |
| Haiku 5.5 | `disabled` allowed and recommended for `FAST` | `any` accepted, but we don't use it |

## Engine rules

- **Tool results are JSON:** `genkit_engine.py` wraps every tool to return `result.model_dump_json()`
  (Genkit defaults to `str(output)`, a Python repr).
- Return `.text` or `.output`, **never** a `ModelResponse` (leaks system prompt and tools).
- System prompt + sorted tool list are **byte-stable** (no timestamps). Per-turn state digest goes in the user turn.
- History is append-only, stored unchanged (incl. reasoning), tagged with `engine`.
- Vision `ExtractedSession` stays flat (`cells: list[Cell]`, all fields required).
- Fallback: `LLM_ENGINE=anthropic` → `engines/anthropic_engine.py` (`AsyncAnthropic().beta.messages.tool_runner`),
  same tools and SSE events.

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
- Personas: Mikko (spine), Hannu, Lars, Anders. No others (L8). Must work with zero API keys.
- `just record <persona>` writes `web/public/mock/<persona>.jsonl` (gitignored, never hand-edited).
- Traces: `just genkit`, then the Dev UI at `localhost:4000`.
- Tone (L18): mild language, no swing tips, no practice advice, never name competitors.
