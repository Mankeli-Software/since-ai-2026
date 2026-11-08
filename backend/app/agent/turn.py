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

from pydantic import TypeAdapter, ValidationError

from app.agent.engines.base import Engine, answer_of, load_tools
from app.core.errors import AppError, InvalidInputError, TurnBusyError
from app.core.tooling import ToolContext
from app.schemas.chat import (
    DoneEvent,
    ErrorEvent,
    StateEvent,
    StreamEvent,
    TurnRequest,
    TurnStartEvent,
    UiEvent,
    UiResponseMessage,
)
from app.schemas.ports import SessionStore
from app.schemas.session import PublicBlock

log = logging.getLogger(__name__)

LOCK_TTL_S = 300
BLOCKS = TypeAdapter(list[PublicBlock])
# The stored cards (`ui_blocks_json`) are capped so a long session stays well under the 900 KB
# session-document limit (`encode_for_firestore`). Older cards drop first; their turns then show
# as text only in "Show conversation". The pending card and the newest card of each type stay.
MAX_STORED_BLOCKS = 80
MAX_STORED_BLOCKS_BYTES = 300_000
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
    shown: list[PublicBlock] = []  # this turn's ui blocks, kept on the session for resume (#216)

    async def emit(ev: StreamEvent) -> None:  # stamps the monotonic seq
        nonlocal seq
        if isinstance(ev, UiEvent) and getattr(ev.block, "type", None) == "recommendation_card":
            st = session.state
            if st.best is not None:
                ev = ev.model_copy(
                    update={
                        "block": ev.block.model_copy(
                            update={
                                "spec": st.best,
                                "purchase": st.best.purchase,
                                "confidence": (
                                    st.confidence
                                    if st.confidence is not None
                                    else ev.block.confidence
                                ),
                                "gate": st.gate,
                                "strength": st.strength,
                                "runner_up": st.runner_up or ev.block.runner_up,
                            }
                        )
                    }
                )
        if isinstance(ev, UiEvent):
            shown.append(PublicBlock(id=ev.id, block=ev.block, interactive=ev.interactive))
        queue.put_nowait(ev.model_copy(update={"seq": seq}))
        seq += 1

    try:
        await emit(TurnStartEvent(seq=0, turn_id=turn_id))
        expected_version = session.state.version
        _record_answer(session, request)
        ctx = ToolContext(session=session, emit=emit, store=store, budget=session.budget)
        new = await get_engine(session.engine).run_turn(ctx, request, history)
        session.budget.turns += 1
        messages = [m.model_copy(update={"turn_no": len(history) + i}) for i, m in enumerate(new)]
        last = len(history) + len(new) - 1
        if shown:
            blocks = shown_blocks(session) + [b.model_copy(update={"turn_no": last}) for b in shown]
            session.ui_blocks_json = _dump_capped(blocks, session.pending_ui_id)
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


def _record_answer(session, request: TurnRequest) -> None:
    """Put the golfer's answer on the card it answers, so a resumed chat shows the pick (#216)."""
    ans = answer_of(session, request)
    msg = request.message
    target = msg.component_id if isinstance(msg, UiResponseMessage) else session.pending_ui_id
    if ans is None or target is None:
        return
    value, display_text = ans
    blocks = shown_blocks(session)
    for b in blocks:
        if b.id == target and b.answer is None:
            b.answer = {"value": value, "display_text": display_text}
            session.ui_blocks_json = BLOCKS.dump_json(blocks).decode()
            return


def _dump_capped(blocks: list[PublicBlock], pending_id: str | None) -> str:
    """`blocks` as JSON, oldest dropped first past MAX_STORED_BLOCKS / MAX_STORED_BLOCKS_BYTES.
    Never drops the pending card or the newest card of each type (the resumed studio needs them)."""
    newest = {b.block.type: i for i, b in enumerate(blocks)}
    keep_always = set(newest.values()) | {i for i, b in enumerate(blocks) if b.id == pending_id}
    size = [len(b.model_dump_json()) + 1 for b in blocks]  # + the comma between items
    keep, total = list(range(len(blocks))), sum(size) + 2
    for i in range(len(blocks)):
        if len(keep) <= MAX_STORED_BLOCKS and total <= MAX_STORED_BLOCKS_BYTES:
            break
        if i not in keep_always:
            keep.remove(i)
            total -= size[i]
    return BLOCKS.dump_json([blocks[i] for i in keep]).decode()


def shown_blocks(session) -> list[PublicBlock]:
    """The cards the session has shown so far. Unreadable blocks are dropped, never fatal."""
    try:
        return BLOCKS.validate_json(session.ui_blocks_json or "[]")
    except ValidationError:
        log.warning("ui_blocks_unreadable", extra={"session": session.id})
        return []
