"""Live engine: Genkit + Claude (plan 4.1, 4.7). Every registered tool becomes a Genkit tool that
returns `model_dump_json()`. Input `ui_*` tools are interrupts: the first one ends the turn and the
golfer's answer resumes it as that tool call's result. Further input tools in the same response
are answered "ignored: one input component per turn" when the turn resumes. The first turn is the
fixed opening (`agent/opening.py`, no model call); its answer opens the model's first turn."""

import json
from contextvars import ContextVar
from pathlib import Path
from typing import Any

from genkit import Message, Part, Role
from pydantic import BaseModel

from app.agent import opening
from app.agent.ai import CHAT, ai
from app.agent.engines.base import answer_of, stored, user_text
from app.agent.guard import bind
from app.agent.metering import meter
from app.agent.settings import settings
from app.confidence.next_question import INTAKE
from app.core.tooling import ToolContext, ToolSpec, get_tool, list_tools, ui_tool_specs
from app.schemas.chat import TextEvent, TextMessage, TurnRequest, UiEvent
from app.schemas.session import FitSession, StoredMessage

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


def _profile_value(value: Any) -> Any:
    """The answer as a profile value, or None when it is not a plain known answer."""
    if isinstance(value, dict):  # slider with toggle, or body_measure / glove
        value = value["value_cm"] if "value_cm" in value else value.get("value")
    if isinstance(value, str) and value.isdigit():
        return int(value)  # bucket chips send "1".."5"
    return value


async def _presave(ctx: ToolContext, request: TurnRequest, value: Any, block_field: Any) -> dict:
    """Do the two steps the model would do after a plain intake answer: save it, then ask
    next_question. Returns {} on any doubt, so the model does the steps itself."""
    hint = ctx.session.state.next_question
    if isinstance(request.message, TextMessage) or hint is None or hint.kind != "intake":
        return {}
    entry = next((e for e in INTAKE if e[1] == hint.field), None)
    if entry is None or entry[2].field != block_field:  # the pending block is not the hinted one
        return {}
    val = _profile_value(value)
    if val is None:  # "Not sure": leave it to the model
        return {}
    try:
        up = get_tool("update_profile")
        args = up.input_model.model_validate({hint.field: val})
    except ValueError:
        return {}
    saved = await up.fn(ctx, args)
    nq = get_tool("next_question")
    return {
        "saved": json.loads(saved.model_dump_json()),
        "next_question": json.loads((await nq.fn(ctx, nq.input_model())).model_dump_json()),
    }


def _profile(s: FitSession) -> dict[str, Any]:
    return {k: v.value for k, v in s.profile.items()}


async def _open(ctx: ToolContext, request: TurnRequest) -> list[StoredMessage]:
    """The fixed opening: greeting + background card, no model call. History gets the hidden
    first user message and the greeting as the model's reply, so the model does not greet again."""
    s = ctx.session
    nq = get_tool("next_question")
    await nq.fn(ctx, nq.input_model())  # fills state.missing for the top bar
    for i, line in enumerate(opening.GREETING):
        await ctx.emit(TextEvent(seq=0, msg_id=f"{s.active_turn_id}-m{i}", delta=line))
    block = opening.card(_profile(s))
    await ctx.emit(UiEvent(seq=0, id=opening.OPENING_ID, block=block, interactive=True))
    s.pending_ui_id = opening.OPENING_ID
    hello = Message(
        role=Role.USER, content=[Part.from_text(f"[state] {_digest(ctx)}\n{user_text(request)}")]
    )
    said = "\n\n".join(opening.GREETING)
    return [
        stored("user", "live", user_text(request), [_dump(hello)]),
        stored(
            "assistant",
            "live",
            said,
            [_dump(Message(role=Role.MODEL, content=[Part.from_text(said)]))],
        ),
    ]


async def _opening_answer(ctx: ToolContext, value: Any) -> dict:
    """Save the card's picks, then ask next_question, as `_presave` does for one intake answer.
    Free text instead of a card answer: just the text, the model does the steps itself."""
    choice = opening.picked(value)
    if not choice:
        return {"value": value}
    up = get_tool("update_profile")
    fields = opening.profile_fields(choice, _profile(ctx.session))
    saved = await up.fn(ctx, up.input_model.model_validate(fields))
    nq = get_tool("next_question")
    return {
        "value": choice,
        "saved": json.loads(saved.model_dump_json()),
        "next_question": json.loads((await nq.fn(ctx, nq.input_model())).model_dump_json()),
    }


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
        if not msgs:  # first turn: the fixed opening, no model call
            return await _open(ctx, request)
        kwargs: dict[str, Any] = {}
        answer = answer_of(s, request)
        resume = answer is not None and s.pending_ui_id != opening.OPENING_ID
        out = [stored("user", "live", user_text(request))]
        if resume:
            value, display = answer
            pending = msgs[-1].interrupts if msgs else []
            if not any(
                (p.tool_request.ref or p.tool_request.name) == s.pending_ui_id for p in pending
            ):
                raise ValueError("no interrupted tool call to resume")
            mine = next(
                p for p in pending if (p.tool_request.ref or p.tool_request.name) == s.pending_ui_id
            )
            field = (mine.tool_request.input or {}).get("field")
            extra = await _presave(ctx, request, value, field)
            result = json.dumps({"value": value, "display_text": display, **extra})
            kwargs["resume_respond"] = [
                p.respond(result if p is mine else IGNORED) for p in pending
            ]
            s.pending_ui_id = None
        else:
            # per-turn state goes in the user turn, never in the system prompt
            ans = ""
            if answer is not None:  # the opening card's answer: no tool call to resume
                ans = f"\n[answer] {json.dumps(await _opening_answer(ctx, answer[0]))}"
                s.pending_ui_id = None
            text = f"[state] {_digest(ctx)}{ans}\n{user_text(request)}"
            msgs.append(Message(role=Role.USER, content=[Part.from_text(text)]))
            out[0] = stored("user", "live", user_text(request), [_dump(msgs[-1])])
        base = len(msgs) - (0 if resume else 1)  # messages before this turn's own

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
        if not resume:
            new = new[1:]  # the user message is stored on its own above
        out.append(stored("assistant", "live", "".join(texts) or None, [_dump(m) for m in new]))
        return out
