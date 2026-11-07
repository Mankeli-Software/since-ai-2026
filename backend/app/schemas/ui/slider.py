from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class Slider(UIBlockBase):
    """Ask for one numeric profile field on a slider, with an optional "I don't know"."""

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["slider"] = "slider"
    prompt: str = Field(max_length=200)
    field: str
    unit: str = Field(max_length=16)
    min: float
    max: float
    step: float = 1.0
    value: float | None = None
    allow_unknown: bool = False
    measured_or_guessed_toggle: bool = False
