from pydantic import BaseModel

from app.core.tooling import ToolContext, fitter_tool
from app.fitting.catalog import check_buildable as check
from app.schemas.fit import BuildCheck


class CheckBuildableIn(BaseModel):
    head: str
    shaft: str
    length_in: float
    lie_deg: float
    grip: str
    handedness: str = "right"
    purchase: str = "stock"


@fitter_tool("check_buildable")
async def check_buildable(ctx: ToolContext, args: CheckBuildableIn) -> BuildCheck:
    """Check whether Takomo can build an iron spec, and whether it is stock or custom (custom is
    non-returnable). Use it before you offer any changed spec."""
    return check(args.model_dump())
