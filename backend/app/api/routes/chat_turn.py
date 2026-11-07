"""`POST /api/sessions/{id}/turn`: SSE of the 8 frozen events (plan 4.5). Replaces the L0 stub.
Wire format: `event: <type>`, `id: <seq>`, `data: <StreamEvent JSON>`. No GZip on this route.
The turn runs in a background task (agent/turn.py), so a disconnect still commits it."""

from collections.abc import AsyncIterable, AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.agent.turn import start_turn
from app.api.deps import StoreDep
from app.schemas.chat import StreamEvent, TurnRequest

router = APIRouter(tags=["session"])  # "session" keeps the generated operation id of the stub


async def turn_events(
    session_id: str, body: TurnRequest, store: StoreDep
) -> AsyncIterator[StreamEvent]:
    """A dependency, because errors raised inside an SSE generator come after the 200 headers.
    Here 404 / 409 / 422 are still proper HTTP errors."""
    return await start_turn(store, session_id, body)


@router.post("/api/sessions/{session_id}/turn", response_class=EventSourceResponse)
async def turn(
    events: Annotated[AsyncIterator[StreamEvent], Depends(turn_events)],
) -> AsyncIterable[ServerSentEvent]:
    async for ev in events:
        yield ServerSentEvent(event=ev.type, id=str(ev.seq), data=ev)
