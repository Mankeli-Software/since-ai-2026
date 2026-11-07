from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import require_type_field

UIKind = Literal["ui_input", "ui_display"]


class UIBlockBase(BaseModel):
    """Base for gen-UI components. Each subclass lives in its own `schemas/ui/<name>.py`, declares
    `type: Literal["<name>"] = "<name>"` and a `kind` class var, and its docstring becomes the
    `ui_<name>` tool description. Media/link props are enum ids resolved from `fixtures/`, never
    URLs."""

    model_config = ConfigDict(extra="forbid", json_schema_extra=require_type_field)

    kind: ClassVar[UIKind] = "ui_display"
