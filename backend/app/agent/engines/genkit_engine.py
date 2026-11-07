"""Live engine: Genkit + Claude (plan 4.1, 4.7). Every registered tool becomes a Genkit tool that
returns `model_dump_json()`. Input `ui_*` tools are interrupts: the first one ends the turn and the
golfer's answer resumes it as that tool call's result. Further input tools in the same response
are answered "ignored: one input component per turn" when the turn resumes."""

import json
from contextvars import ContextVar
from pathlib import Path
from typing import Any

from genkit import Message, Part, Role
from pydantic import BaseModel

from app.agent.ai import CHAT, ai
from app.agent.engines.base import answer_of, stored, user_text
from app.agent.guard import bind
from app.agent.metering import meter
from app.agent.settings import settings
from app.core.tooling import ToolContext, ToolSpec, get_tool, list_tools, ui_tool_specs
from app.schemas.chat import TextEvent, TurnRequest, UiEvent
from app.schemas.session import StoredMessage

SYSTEM = (Path(__file__).resolve().parent.parent / "prompts" / "fitter_system.md").read_text()
IGNORED = "ignored: one input component per turn"
_CTX: ContextVar[ToolContext] = ContextVar("tool_ctx")
_DEFINED: list[str] = []  # sorted tool names, built once


def _define_tools() -> list[str]:
    if _DEFINED:
        return _DEFINED
    for spec in sorted([*list_tools(), *ui_tool_specs()], key=lambda t: t.name):
        if spec.kind == "ui_input":
            ai.define_interrupt(
                name=spec.name, input_schema=spec.input_model, description=spec.description
            )
        else:
            ai.tool(name=spec.name, description=spec.description, input_schema=spec.input_model)(
                _tool_fn(spec)
            )
        _DEFINED.append(spec.name)
    return _DEFINED


def _tool_fn(spec: ToolSpec):
    async def run(input: Any) -> str:  # noqa: A002
        args = (
            input if isinstance(input, spec.input_model) else spec.input_model.model_validate(input)
        )
        out = await spec.fn(_CTX.get(), args)
        # Genkit would send str(output), a Python repr. Always JSON.
        return out.model_dump_json() if isinstance(out, BaseModel) else json.dumps(out)

    return run


def _digest(ctx: ToolContext) -> str:
    st = ctx.session.state
    return json.dumps(
        {"version": st.version, "gate": st.gate, "confidence": st.confidence, "missing": st.missing}
    )


def _dump(m: Message) -> dict[str, Any]:
    return m.model_dump(mode="json", exclude_none=True)


class GenkitEngine:
    async def run_turn(
        self, ctx: ToolContext, request: TurnRequest, history: list[StoredMessage]
    ) -> list[StoredMessage]:
        s = ctx.session
        tools = _define_tools()
        _CTX.set(ctx)
        bind(s.id, ctx.budget)  # the meter middleware counts calls + tokens into this budget
        msgs = [
            Message.model_validate(d)
            for h in history
            if h.engine == "live"
            for d in json.loads(h.parts_json)
        ]
        kwargs: dict[str, Any] = {}
        answer = answer_of(s, request)
        out = [stored("user", "live", user_text(request))]
        if answer is not None:
            value, display = answer
            pending = msgs[-1].interrupts if msgs else []
            if not any(
                (p.tool_request.ref or p.tool_request.name) == s.pending_ui_id for p in pending
            ):
                raise ValueError("no interrupted tool call to resume")
            kwargs["resume_respond"] = [
                p.respond(
                    json.dumps({"value": value, "display_text": display})
                    if (p.tool_request.ref or p.tool_request.name) == s.pending_ui_id
                    else IGNORED
                )
                for p in pending
            ]
            s.pending_ui_id = None
        else:
            # per-turn state goes in the user turn, never in the system prompt
            nq = ""
            if not msgs:  # first turn: run next_question here, one model call less
                spec = get_tool("next_question")
                res = await spec.fn(ctx, spec.input_model())
                nq = f"\n[next_question] {res.model_dump_json()}"
            text = f"[state] {_digest(ctx)}{nq}\n{user_text(request)}"
            msgs.append(Message(role=Role.USER, content=[Part.from_text(text)]))
            out[0] = stored("user", "live", user_text(request), [_dump(msgs[-1])])
        base = len(msgs) - (1 if answer is None else 0)  # messages before this turn's own

        sr = ai.generate_stream(
            model=CHAT,
            system=SYSTEM,
            messages=msgs,
            tools=tools,
            max_turns=settings.max_tool_turns,
            use=[meter("chat", CHAT)],
            **kwargs,
        )
        texts: list[str] = []
        async for chunk in sr.stream:
            if chunk.text:  # chunk.text never includes reasoning
                texts.append(chunk.text)
                await ctx.emit(
                    TextEvent(
                        seq=0,
                        msg_id=f"{s.active_turn_id}-m{int(chunk.index or 0)}",
                        delta=chunk.text,
                    )
                )
        resp = await sr.response
        if resp.error or str(resp.finish_reason).lower().endswith("failed"):
            raise RuntimeError(f"model call failed: {resp.error}")
        # tokens + model calls were already counted per call by the meter middleware

        if resp.interrupts:  # the first input component ends the turn
            first = resp.interrupts[0].tool_request
            ui_id = first.ref or first.name
            block = get_tool(first.name).input_model.model_validate(first.input)
            await ctx.emit(UiEvent(seq=0, id=ui_id, block=block, interactive=True))
            s.pending_ui_id = ui_id
        new = [m for m in resp.messages if m.role != Role.SYSTEM][base:]
        if answer is None:
            new = new[1:]  # the user message is stored on its own above
        out.append(stored("assistant", "live", "".join(texts) or None, [_dump(m) for m in new]))
        return out
