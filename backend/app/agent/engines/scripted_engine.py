"""Scripted engine (`LLM_MODE=mock`): replays `agent/mock/scripts/<persona>.yaml` step by step
against the REAL tools. No LLM, no API key. The cursor lives in `FitSession.script_cursor`, so it
is committed atomically with the turn. A `ui` step with an input component ends the turn.

Any string value of the exact form `$<root>.<key>.<index>...` in a step is a reference, resolved
when the step runs: `$state...` reads the session's FittingState, `$profile.<field>` a saved
profile value, `$answer...` the golfer's reply to the card that ended the last turn (a dict for
most cards, a plain string when they typed instead), and `$<tool>...` the output of that tool from
an earlier `tool_call` step in the same turn. Display blocks then show the real tools' numbers
instead of copies in the YAML. `$answer.age ?? 31` falls back to the YAML value when the path is
missing or null; an `$answer`/`$profile` ref without a fallback that does not resolve drops its
key, so `update_profile` saves only what the golfer gave.

`{by: <ref>, cases: {<value>: ...}, default: ...}` picks a case by the resolved value (compared as
strings), anywhere a value goes, including a `text` step. That is how the fitter's line matches the
answer although the script never branches."""

import asyncio
import re
from pathlib import Path
from typing import Any

import yaml  # shortcut: transitive via uvicorn[standard], not a declared dependency
from pydantic import BaseModel, ValidationError

from app.agent.engines.base import answer_of, load_tools, stored, user_text
from app.agent.guard import REPLAY_TEXT
from app.agent.tools._common import commit_state, recompute_session_state
from app.core.tooling import ToolContext, get_tool
from app.schemas.chat import StreamEvent, TextEvent, TextMessage, TurnRequest, UiEvent
from app.schemas.session import StoredMessage

load_tools()

SCRIPTS = Path(__file__).resolve().parent.parent / "mock" / "scripts"
PERSONAS = {"DEMO-01": "mikko", "DEMO-09": "hannu", "DEMO-04": "lars", "DEMO-13": "anders"}
CHUNK_WORDS = 3
CHUNK_DELAY_S = 0.02
REF = re.compile(r"^\$[a-z_]+(\.\w+)*( \?\? .+)?$")
SOFT_ROOTS = {"answer", "profile"}  # unresolved without a fallback: drop the key, don't fail
MISSING = object()


def load_script(demo_golfer_id: str | None) -> list[dict[str, Any]]:
    # No demo golfer (an own fitting): the Flow v3 walkthrough in own.yaml.
    persona = PERSONAS.get(demo_golfer_id or "", "own")
    path = SCRIPTS / f"{persona}.yaml"
    if not path.exists():  # personas without a script yet use Mikko's
        path = SCRIPTS / "mikko.yaml"
    return yaml.safe_load(path.read_text())["steps"]


def _lookup(ref: str, roots: dict[str, Any]) -> Any:
    expr, _, fallback = ref.partition(" ?? ")
    root, *path = expr[1:].split(".")
    try:
        cur = roots[root]
        for key in path:
            cur = cur[int(key)] if isinstance(cur, list) else cur[key]
    except (KeyError, IndexError, TypeError, ValueError):
        if not fallback and root not in SOFT_ROOTS:
            raise
        cur = None
    if cur is None and fallback:
        return yaml.safe_load(fallback)
    if cur is None and root in SOFT_ROOTS:
        return MISSING
    return cur


def resolve_refs(value: Any, roots: dict[str, Any]) -> Any:
    """Replace `$root.path` strings and `{by, cases}` picks (see module docstring) in a step,
    recursively. A dict key or list item that resolves to nothing is left out."""
    if (
        isinstance(value, dict)
        and "by" in value
        and "cases" in value
        and value.keys() <= {"by", "cases", "default"}
    ):
        key = resolve_refs(value["by"], roots)
        cases = {str(k): v for k, v in value["cases"].items()}
        picked = cases.get(str(key), value.get("default", MISSING))
        return MISSING if picked is MISSING else resolve_refs(picked, roots)
    if isinstance(value, dict):
        out = {k: resolve_refs(v, roots) for k, v in value.items()}
        return {k: v for k, v in out.items() if v is not MISSING}
    if isinstance(value, list):
        return [v for v in (resolve_refs(v, roots) for v in value) if v is not MISSING]
    if isinstance(value, str) and REF.match(value):
        return _lookup(value, roots)
    return value


async def _apply_review_answer(ctx: ToolContext, value: Any) -> None:
    """Scripts never branch, so an `outlier_review` answer (`{action, codes}`) is applied here with
    whatever the golfer tapped, through the real `resolve_flags` tool."""
    if not (ctx.session.pending_ui_id or "").startswith("outlier_review"):
        return
    if not isinstance(value, dict) or "action" not in value:
        return  # free text while the review is pending: nothing to apply
    spec = get_tool("resolve_flags")
    try:
        args = spec.input_model.model_validate(value)
    except ValidationError:
        return
    await spec.fn(ctx, args)


class ScriptedEngine:
    async def run_turn(
        self, ctx: ToolContext, request: TurnRequest, history: list[StoredMessage]
    ) -> list[StoredMessage]:
        s = ctx.session
        turn_id = s.active_turn_id
        user = stored("user", "scripted", user_text(request))
        # Replay mode (#18, the daily cap downgraded this session): only taps move the script on.
        replay_free_text = (
            s.notice is not None
            and s.script_cursor > 0
            and isinstance(request.message, TextMessage)
        )
        answer = answer_of(s, request)
        if answer is not None and not replay_free_text:
            await _apply_review_answer(ctx, answer[0])
            s.pending_ui_id = None
            recompute_session_state(s)
            await commit_state(ctx)

        steps = load_script(s.demo_golfer_id)
        texts: list[str] = []
        n = 0
        outputs: dict[str, Any] = {}  # tool name -> JSON output, for `$<tool>` refs this turn

        roots: dict[str, Any] = {"profile": {k: v.value for k, v in s.profile.items()}}
        if answer is not None and not replay_free_text:
            roots["answer"] = answer[0]

        def refs(value: Any) -> Any:
            roots["profile"] = {
                k: v.value for k, v in s.profile.items()
            }  # update_profile changes it
            return resolve_refs(
                value, {**outputs, **roots, "state": s.state.model_dump(mode="json")}
            )

        async def say(text: str) -> None:
            nonlocal n
            text = text.strip()
            words = text.split(" ")
            for i in range(0, len(words), CHUNK_WORDS):
                delta = " ".join(words[i : i + CHUNK_WORDS])
                delta += " " if i + CHUNK_WORDS < len(words) else ""
                await ctx.emit(TextEvent(seq=0, msg_id=f"{turn_id}-m{n}", delta=delta))
                await asyncio.sleep(CHUNK_DELAY_S)
            texts.append(text)
            n += 1

        if replay_free_text:
            await say(REPLAY_TEXT)
            return [user, stored("assistant", "scripted", REPLAY_TEXT)]
        if s.notice is not None and s.script_cursor == 0:
            await say(s.notice.message)
        if s.script_cursor >= len(steps):
            await say("That is the end of this demo script.")
        while s.script_cursor < len(steps):
            step = steps[s.script_cursor]
            s.script_cursor += 1
            if "text" in step:
                text = refs(step["text"])
                if text is not MISSING:
                    await say(text)
            elif "tool_call" in step:
                call = step["tool_call"]
                spec = get_tool(call["name"])
                args = spec.input_model.model_validate(refs(call.get("args") or {}))
                out = await spec.fn(ctx, args)
                if isinstance(out, BaseModel):
                    outputs[call["name"]] = out.model_dump(mode="json")
            elif "ui" in step:
                spec = get_tool(f"ui_{step['ui']['type']}")
                ui_id: list[str] = []

                async def capture(ev: StreamEvent, ui_id: list[str] = ui_id) -> None:
                    if isinstance(ev, UiEvent):
                        ui_id.append(ev.id)
                    await ctx.emit(ev)

                sub = ToolContext(session=s, emit=capture, store=ctx.store, budget=ctx.budget)
                await spec.fn(sub, spec.input_model.model_validate(refs(step["ui"])))
                if spec.kind == "ui_input":
                    s.pending_ui_id = ui_id[0]
                    break
            else:
                raise ValueError(f"unknown script step {step!r}")

        recompute_session_state(s)
        await commit_state(ctx)

        out = [user]
        if texts:
            out.append(stored("assistant", "scripted", " ".join(t.strip() for t in texts)))
        return out
