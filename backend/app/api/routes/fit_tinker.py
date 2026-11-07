"""`POST /api/tinker` (plan §3.8, Issue #27): deterministic spec diff and tinker simulator."""

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.api.deps import StoreDep
from app.fitting.tinker import tinker
from app.schemas.tinker import TinkerRequest, TinkerResult

router = APIRouter(tags=["fit"])


@router.post("/api/tinker")
async def tinker_endpoint(body: TinkerRequest, store: StoreDep) -> TinkerResult:
    session = await store.load(body.session_id)
    return await run_in_threadpool(tinker, session, body.spec)
