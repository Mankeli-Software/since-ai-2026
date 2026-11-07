from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class ForgeCta(UIBlockBase):
    """Offer a deeper read on one topic in Takomo Forge. Use it after an explanation."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["forge_cta"] = "forge_cta"
    topic: str = Field(max_length=64, description="Id in fixtures/forge_topics.json")
