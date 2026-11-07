"""Tinker I/O models (plan §3.6, §3.8, Issue #27).

Owned by FIT after v0: additive changes only.
"""

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import GripSize, Handedness, HeadSlug, Purchase, Spec
from app.schemas.fit import HeadFlight
from app.schemas.state import FittingState


class TinkerSpecPatch(BaseModel):
    head: HeadSlug | None = None
    shaft: str | None = None
    length_in: float | None = None
    lie_deg: int | None = None
    grip: GripSize | None = None
    handedness: Handedness | None = None


class TinkerRequest(BaseModel):
    session_id: str
    spec: TinkerSpecPatch


class TinkerResult(BaseModel):
    spec: Spec
    recommended_spec: Spec
    buildable: bool
    reasons: list[str] = Field(default_factory=list)
    purchase: Purchase | None = None
    purchase_changed: bool = False
    shaft_auto_switched: str | None = None
    shaft_comparison: dict[str, Any] | None = None
    flight_ours: HeadFlight | None = None
    flight_rec: HeadFlight | None = None
    diff_labels: list[str] = Field(default_factory=list)
    not_modelled: list[str] = Field(default_factory=list)
    state: FittingState
