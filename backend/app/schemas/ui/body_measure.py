from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class MeasureOption(BaseModel):
    id: str = Field(max_length=16, description="For glove: a size from the pack (`M/L`, `L`, ...)")
    label: str = Field(max_length=16)
    sub: str | None = Field(default=None, max_length=24, description="E.g. hand length `19 cm`")


class BodyMeasure(UIBlockBase):
    """Ask for one body measurement (height, wrist-to-floor, hand length or glove size).

    It has a unit switch and an optional how-to diagram. Pass `options` to show size tiles instead
    of a number input (glove).
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["body_measure"] = "body_measure"
    field: Literal["height", "wrist_to_floor", "hand_length", "glove"]
    prompt: str = Field(max_length=200)
    unit_options: list[Literal["cm", "in"]] = Field(
        default_factory=lambda: ["cm", "in"], min_length=1
    )
    diagram_id: str | None = Field(
        default=None, max_length=64, description="Id in fixtures/diagrams.json"
    )
    value: float | None = None
    options: list[MeasureOption] | None = Field(default=None, max_length=8)
