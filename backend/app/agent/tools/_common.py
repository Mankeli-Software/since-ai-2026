"""Shared helpers for domain tools (underscore: skipped by tool autodiscovery)."""

from typing import Any

from app.core.tooling import ToolContext
from app.fitting.mapping import missing_inputs
from app.schemas.chat import StateEvent
from app.schemas.common import ProvenancedValue
from app.schemas.fit import FitResult, IntakeAnswers

# Neutral status for parts another lane has not landed yet. Tools return it instead of numbers.
NOT_AVAILABLE = "not_available_yet"


def intake_of(ctx: ToolContext) -> IntakeAnswers:
    """The golfer's answers so far, rebuilt from `session.profile`."""
    return IntakeAnswers.model_validate({k: pv.value for k, pv in ctx.session.profile.items()})


def missing_of(ctx: ToolContext) -> list[str]:
    # shortcut: no FitEvidence yet (no imports in the session). TODO(EVIDENCE #8-#12): build it
    # from the confirmed imports and pass it here, so shots can fill swing/flight/tempo/lie.
    return missing_inputs(intake_of(ctx))


def set_profile(ctx: ToolContext, fields: dict[str, Any]) -> None:
    for k, v in fields.items():
        ctx.session.profile[k] = ProvenancedValue(source="questionnaire", value=v)


async def commit_state(ctx: ToolContext, **updates: Any) -> None:
    """Replace the frozen state with a copy (version + 1) and push it to the client."""
    st = ctx.session.state
    ctx.session.state = st.model_copy(update={**updates, "version": st.version + 1})
    await ctx.emit(StateEvent(seq=0, state=ctx.session.state))


def last_fit(ctx: ToolContext) -> FitResult | None:
    raw = ctx.session.recommendation_json
    return FitResult.model_validate_json(raw) if raw else None
