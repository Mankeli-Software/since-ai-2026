from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.common import HeadSlug
from app.schemas.ui._base import UIBlockBase, UIKind


class CompareRow(BaseModel):
    head: HeadSlug
    carry: float
    apex: float
    land_angle: float
    side_sd: float
    score_total: float


class ClubCompare(UIBlockBase):
    """Compare heads side by side on carry, apex, landing angle, spread and score.

    Numbers come from compare_specs.
    """

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["club_compare"] = "club_compare"
    heads: list[CompareRow] = Field(min_length=2, max_length=5)
    highlight: HeadSlug | None = None
