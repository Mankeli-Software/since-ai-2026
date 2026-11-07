from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class BodyMeasure(UIBlockBase):
    """Ask for one body measurement (height, wrist-to-floor or hand length).

    It has a unit switch and an optional how-to diagram.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["body_measure"] = "body_measure"
    field: Literal["height", "wrist_to_floor", "hand_length"]
    prompt: str = Field(max_length=200)
    unit_options: list[Literal["cm", "in"]] = Field(
        default_factory=lambda: ["cm", "in"], min_length=1
    )
    diagram_id: str | None = Field(
        default=None, max_length=64, description="Id in fixtures/diagrams.json"
    )
    value: float | None = None
