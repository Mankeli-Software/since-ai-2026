from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.flags import Flag
from app.schemas.ui._base import UIBlockBase, UIKind


class OutlierReview(UIBlockBase):
    """Show the plausibility flags found in an import with the key numbers.

    The golfer can keep, exclude or confirm the measured value.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["outlier_review"] = "outlier_review"
    import_id: str = Field(max_length=64)
    flags: list[Flag]
    shots_summary: dict[str, float] = Field(default_factory=dict)
    actions: list[Literal["keep", "exclude", "confirm_value"]] = Field(min_length=1)
    humour_line_id: str | None = Field(default=None, max_length=64)
