from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.common import Depth
from app.schemas.fit import WhyItem
from app.schemas.ui._base import UIBlockBase, UIKind


class WhyPanel(UIBlockBase):
    """Explain the recommendation part by part, with sources and close calls.

    Items come from explain_part.
    """

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["why_panel"] = "why_panel"
    items: list[WhyItem] = Field(max_length=12)
    depth: Depth = "standard"
