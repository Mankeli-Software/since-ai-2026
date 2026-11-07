"""The turn runner (plan 2.3, 4.5). One turn = lock, background task, event queue, atomic commit.

`start_turn` takes the per-session lock (TurnBusyError = 409 if busy), validates the message, then
runs the engine in a background task that owns an event queue. The SSE route only reads that queue,
so a client disconnect never stops the turn: the task still commits messages + state atomically
and releases the lock. If the engine fails, nothing is committed: `error` is sent, lock released.
"""

import asyncio
import logging
import secrets
from collections.abc import AsyncIterator

from app.agent.engines.base import Engine, load_tools
from app.core.errors import AppError, InvalidInputError, TurnBusyError
from app.core.tooling import ToolContext
from app.schemas.chat import (
    DoneEvent,
    ErrorEvent,
    StateEvent,
    StreamEvent,
    TurnRequest,
    TurnStartEvent,
    UiResponseMessage,
)
from app.schemas.ports import SessionStore

log = logging.getLogger(__name__)

LOCK_TTL_S = 300
_TASKS: set[asyncio.Task] = set()  # strong refs: a background turn must not be garbage collected


def get_engine(kind: str) -> Engine:
    load_tools()
    if kind == "live":
        from app.agent.engines.genkit_engine import GenkitEngine  # imports genkit lazily

        return GenkitEngine()
    from app.agent.engines.scripted_engine import ScriptedEngine

    return ScriptedEngine()


async def start_turn(
    store: SessionStore, session_id: str, request: TurnRequest
) -> AsyncIterator[StreamEvent]:
    """Raises before any streaming: NotFound 404, TurnBusy 409, InvalidInput 422."""
    turn_id = secrets.token_urlsafe(8)
    if not await store.acquire_turn(session_id, turn_id, LOCK_TTL_S):
        raise TurnBusyError("a turn is already running for this session")
    try:
        session = await store.load(session_id)  # after the lock: the version is stable now
        history = await store.list_messages(session_id)
        msg = request.message
        if isinstance(msg, UiResponseMessage) and msg.component_id != session.pending_ui_id:
            raise InvalidInputError("no pending input component with that component_id")
    except BaseException:
        await store.release_turn(session_id, turn_id)
        raise
    queue: asyncio.Queue[StreamEvent | None] = asyncio.Queue()
    task = asyncio.create_task(_run(store, session, history, request, turn_id, queue))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    return _drain(queue)


async def _drain(queue: asyncio.Queue[StreamEvent | None]) -> AsyncIterator[StreamEvent]:
    while (ev := await queue.get()) is not None:
        yield ev


async def _run(store, session, history, request, turn_id, queue) -> None:
    seq = 0
    committed = False

    async def emit(ev: StreamEvent) -> None:  # stamps the monotonic seq
        nonlocal seq
        queue.put_nowait(ev.model_copy(update={"seq": seq}))
        seq += 1

    try:
        await emit(TurnStartEvent(seq=0, turn_id=turn_id))
        expected_version = session.state.version
        ctx = ToolContext(session=session, emit=emit, store=store, budget=session.budget)
        new = await get_engine(session.engine).run_turn(ctx, request, history)
        session.budget.turns += 1
        messages = [m.model_copy(update={"turn_no": len(history) + i}) for i, m in enumerate(new)]
        state = await store.commit_turn(session.id, turn_id, messages, session, expected_version)
        committed = True
        await emit(StateEvent(seq=0, state=state))
        await emit(DoneEvent(seq=0, turn_id=turn_id))
    except Exception as exc:
        log.exception("turn_failed", extra={"session": session.id})
        if isinstance(exc, AppError):
            err = ErrorEvent(seq=0, code=exc.code, message=exc.message, retryable=exc.retryable)
        else:
            err = ErrorEvent(seq=0, code="turn_failed", message="the turn failed", retryable=True)
        await emit(err)
    finally:
        if not committed:
            await store.release_turn(session.id, turn_id)
        queue.put_nowait(None)
