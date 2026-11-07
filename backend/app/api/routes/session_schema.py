"""`GET /api/_schema/events`: puts the `StreamEvent` union into OpenAPI for codegen (plan §3.8),
since openapi-typescript may not read OpenAPI 3.2 SSE `itemSchema`."""

from fastapi import APIRouter

from app.schemas.chat import DoneEvent, StreamEvent

router = APIRouter(tags=["session"])


@router.get("/api/_schema/events", response_model=StreamEvent)
async def schema_events() -> DoneEvent:
    """Type export only. Returns a sample `done` event."""
    return DoneEvent(seq=0, turn_id="example")
