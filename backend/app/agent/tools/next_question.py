"""`next_question`: the next step of the fitter's conversation (`agent/flow.py`: talk, evidence,
gaps, body, reveal), on top of FIT's value-of-information order and precision offers."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agent import flow
from app.agent.tools._common import commit_state
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.fit import IntakeAnswers
from app.schemas.state import NextQuestionHint


class NextQuestionIn(BaseModel):
    pass


class NextQuestionOut(BaseModel):
    status: Literal["ask", "complete"]
    field: str | None = None
    kind: Literal["intake", "precision"] = "intake"
    phase: Literal["talk", "evidence", "questions", "body", "offer"] | None = Field(
        default=None, description="Where the conversation is: see the flow in the system prompt"
    )
    opener: bool = Field(
        default=False, description="First card after the opening: ask how their game is first"
    )
    known: dict[str, Any] | None = Field(
        default=None, description="Opener only: what the golfer's form already says"
    )
    ui_tool: str | None = None
    ui_args: dict[str, Any] | None = None
    missing: list[str]
    part: str | None = None  # precision offers: the part it firms up (record_offer_answer)
    reason_code: str | None = None


@fitter_tool("next_question")
async def next_question(ctx: ToolContext, args: NextQuestionIn) -> NextQuestionOut:
    """Get the next step of the fitting, with a ready input component. Call it at the start and
    after each answer. If status is "ask", call the named ui_tool with ui_args (you may reword the
    prompt). If "complete", every required input is known: call run_fit and reveal the fit."""
    s = ctx.session
    step = flow.next_step(s)
    missing = list(step.missing)

    if step.status == "complete" or step.component is None:
        await commit_state(ctx, missing=missing, next_question=None)
        return NextQuestionOut(status="complete", missing=missing)

    flow.shown(s, step)
    hint = NextQuestionHint(
        field=step.field or "",
        kind=step.kind,
        reason=getattr(step.component, "prompt", None),
        part=step.part,
        reason_code=step.reason_code,
        expected_gain=step.expected_gain,
    )
    await commit_state(ctx, missing=missing, next_question=hint)

    known = None
    if step.opener:
        known = {
            k: v.value
            for k, v in s.profile.items()
            if k in IntakeAnswers.model_fields and v.value is not None
        }
    return NextQuestionOut(
        status="ask",
        field=step.field,
        kind=step.kind,
        phase=step.phase,
        opener=step.opener,
        known=known,
        ui_tool=f"ui_{step.component.type}",
        ui_args=step.component.model_dump(exclude_none=True),
        missing=missing,
        part=step.part,
        reason_code=step.reason_code,
    )
