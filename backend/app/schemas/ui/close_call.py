from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Part
from app.schemas.ui._base import UIBlockBase, UIKind


class CloseCallSide(BaseModel):
    label: str = Field(max_length=40)
    share: int = Field(ge=0, le=100, description="Percent of the split")


class CloseCallBlock(UIBlockBase):
    """Show two near-tied options for one part as a split bar and the trade-off, not a winner."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["close_call"] = "close_call"
    part: Part
    a: CloseCallSide
    b: CloseCallSide
    tradeoff: str = Field(max_length=240)
    next_step: str | None = Field(default=None, max_length=80)
