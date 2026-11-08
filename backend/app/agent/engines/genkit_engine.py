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

from app.agent import flow, opening
from app.agent.ai import CHAT, ai
from app.agent.engines.base import answer_of, stored, user_text
from app.agent.guard import bind
from app.agent.metering import meter
from app.agent.settings import settings
from app.agent.tools._common import recompute_session_state
from app.core.tooling import ToolContext, ToolSpec, get_tool, list_tools, ui_tool_specs
from app.schemas.chat import TextEvent, TextMessage, TurnRequest, UiEvent
from app.schemas.fit import FitResult
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


def _clubs_verdict(s: FitSession) -> float | None:
    """`current_clubs_verdict` (yd) from the state, else from the last fit; None when absent."""
    if s.state.current_clubs_verdict is not None:
        return s.state.current_clubs_verdict
    if not s.recommendation_json:
        return None
    try:
        fit = FitResult.model_validate_json(s.recommendation_json)
    except ValueError:
        return None
    if fit.current_clubs_verdict is not None:
        return fit.current_clubs_verdict
    return fit.flight.current_clubs_verdict if fit.flight is not None else None


def _digest(ctx: ToolContext) -> str:
    st = ctx.session.state
    d: dict[str, Any] = {
        "version": st.version,
        "gate": st.gate,
        "confidence": st.confidence,
        "missing": st.missing,
        "simulated_golfer": ctx.session.demo_golfer_id is not None,
    }
    verdict = _clubs_verdict(ctx.session)
    if verdict is not None:  # only then may the reply say "your clubs are fine" (prompt rule 1)
        d["current_clubs_verdict"] = round(verdict, 1)
    return json.dumps(d)


def _dump(m: Message) -> dict[str, Any]:
    return m.model_dump(mode="json", exclude_none=True)


# The golfer is waiting for words before the next card (the model tends to only think them).
SPEAK = {"speak_first": True}


async def _next(ctx: ToolContext) -> dict:
    nq = get_tool("next_question")
    return json.loads((await nq.fn(ctx, nq.input_model())).model_dump_json())


async def _run(ctx: ToolContext, name: str, args: dict[str, Any]) -> dict | None:
    """Run one domain tool for the model; None when the args do not validate."""
    spec = get_tool(name)
    try:
        parsed = spec.input_model.model_validate(args)
    except ValueError:
        return None
    return json.loads((await spec.fn(ctx, parsed)).model_dump_json())


def _shots_line(report: dict | None) -> str | None:
    """The studio's own line after the golfer's 7-iron import, so the shots are never skipped
    in silence: fixed copy, numbers only from the import report. G11 adds the ego-carry line."""
    summary = (report or {}).get("shots_summary") or {}
    carry, speed = summary.get("carry_yd_mean"), summary.get("club_speed_mph_median")
    if not report or not report.get("shots_count") or carry is None:
        return None
    line = f"{report['shots_count']} shots in: **{carry:.1f} yd** average carry"
    line += f" at **{speed:.1f} mph** club speed." if speed is not None else "."
    g11 = next((f for f in report.get("flags", []) if f.get("code") == "G11"), None)
    if g11 and isinstance(g11.get("value"), int | float) and not g11.get("resolved"):
        line += f" You said {g11['value']:.0f} yd. That gap is the ego tax, and everybody pays it."
    return line


async def _presave(
    ctx: ToolContext, request: TurnRequest, tool: str, block: dict[str, Any], value: Any
) -> dict:
    """Do the steps the model would do after a tapped answer (`agent/flow.py`): save it, apply an
    outlier review, read an import's report, then ask next_question. Returns {} on any doubt
    (free text, "Not sure"), so the model does the steps itself."""
    if isinstance(request.message, TextMessage):
        return {}
    s = ctx.session
    if tool == "ui_outlier_review" and isinstance(value, dict) and "action" in value:
        resolved = await _run(ctx, "resolve_flags", value)
        if resolved is None:
            return {}
        recompute_session_state(s)
        return {"resolved": resolved, "next_question": await _next(ctx), **SPEAK}
    if tool == "ui_data_import" and isinstance(value, dict) and value.get("import_id"):
        report = await _run(ctx, "get_import_report", {"import_id": value["import_id"]})
        flow.mark(s, **{flow.LAST: "import"})  # a precision offer may follow it straight away
        said = _shots_line(report) if block.get("club_hint") == "own_7i" else None
        out = {"import_report": report, **SPEAK, **({"said": said} if said else {})}
        if s.state.pending_flags:  # the golfer reviews the flags before anything else
            return {**out, "review_flags_first": True}
        return {**out, "next_question": await _next(ctx)}
    fields = flow.answer_fields(tool, block, value, s)
    if fields is None:
        return {}
    marks = {k: fields.pop(k) for k in list(fields) if k == flow.SIM_BRAND}
    # An untouched typical value (`defaulted`, flow.answer_fields): answered, not known. Recorded
    # first; update_profile then recomputes and commits the state (also with nothing to save).
    typical = [k for k, v in fields.items() if v is None]
    fields = {k: v for k, v in fields.items() if v is not None}
    flow.leave_unknown(s, *typical)
    saved = await _run(ctx, "update_profile", fields) if fields or typical else {"saved": []}
    if saved is None:
        return {}
    flow.mark(s, **marks)
    extra = {"typical_not_measured": typical} if typical else {}
    return {"saved": saved, **extra, "next_question": await _next(ctx), **SPEAK}


def _offer(ctx: ToolContext, block: dict[str, Any]) -> dict:
    """For an answer to a precision or ball-line offer: the offer's part, so the model records
    the offer the golfer answered with `record_offer_answer` (#195). The chips carry the
    offer's `field`, the ball-line `data_import` its `reason_code`."""
    hint = ctx.session.state.next_question
    if hint is None or hint.kind != "precision" or hint.part is None:
        return {}
    code = block.get("reason_code")
    if block.get("field") != hint.field and not (code and code == hint.reason_code):
        return {}
    return {"offer": {"part": hint.part, "reason_code": hint.reason_code}}


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
    """Save the card's picks, then ask next_question (the opener), as `_presave` does for one
    answer. Free text instead of a card answer: just the text, the model does the steps itself."""
    choice = opening.picked(value)
    if not choice:
        return {"value": value}
    fields = opening.profile_fields(choice, _profile(ctx.session))
    saved = await _run(ctx, "update_profile", fields)
    return {"value": choice, "saved": saved, "next_question": await _next(ctx), **SPEAK}


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
        extra: dict[str, Any] = {}
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
            block = mine.tool_request.input if isinstance(mine.tool_request.input, dict) else {}
            imported = isinstance(value, dict) and bool(value.get("import_id"))
            offer = {} if imported else _offer(ctx, block)
            extra = offer or await _presave(ctx, request, mine.tool_request.name, block, value)
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
        if resume and (said := extra.get("said")):  # the studio's own line goes first
            texts.append(said + "\n\n")
            await ctx.emit(TextEvent(seq=0, msg_id=f"{s.active_turn_id}-said", delta=said))
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
