from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class SourceOption(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=40)
    hint: str = Field(max_length=80)


class SourceFallback(BaseModel):
    id: str = Field(max_length=64)
    title: str = Field(max_length=60)
    body: str = Field(max_length=120)


class PreviewStat(BaseModel):
    value: str = Field(max_length=16)
    label: str = Field(max_length=40)


class SourcePicker(UIBlockBase):
    """Ask where the golfer's data comes from (simulators, round trackers, handicap) as tiles.

    An optional dashed fallback tile skips the import. Optional preview stats show what an import
    would give. The picked option or fallback id resumes the turn.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["source_picker"] = "source_picker"
    prompt: str = Field(max_length=200)
    options: list[SourceOption] = Field(min_length=2, max_length=8)
    fallback: SourceFallback | None = None
    preview_lead: str | None = Field(default=None, max_length=120)
    preview_stats: list[PreviewStat] | None = Field(default=None, max_length=4)
