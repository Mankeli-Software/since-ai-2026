"""Scripted engine (`LLM_MODE=mock`): replays `agent/mock/scripts/<persona>.yaml` step by step
against the REAL tools. No LLM, no API key. The cursor lives in `FitSession.script_cursor`, so it
is committed atomically with the turn. A `ui` step with an input component ends the turn."""

import asyncio
from pathlib import Path
from typing import Any

import yaml  # shortcut: transitive via uvicorn[standard], not a declared dependency

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


def load_script(demo_golfer_id: str | None) -> list[dict[str, Any]]:
    persona = PERSONAS.get(demo_golfer_id or "", "mikko")
    path = SCRIPTS / f"{persona}.yaml"
    if not path.exists():  # personas without a script yet use Mikko's
        path = SCRIPTS / "mikko.yaml"
    return yaml.safe_load(path.read_text())["steps"]


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
        if answer_of(s, request) is not None and not replay_free_text:
            s.pending_ui_id = None
            recompute_session_state(s)
            await commit_state(ctx)

        steps = load_script(s.demo_golfer_id)
        texts: list[str] = []
        n = 0

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
                await say(step["text"])
            elif "tool_call" in step:
                call = step["tool_call"]
                spec = get_tool(call["name"])
                await spec.fn(ctx, spec.input_model.model_validate(call.get("args") or {}))
            elif "ui" in step:
                spec = get_tool(f"ui_{step['ui']['type']}")
                ui_id: list[str] = []

                async def capture(ev: StreamEvent, ui_id: list[str] = ui_id) -> None:
                    if isinstance(ev, UiEvent):
                        ui_id.append(ev.id)
                    await ctx.emit(ev)

                sub = ToolContext(session=s, emit=capture, store=ctx.store, budget=ctx.budget)
                await spec.fn(sub, spec.input_model.model_validate(step["ui"]))
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
