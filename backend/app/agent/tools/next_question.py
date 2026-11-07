"""`next_question`: what to ask next, using value-of-information and precision offers."""

from typing import Any, Literal

from pydantic import BaseModel

from app.agent.tools._common import commit_state
from app.confidence.analysis import Analysis, analyze
from app.confidence.next_question import next_question as compute_next_question
from app.core.tooling import ToolContext, fitter_tool
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.state import NextQuestionHint


class NextQuestionIn(BaseModel):
    pass


class NextQuestionOut(BaseModel):
    status: Literal["ask", "complete"]
    field: str | None = None
    kind: Literal["intake", "precision"] = "intake"
    ui_tool: str | None = None
    ui_args: dict[str, Any] | None = None
    missing: list[str]
    part: str | None = None  # precision offers: the part it firms up (record_offer_answer)
    reason_code: str | None = None


@fitter_tool("next_question")
async def next_question(ctx: ToolContext, args: NextQuestionIn) -> NextQuestionOut:
    """Get the most useful thing to ask next, with a ready input component. Call it at the start
    and after each answer. If status is "ask", call the named ui_tool with ui_args (you may
    reword the prompt). If "complete", every required input is known: call run_fit."""
    s = ctx.session
    intake = intake_of(s)
    evidence = evidence_of(s)
    a: Analysis = analyze(intake, evidence, session_id=s.id, evidence_version=s.evidence_version)

    answered_set = set(answered(s)) | set(getattr(s, "skipped_fields", []))
    nq = compute_next_question(
        intake,
        evidence,
        a,
        answered=answered_set,
        offered=s.state.precision_offered,
    )

    if nq.kind == "none" or nq.component is None:
        await commit_state(ctx, missing=a.state.missing, next_question=None)
        return NextQuestionOut(status="complete", missing=a.state.missing)

    hint = NextQuestionHint(
        field=nq.field or "",
        kind="intake" if nq.kind == "intake" else "precision",
        reason=getattr(nq.component, "prompt", None),
        part=nq.part,
        reason_code=nq.reason_code,
        expected_gain=nq.expected_gain,
    )
    await commit_state(ctx, missing=a.state.missing, next_question=hint)

    return NextQuestionOut(
        status="ask",
        field=nq.field,
        kind="intake" if nq.kind == "intake" else "precision",
        ui_tool=f"ui_{nq.component.type}",
        ui_args=nq.component.model_dump(exclude_none=True),
        missing=a.state.missing,
        part=nq.part,
        reason_code=nq.reason_code,
    )
