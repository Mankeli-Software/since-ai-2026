"""The engine interface (plan 4.7). Engines never touch HTTP: they emit events through `ctx.emit`
and return the messages to store. `agent/turn.py` owns the lock, `seq`, commit and errors."""

import importlib
import importlib.util
import json
from datetime import UTC, datetime
from typing import Any, Protocol

from app.core.registry import discover
from app.core.tooling import ToolContext
from app.schemas.chat import TextMessage, TurnRequest
from app.schemas.common import Engine as EngineName
from app.schemas.session import FitSession, StoredMessage


class Engine(Protocol):
    async def run_turn(
        self, ctx: ToolContext, request: TurnRequest, history: list[StoredMessage]
    ) -> list[StoredMessage]:
        """Run one turn. Set `ctx.session.pending_ui_id` when the turn ends on an input component.
        Return the new messages (user first); the runner numbers them and commits atomically."""
        ...


def load_tools() -> None:
    """Import `agent/tools/*` (sorted) so their tools register. No-op until that exists."""
    if importlib.util.find_spec("app.agent.tools") is not None:
        discover("app.agent.tools")


def answer_of(session: FitSession, request: TurnRequest) -> tuple[Any, str | None] | None:
    """(value, display_text) when this message answers the pending input component, else None.
    A free-text message while a component is pending also answers it, so history stays valid."""
    msg = request.message
    if isinstance(msg, TextMessage):
        return (msg.text, msg.text) if session.pending_ui_id else None
    return msg.value, msg.display_text


def user_text(request: TurnRequest) -> str | None:
    msg = request.message
    return msg.text if isinstance(msg, TextMessage) else msg.display_text


def stored(
    role: str, engine: EngineName, text: str | None, messages: list[dict[str, Any]] | None = None
) -> StoredMessage:
    """`parts_json` is a JSON list of engine-native messages (empty for the scripted engine)."""
    return StoredMessage(
        turn_no=0,  # numbered by the runner
        role=role,  # type: ignore[arg-type]
        engine=engine,
        parts_json=json.dumps(messages or []),
        display_text=text,
        created_at=datetime.now(UTC),
    )
