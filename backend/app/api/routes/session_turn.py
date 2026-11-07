"""STUB `POST /api/sessions/{id}/turn`: replays a fixed SSE event list so the web app can build
against the real wire format before the AGENT lane lands the turn loop.

AGENT replaces this file with `chat_turn.py` (delete this one in the same PR; same path).
Wire format (plan §4.5): `event: <type>`, `id: <seq>`, `data: <StreamEvent JSON>`.
"""

import asyncio
import secrets
from collections.abc import AsyncIterable

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.api.deps import SessionDep
from app.schemas.chat import (
    DoneEvent,
    StateEvent,
    StreamEvent,
    TextEvent,
    TurnRequest,
    TurnStartEvent,
    UiEvent,
)
from app.schemas.session import FitSession
from app.schemas.ui.choice_chips import ChoiceChips, ChoiceOption

router = APIRouter(tags=["session"])

STUB_DELAY_S = 0.05


def _stub_events(session: FitSession, turn_id: str) -> list[StreamEvent]:
    msg_id = f"{turn_id}-m0"
    chips = ChoiceChips(
        prompt="Which way do you swing?",
        field="handedness",
        options=[
            ChoiceOption(id="right", label="Right-handed"),
            ChoiceOption(id="left", label="Left-handed"),
        ],
    )
    events: list[StreamEvent] = [
        TurnStartEvent(seq=0, turn_id=turn_id),
        TextEvent(seq=0, msg_id=msg_id, delta="Hi, I'm your Takomo fitter. "),
        TextEvent(seq=0, msg_id=msg_id, delta="(Stub turn: the real engine lands soon.)"),
        UiEvent(seq=0, id=f"{turn_id}-c0", block=chips, interactive=True),
        StateEvent(seq=0, state=session.state),
        DoneEvent(seq=0, turn_id=turn_id),
    ]
    return [ev.model_copy(update={"seq": i}) for i, ev in enumerate(events)]


@router.post("/api/sessions/{session_id}/turn", response_class=EventSourceResponse)
async def turn(session: SessionDep, body: TurnRequest) -> AsyncIterable[ServerSentEvent]:
    _ = body  # the stub ignores the message
    turn_id = secrets.token_urlsafe(8)
    for ev in _stub_events(session, turn_id):
        yield ServerSentEvent(event=ev.type, id=str(ev.seq), data=ev)
        await asyncio.sleep(STUB_DELAY_S)
