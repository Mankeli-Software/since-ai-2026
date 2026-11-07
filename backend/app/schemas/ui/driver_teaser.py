from typing import ClassVar, Literal

from app.schemas.ui._base import UIBlockBase, UIKind


class DriverTeaser(UIBlockBase):
    """Show the static "Driver fitting is next" card at the end of an iron result."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["driver_teaser"] = "driver_teaser"
