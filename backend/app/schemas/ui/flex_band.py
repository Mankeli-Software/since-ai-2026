from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class FlexBand(UIBlockBase):
    """Show the L/R/S/X flex bands by 7-iron club speed, with the golfer's marker.

    An optional ghost marker shows where a guess (e.g. a claimed carry) would have put them.
    """

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["flex_band"] = "flex_band"
    measured_mph: float | None = Field(ge=30, le=130, description="None if not measured")
    band: Literal["L", "R", "S", "X"]
    ghost_mph: float | None = Field(default=None, ge=30, le=130)
    ghost_label: str | None = Field(default=None, max_length=60)
