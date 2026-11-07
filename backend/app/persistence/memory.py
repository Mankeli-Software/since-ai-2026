"""`InMemorySessionStore` (`STORE=memory`): safe on one Cloud Run instance (plan §8.1).

Every write is encoded with `encode_for_firestore()` and every read decodes it again, so callers
never share mutable objects with the store and Firestore-unsafe shapes fail fast.
`save()` and `commit_turn()` are optimistic on `state.version` and bump it on every write.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.errors import ConflictError, NotFoundError
from app.persistence.store import encode_for_firestore
from app.schemas.session import FitSession, StoredImport, StoredMessage
from app.schemas.state import FittingState


def _now() -> datetime:
    return datetime.now(UTC)


def _bumped(new: FittingState, stored_version: int) -> FittingState:
    """Every state write bumps the version past the stored one. A caller that already emitted a
    higher version mid-turn keeps it, so the client never sees a version go backwards."""
    return new.model_copy(update={"version": max(stored_version + 1, new.version)})


class InMemorySessionStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._sessions: dict[str, dict[str, Any]] = {}
        self._messages: dict[str, list[dict[str, Any]]] = {}
        self._imports: dict[str, dict[str, dict[str, Any]]] = {}

    def _get(self, sid: str) -> FitSession:
        doc = self._sessions.get(sid)
        if doc is None:
            raise NotFoundError(f"session {sid} not found", code="session_not_found")
        return FitSession.model_validate(doc)

    def _put(self, s: FitSession) -> None:
        self._sessions[s.id] = encode_for_firestore(s)

    async def create(self, s: FitSession) -> None:
        async with self._lock:
            if s.id in self._sessions:
                raise ConflictError(f"session {s.id} exists")
            self._put(s)
            self._messages[s.id] = []
            self._imports[s.id] = {}

    async def load(self, sid: str) -> FitSession:
        async with self._lock:
            return self._get(sid)

    async def save(self, s: FitSession, expected_version: int | None = None) -> FittingState:
        async with self._lock:
            current = self._get(s.id)
            if expected_version is not None and current.state.version != expected_version:
                raise ConflictError("state changed; reload and retry", code="version_conflict")
            # Never clobber a lock taken by a concurrent turn.
            s = s.model_copy(
                update={
                    "state": _bumped(s.state, current.state.version),
                    "active_turn_id": current.active_turn_id,
                    "active_turn_expires": current.active_turn_expires,
                    "updated_at": _now(),
                }
            )
            self._put(s)
            return s.state

    async def acquire_turn(self, sid: str, turn_id: str, ttl_s: int = 120) -> bool:
        async with self._lock:
            s = self._get(sid)
            now = _now()
            held = s.active_turn_id is not None and (
                s.active_turn_expires is None or s.active_turn_expires > now
            )
            if held and s.active_turn_id != turn_id:
                return False
            s.active_turn_id = turn_id
            s.active_turn_expires = now + timedelta(seconds=ttl_s)
            self._put(s)
            return True

    async def commit_turn(
        self,
        sid: str,
        turn_id: str,
        messages: list[StoredMessage],
        session: FitSession,
        expected_version: int,
    ) -> FittingState:
        async with self._lock:
            current = self._get(sid)
            if current.active_turn_id != turn_id:
                raise ConflictError("turn lock lost", code="turn_lock_lost")
            if current.state.version != expected_version:
                raise ConflictError("state changed during the turn", code="version_conflict")
            encoded_msgs = [encode_for_firestore(m) for m in messages]  # encode all before writing
            committed = session.model_copy(
                update={
                    "state": _bumped(session.state, current.state.version),
                    "active_turn_id": None,
                    "active_turn_expires": None,
                    "updated_at": _now(),
                }
            )
            encoded_session = encode_for_firestore(committed)
            self._messages[sid].extend(encoded_msgs)
            self._sessions[sid] = encoded_session
            return committed.state

    async def release_turn(self, sid: str, turn_id: str) -> None:
        async with self._lock:
            s = self._get(sid)
            if s.active_turn_id == turn_id:
                s.active_turn_id = None
                s.active_turn_expires = None
                self._put(s)

    async def list_messages(self, sid: str) -> list[StoredMessage]:
        async with self._lock:
            self._get(sid)
            return [StoredMessage.model_validate(m) for m in self._messages[sid]]

    async def put_import(self, sid: str, imp: StoredImport) -> None:
        async with self._lock:
            self._get(sid)
            self._imports[sid][imp.import_id] = encode_for_firestore(imp)

    async def get_import(self, sid: str, import_id: str) -> StoredImport:
        async with self._lock:
            self._get(sid)
            doc = self._imports[sid].get(import_id)
            if doc is None:
                raise NotFoundError(f"import {import_id} not found", code="import_not_found")
            return StoredImport.model_validate(doc)
