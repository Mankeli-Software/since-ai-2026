from pydantic import BaseModel, Field

from app.agent.tools._common import NOT_AVAILABLE
from app.core.tooling import ToolContext, fitter_tool
from app.schemas.common import HeadSlug


class SimulateFlightIn(BaseModel):
    heads: list[HeadSlug] = Field(min_length=1, max_length=5)


class SimulateFlightOut(BaseModel):
    status: str
    heads: list[HeadSlug]


@fitter_tool("simulate_flight")
async def simulate_flight(ctx: ToolContext, args: SimulateFlightIn) -> SimulateFlightOut:
    """Simulate ball flight (carry, apex, dispersion) for up to 5 heads. Not available yet: say
    you cannot show flight numbers in this version and do not guess any."""
    # shortcut: stub. TODO(FIT flight, plan 3.6): call fitting.flight and emit stage show_flight.
    return SimulateFlightOut(status=NOT_AVAILABLE, heads=args.heads)
