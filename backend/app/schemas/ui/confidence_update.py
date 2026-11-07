from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class ConfidenceUpdate(UIBlockBase):
    """Show how much fit confidence moved after an answer, with what changed. Small and inline."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["confidence_update"] = "confidence_update"
    before: int = Field(ge=0, le=100, description="Percent")
    after: int = Field(ge=0, le=100, description="Percent")
    changes: list[str] = Field(default_factory=list, max_length=4)
    left_count: int | None = Field(default=None, ge=0, description="Things left that would help")
