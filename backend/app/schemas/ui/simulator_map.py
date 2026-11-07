from typing import ClassVar, Literal

from pydantic import Field

from app.schemas.ui._base import UIBlockBase, UIKind


class SimulatorMap(UIBlockBase):
    """Show where to hit Takomo test clubs on a simulator or in a fitting studio.

    Use it when more data is needed.
    """

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["simulator_map"] = "simulator_map"
    simulator_ids: list[str] = Field(max_length=10, description="Ids in fixtures/simulators.json")
