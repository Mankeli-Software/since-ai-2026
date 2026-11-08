"""Why-questions after the scripted engine's script ends (#220). The results aside posts free text
on the same session; with no LLM we route it by keywords to a real tool and say what the tool
returns: `explain_part` for a part, `get_close_call` for the runner-up. No numbers are typed here;
every number in an answer comes from a tool output. Unmatched text gets one line on what we can
explain."""

import re
from typing import Any

from app.core.tooling import ToolContext, get_tool
from app.schemas.common import Part

CLOSE = "close"
# First match wins: "the other head" is a close-call question, not a head question.
ROUTES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(close|vs|versus|other|runner|instead|alternative)\b"), CLOSE),
    (re.compile(r"\b(shaft|flex|stiff|regular|graphite|steel)\b"), "flex"),
    (re.compile(r"\b(length|long|longer|short|shorter|inch|inches)\b"), "length"),
    (re.compile(r"\b(lie|upright|flat|flatter)\b"), "lie"),
    (re.compile(r"\b(grip|grips|glove)\b"), "grip"),
    (re.compile(r"\b(head|club|clubs|iron|irons|101|201|201t|301|mb|cb|mkii)\b"), "head"),
]
HELP = (
    "I can explain any part of your fit: the head, the shaft and flex, the length, the lie "
    "or the grip, and whether the runner-up head is a close call. Ask about one of those."
)
NO_FIT = "There is no fit to explain yet. Finish the questions and I will show you one."


def route(text: str) -> str | None:
    """The part to explain (a `Part`), CLOSE for the close call, or None."""
    t = text.lower()
    return next((target for pattern, target in ROUTES if pattern.search(t)), None)


async def _call(ctx: ToolContext, name: str, args: dict[str, Any]) -> dict[str, Any]:
    spec = get_tool(name)
    out = await spec.fn(ctx, spec.input_model.model_validate(args))
    return out.model_dump(mode="json")


async def _explain(ctx: ToolContext, part: Part) -> str:
    out = await _call(ctx, "explain_part", {"part": part})
    if out["status"] == "needs_fit":
        return NO_FIT
    if out.get("plain"):
        return out["plain"]
    return f"I have no plain explanation for the {part} on this fit. {HELP}"


async def _close_call(ctx: ToolContext) -> str:
    out = await _call(ctx, "get_close_call", {"part": "head"})
    if out["status"] == "needs_fit":
        return NO_FIT
    if out["status"] != "ok":
        return (
            "The head is not a close call on this fit: the rules do not rank the runner-up close. "
            "The compare view shows how the two fly."
        )
    lines = [f"It is a close call: **{out['ours_label']}** against **{out['alt_label']}**."]
    if out.get("ours_share") is not None and out.get("alt_share") is not None:
        lines.append(f"On the fit's numbers it splits {out['ours_share']} to {out['alt_share']}.")
    if out.get("next_step"):
        lines.append(out["next_step"])
    return " ".join(lines)


async def answer(ctx: ToolContext, text: str | None) -> str:
    target = route(text or "")
    if target is None:
        return HELP
    if target == CLOSE:
        return await _close_call(ctx)
    return await _explain(ctx, target)  # type: ignore[arg-type]
