from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class HeardFact(BaseModel):
    label: str = Field(max_length=40)
    source: Literal["typed", "measured"]


class HeardMissing(BaseModel):
    field: str = Field(max_length=32, description="Profile field, e.g. `wrist_to_floor_cm`")
    prompt: str = Field(max_length=160)
    unit: str = Field(max_length=16)


class HeardSummary(UIBlockBase):
    """Confirm everything read from a long typed or spoken message at once, as fact chips.

    Ask only for the one missing field, if any. The resume value is `{missing_value?: number}`.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["heard_summary"] = "heard_summary"
    facts: list[HeardFact] = Field(min_length=1, max_length=12)
    missing: HeardMissing | None = None
    skipped_count: int = Field(ge=0, le=50, description="Questions skipped thanks to the message")
