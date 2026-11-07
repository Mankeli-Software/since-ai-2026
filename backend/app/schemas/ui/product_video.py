from typing import ClassVar, Literal

from app.schemas.common import HeadSlug
from app.schemas.ui._base import UIBlockBase, UIKind


class ProductVideo(UIBlockBase):
    """Takomo testing, influencer in-the-bag setups, and video reviews for a head."""

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["product_video"] = "product_video"
    head: HeadSlug
