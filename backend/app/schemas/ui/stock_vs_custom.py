from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class StockVsCustom(UIBlockBase):
    """Ask the golfer to choose stock (returnable) or custom (built to order, not returnable).

    Resumes with "stock" or "custom".
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["stock_vs_custom"] = "stock_vs_custom"
    reasons: list[str] = Field(default_factory=list, max_length=4)
    stock_return_days: int = Field(default=30, ge=0, le=365)
    custom_returnable: bool = False
    question: str = Field(max_length=200)
