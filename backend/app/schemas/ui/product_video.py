from typing import ClassVar, Literal

from app.schemas.common import HeadSlug
from app.schemas.ui._base import UIBlockBase, UIKind


class ProductVideo(UIBlockBase):
    """Show the Takomo product video for a head.

    The video is resolved from fixtures/product_videos.json.
    """

    kind: ClassVar[UIKind] = "ui_display"

    type: Literal["product_video"] = "product_video"
    head: HeadSlug
