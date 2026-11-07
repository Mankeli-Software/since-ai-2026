"""`next_question`: the most useful missing input, as a ready-to-render input component.

shortcut: a SMALL ordered-missing-fields rule stands in for `confidence.next_question`
(plan 3.4, 5.5), which FIT has not merged. TODO(FIT #confidence): replace `_ORDER` with the real
value-of-information pick, and add precision offers (kind="precision") once confidence exists.
The tool only returns a suggestion: the model calls `ui_tool` with `ui_args`, because an input
`ui_*` tool is what interrupts the turn and waits for the golfer.
"""

from typing import Any, Literal

from pydantic import BaseModel

from app.agent.tools._common import commit_state, missing_of
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.state import NextQuestionHint
from app.schemas.ui.choice_chips import ChoiceChips, ChoiceOption
from app.schemas.ui.slider import Slider


def _chips(field: str, prompt: str, options: list[tuple[str, str]]) -> ChoiceChips:
    return ChoiceChips(
        prompt=prompt,
        field=field,
        options=[ChoiceOption(id=i, label=label) for i, label in options],
    )


# Cheap closed questions first, body measurements late (plan 4.6 rule 5).
_ORDER: tuple[tuple[str, str, ChoiceChips | Slider], ...] = (
    ("handedness", "handedness", _chips("handedness", "Which hand do you swing with?",
        [("right", "Right-handed"), ("left", "Left-handed")])),
    ("age", "age", Slider(prompt="How old are you?", field="age", unit="years", min=8, max=100)),
    ("sex", "sex", _chips("sex", "Which fits you best for club sizing?",
        [("male", "Male"), ("female", "Female")])),
    ("score_bucket", "score_bucket", _chips("score_bucket", "What do you usually shoot for 18?",
        [("1", "Under 71"), ("2", "71-77"), ("3", "78-84"), ("4", "85-92"), ("5", "Over 92")])),
    ("swing", "reported_7i_carry_yd", Slider(prompt="How far do you carry your 7-iron?",
        field="reported_7i_carry_yd", unit="yd", min=60, max=220, step=5, allow_unknown=True)),
    ("flight", "flight", _chips("flight", "How high do you hit your irons?",
        [("low", "Low"), ("mid", "Medium"), ("high", "High")])),
    ("tempo", "tempo", _chips("tempo", "How would you describe your swing tempo?",
        [("smooth", "Smooth"), ("moderate", "Moderate"), ("quick", "Quick")])),
    ("glove", "glove", _chips("glove", "Which glove size do you wear?",
        [(g, g) for g in ("XS", "S", "M", "M/L", "L", "XL")])),
    ("height_cm", "height_cm", Slider(prompt="How tall are you?", field="height_cm", unit="cm",
        min=140, max=210)),
    ("wrist_to_floor_cm", "wrist_to_floor_cm", Slider(
        prompt="Stand straight. How far is your wrist crease from the floor?",
        field="wrist_to_floor_cm", unit="cm", min=60, max=100)),
)  # fmt: skip


class NextQuestionIn(BaseModel):
    pass


class NextQuestionOut(BaseModel):
    status: Literal["ask", "complete"]
    field: str | None = None
    kind: Literal["intake", "precision"] = "intake"
    ui_tool: str | None = None
    ui_args: dict[str, Any] | None = None
    missing: list[str]


@fitter_tool("next_question")
async def next_question(ctx: ToolContext, args: NextQuestionIn) -> NextQuestionOut:
    """Get the most useful thing to ask next, with a ready input component. Call it at the start
    and after each answer. If status is "ask", call the named ui_tool with ui_args (you may
    reword the prompt). If "complete", every required input is known: call run_fit."""
    missing = missing_of(ctx)
    for key, field, block in _ORDER:
        if key in missing:
            hint = NextQuestionHint(field=field, reason=f"{key} is still missing")
            await commit_state(ctx, missing=missing, next_question=hint)
            return NextQuestionOut(
                status="ask",
                field=field,
                ui_tool=f"ui_{block.type}",
                ui_args=block.model_dump(exclude_none=True),
                missing=missing,
            )
    await commit_state(ctx, missing=missing, next_question=None)
    return NextQuestionOut(status="complete", missing=missing)
