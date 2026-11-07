from typing import Literal

from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.core.tooling import ToolContext, fitter_tool
from app.fitting.stock_advice import nearest_stock
from app.schemas.fit import StockAdvice


class StockAdviceIn(BaseModel):
    pass


class StockAdviceOut(BaseModel):
    status: Literal["ok", "needs_fit"]
    advice: StockAdvice | None = None


@fitter_tool("stock_advice")
async def stock_advice(ctx: ToolContext, args: StockAdviceIn) -> StockAdviceOut:
    """The nearest stock build next to the fitted one: which way the rules lean (stock, custom or
    either), the lie and length changes, the flight-model carry and side deltas (stock minus
    fitted, yards), the stock return window and plain reasons. Quote only these numbers when the
    golfer weighs stock against custom. Needs run_fit first."""
    if ctx.session.state.best is None:
        return StockAdviceOut(status="needs_fit")
    return StockAdviceOut(status="ok", advice=await run_in_threadpool(nearest_stock, ctx.session))
