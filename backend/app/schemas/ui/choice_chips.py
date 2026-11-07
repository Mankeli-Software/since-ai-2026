from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class ChoiceOption(BaseModel):
    id: str = Field(max_length=64)
    label: str = Field(max_length=80)
    hint: str | None = Field(default=None, max_length=120)


class ChoiceChips(UIBlockBase):
    """Ask one closed question with 2-6 tappable options. The golfer's pick resumes the turn."""

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["choice_chips"] = "choice_chips"
    prompt: str = Field(max_length=200)
    options: list[ChoiceOption] = Field(min_length=2, max_length=6)
    multi: bool = False
    allow_free_text: bool = False
    field: str | None = Field(default=None, description="Profile field this answers, if any")
