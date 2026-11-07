from pydantic import BaseModel, Field

from app.core.tooling import ToolContext, fitter_tool
from app.fitting.flight import simulate_session_flight
from app.schemas.chat import StageEvent
from app.schemas.common import HeadSlug
from app.schemas.fit import FlightResult


class SimulateFlightIn(BaseModel):
    heads: list[HeadSlug] = Field(default_factory=list, max_length=5)


class SimulateFlightOut(BaseModel):
    status: str
    heads: list[HeadSlug]
    result: FlightResult | None = None


@fitter_tool("simulate_flight")
async def simulate_flight(ctx: ToolContext, args: SimulateFlightIn) -> SimulateFlightOut:
    """Simulate ball flight (carry, apex, dispersion) for up to 5 heads. Emits show_flight on the
    3D stage."""
    heads = args.heads or None
    try:
        res = simulate_session_flight(ctx.session, heads)
        head_names = [h.head for h in res.per_head]
        await ctx.emit(StageEvent(seq=0, action="show_flight", heads=head_names))
        return SimulateFlightOut(status="ok", heads=head_names, result=res)
    except Exception:
        return SimulateFlightOut(status="error", heads=args.heads or [])
