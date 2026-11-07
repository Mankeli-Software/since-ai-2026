from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind

ImportSource = Literal[
    "trackman_link", "csv", "ball_line", "screenshot", "round_stats_screenshot", "skip"
]


class DataImport(UIBlockBase):
    """Offer ways to add measured data: TrackMan CSV, ball-line test readings, a screenshot, or skip. Set reason_code when firming up one part."""

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["data_import"] = "data_import"
    prompt: str = Field(max_length=200)
    sources: list[ImportSource] = Field(min_length=1)
    club_hint: str | None = Field(
        default=None, max_length=64, description="`own_7i` or `takomo_<head>_<shaft>_std`"
    )
    reason_code: str | None = Field(default=None, max_length=32, description="Part being firmed up")
    append_to: str | None = Field(default=None, max_length=64, description="Earlier ball-line import id to pool into")
