from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class ForkOption(BaseModel):
    id: str = Field(max_length=64)
    title: str = Field(max_length=60)
    body: str = Field(max_length=200)
    illustration: Literal["sim_data", "by_hand"]


class YesNoFork(UIBlockBase):
    """Offer a branch that changes the path as two illustrated tiles, e.g. sim data or not.

    The picked option id resumes the turn.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["yes_no_fork"] = "yes_no_fork"
    prompt: str = Field(max_length=200)
    options: list[ForkOption] = Field(min_length=2, max_length=2)
    footnote: str | None = Field(default=None, max_length=160)
