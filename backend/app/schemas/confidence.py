"""Confidence I/O models (plan §3.4, §3.5, §5.5). Owned by FIT: additive changes only."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Part
from app.schemas.evidence import Flag
from app.schemas.state import FittingState
from app.schemas.ui import UIBlock


class NextQuestionResponse(BaseModel):
    """`GET /api/sessions/{id}/next-question`: what to ask next, ready to render.

    kind: `intake` (a missing answer), `ball_line_offer` (optional lie evidence),
    `precision_offer` (the least certain part and the next evidence for it, §5.5) or `none`.
    """

    kind: Literal["intake", "ball_line_offer", "precision_offer", "none"]
    field: str | None = None
    part: Part | None = None
    reason_code: str | None = None
    expected_gain: float | None = None
    component: UIBlock | None = None


class ProfileFieldValue(BaseModel):
    value: Any
    unit: str | None = Field(default=None, max_length=16)
    source: Literal["questionnaire", "photo", "video"] = "questionnaire"


class ProfilePatch(BaseModel):
    """`PATCH /api/sessions/{id}/profile` (form fallback, #3)."""

    fields: dict[str, ProfileFieldValue]


class ProfilePatchResponse(BaseModel):
    state: FittingState
    flags: list[Flag] = Field(default_factory=list)
