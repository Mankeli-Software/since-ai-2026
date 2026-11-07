# Genkit spike verdict (issue #14)

Date: 2026-11-07. Env: Python 3.12.6. All 7 checks ran live against the Anthropic API (key from the repo `.env`).
Script: `backend/app/agent/spike/genkit_spike.py` (PEP 723 header, exact pins).

## Pins
All four exist on PyPI and install together: `genkit==0.13.0`, `genkit-anthropic==0.13.0`, `genkit-fastapi==0.13.0`,
`anthropic==0.112.0` (fastapi resolved to 0.162.1; `fastapi.sse.EventSourceResponse` exists).

## Results

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Dump `SUPPORTED_ANTHROPIC_MODELS`, pick BASE | **PASS** (real run) | see below |
| 2 | Streamed text through FastAPI SSE | **PASS** | 3 text events then done |
| 3 | Tool round trip, Pydantic in, JSON string out | **PASS** | wire `tool_result` = `{"club":"7i","loft_deg":34.0}` |
| 4 | Structured output, real `ExtractedSession` | **PASS** | 4 cells, native `json_schema` output_config |
| 5 | Image input | **PASS** | model said "Red." |
| 6 | Interrupt + resume | **PASS** | interrupted on `ui_ask`, resumed, model said "Your favourite colour is blue." |
| 7 | 2-tool turn + 2nd turn, thinking blocks, cache read | **PASS** (effort=high) | 2 non-empty signed thinking blocks replayed, `cache_read_input_tokens` = 13613 / 13594 (2 runs) |

**Check 7 finding (important).** With `thinking="adaptive"` the model decides whether to think. On a simple tool call it
does not think at all, even at `effort="high"` (confirmed with a direct `anthropic` SDK call, so this is the model, not
Genkit). At `effort="low"` (our `CHAT` setting) it often skips thinking even on a reasoning prompt. That is harmless:
no thinking block means nothing to replay, and no error. When the model does think, Genkit keeps the signed block
(`_to_genkit_content`, non-streaming and streaming paths) and sends it back on the tool turn. So keep `effort="low"` and
raise it to `medium` only if tool choice is poor (plan 4.2). Run the check with `SPIKE_EFFORT=high ... genkit_spike.py 7`.

Offline evidence for 2-7 (fake key, unreachable host, request bodies captured by an httpx hook): the API surface exists
and builds valid requests. The 5.5 model registers; check 4 sends `output_config.format.type=json_schema` (native
constrained output) plus `effort`; check 6 sends tools `[ui_ask]` with
`thinking={"type":"adaptive","display":"summarized"}`, `output_config={"effort":"low"}`, top-level
`cache_control={"type":"ephemeral"}`. `Interrupt`/`define_interrupt`/`resume_respond`, `generate_stream`,
`Part.from_media` all exist. Nothing needed for checks 2-6 is missing, so **`anthropic_engine.py` is not written**.

### Check 1 output (real)
```
claude-fable-5 / haiku-4-5 / opus-4-1 / 4-5 / 4-6 / 4-7 / 4-8 / sonnet-4-5 / 4-6 / sonnet-5 : constrained=all
claude-opus-4, claude-sonnet-4                                                           : constrained=None
BASE claude-sonnet-5-5 <- claude-sonnet-5
BASE claude-haiku-5-5  <- claude-haiku-4-5
```
**BASE = `{"claude-sonnet-5-5": "claude-sonnet-5", "claude-haiku-5-5": "claude-haiku-4-5"}`** (filled in `ai.py`).
Haiku 4.5 is the only Haiku entry. Verified: after registration both new ids report `constrained=all`.

## Plan vs reality (read from the 0.13.0 source)

- `AnthropicConfig` has every field the plan uses: `thinking` (`enabled|adaptive|disabled`), `thinking_display`
  (`summarized|omitted`), `effort` (`low..max`), `max_output_tokens`, `extra`. Config is validated on `ai.py` import. OK.
- Table already has `claude-sonnet-5` (plan assumed no 5.x). The Literal `KnownClaude` is only a type hint.
- Plugin docstring: "Any Claude model id resolves on demand". The table entry matters only for `supports`
  (constrained output). Unregistered ids silently get `DEFAULT_SUPPORTS` (text only, prompt-only JSON). So register.
- `extra` goes into `extra_body`, so `{"cache_control": ...}` becomes a top-level request field (automatic caching). OK
  with anthropic 0.112.0 (`messages.create` also has a native `cache_control` kwarg).
- Plan claim confirmed: `_to_anthropic_block` does `if reasoning:` and also requires a thought signature; otherwise
  the block is dropped. Hence `summarized`. Tool results confirmed as `str(part.tool_response.output)` (Python repr).
- New vs plan: with thinking `enabled|adaptive`, `tool_choice='required'` raises `GenkitError` client-side in 0.13.0
  (before the 400). `tool_choice='auto'` is fine.
- `Anthropic()` constructs without a key. The key error appears on the first call, so `ai.py` imports cleanly (verified).
- Usage cache counters are at `response.usage.custom["cache_read_input_tokens"]` (only present when non-zero).
- Interrupts: `ai.define_interrupt(...)`, `response.interrupts[i].respond(value)`, resume with
  `ai.generate(messages=r1.messages, tools=..., resume_respond=[...])`.
- Cache minimum: check 7 uses a ~12k-char system prompt; cache reads were ~13.6k tokens on turn 2, so caching works.
- Genkit 0.13 `Part` is a flat model (`part.tool_request`, `part.reasoning`), not a `RootModel` with `.root`.

## Re-run
```
set -a; . ./.env; set +a                                   # ANTHROPIC_API_KEY
uv run backend/app/agent/spike/genkit_spike.py             # all 7 (exit 1 on any FAIL)
SPIKE_EFFORT=high uv run backend/app/agent/spike/genkit_spike.py 7
```

## Verdict text for issue #14
> **Verdict: GO on Genkit.** All 7 checks pass live on `claude-sonnet-5-5` with the pins genkit / genkit-anthropic /
> genkit-fastapi 0.13.0 + anthropic 0.112.0. BASE = sonnet-5-5 -> `claude-sonnet-5`, haiku-5-5 -> `claude-haiku-4-5`
> (both constrained=ALL). Streaming via FastAPI, JSON tool results, native structured output with the real
> `ExtractedSession`, image input, Interrupt + resume, and thinking replay + prompt cache (cache_read ~13.6k tokens) all
> work. Note: adaptive thinking at effort=low often skips thinking; that is harmless. `anthropic_engine.py` fallback is
> not needed. Details: `backend/app/agent/spike/VERDICT.md`.

## Gemini provider (added; Anthropic verdict above is unchanged)

Pin: `genkit-google-genai==0.13.0` (lead-approved). Switch: `AGENT_LLM_PROVIDER=google` (app) / `SPIKE_PROVIDER=google` (spike).
Key: `GEMINI_API_KEY` (the plugin reads this name only). Models: `gemini-3.1-pro-preview` (CHAT), `gemini-3.8-flash` (FAST).

Verified offline (no keys): `app.agent.ai` imports with both providers and no key in the env; refs resolve to
`googleai/gemini-3.1-pro-preview` and `googleai/gemini-3.8-flash`; `GeminiConfig` validates. Anthropic re-run after the
change: checks 1-6 PASS, check 7 PASS with `SPIKE_EFFORT=high` (cache_read 13611).

Live run on `gemini-3.1-pro-preview` (paid key), 2026-11-07:

| # | Check (Gemini) | Status |
|---|---|---|
| 1 | Model registration | SKIP (Anthropic-only; all Gemini entries are already constrained=ALL) |
| 2 | Streamed text through FastAPI SSE | **PASS** |
| 3 | Tool round trip, Pydantic in, JSON string out | **PASS** |
| 4 | Structured output, real `ExtractedSession` | **PASS** (4 cells) |
| 5 | Image input | **PASS** |
| 6 | Interrupt + resume | **PASS** (after the prompt fix below; 2 of 2 runs) |
| 7 | 2-tool turn + 2nd turn, thought signatures, cache | **PASS**: 2 thought parts at `LOW`, 3 signed parts kept in history, `cached_content_tokens` = 17331 |

**Verdict: Gemini works as a switchable provider.** Findings:
- **A free-tier key cannot use Pro.** Free tier has a quota of 0 for `gemini-3.1-pro` (`RESOURCE_EXHAUSTED`, limit 0).
  Use a paid key, or set `AGENT_MODEL_CHAT=gemini-3.8-flash` on free tier.
- **Gemini follows "do nothing else" literally after a resume.** With the prompt "Call ui_ask ... Do nothing else.",
  Gemini returned empty text (`finish=stop`) after the `ui_response`; Claude still answered. The system prompt must say
  what to do after an input component returns (e.g. acknowledge the answer and continue).
- Unlike Claude at `effort=low`, Gemini at `thinking_level=LOW` did think on the 2-tool turn, and implicit caching hit.
- A `.env` copied from the old `.env.example` has `AGENT_MODEL_CHAT=claude-sonnet-5-5`; with `AGENT_LLM_PROVIDER=google`
  that sends a Claude id to Gemini (404). Comment those lines out.

Run:
```
set -a; . ./.env; set +a
SPIKE_PROVIDER=google uv run backend/app/agent/spike/genkit_spike.py            # 2-7
SPIKE_GEMINI_MODEL=gemini-3.8-flash SPIKE_PROVIDER=google uv run ...             # other Gemini model
```
