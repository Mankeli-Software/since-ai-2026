"""`FirestoreSessionStore` (`STORE=firestore`): Firestore Native, async client (plan §8.1, §8.2).

Layout (every doc goes through `encode_for_firestore()`, so nested arrays are JSON strings and
each doc is < 900 KB):

    sessions/{id}                     FitSession + `message_count` (next message seq)
    sessions/{id}/messages/{seq:08d}  StoredMessage + `seq` (append order, list order)
    sessions/{id}/imports/{import_id} StoredImport (parsed numbers only, never the raw upload)

The turn lock is a lease (`active_turn_id` + `active_turn_expires`) taken and released inside
Firestore transactions, so a crashed turn frees itself after `ttl_s`. `save()` and
`commit_turn()` are optimistic on `state.version` and bump it, exactly like the memory store.
`email` is stored on the session doc like any field; only `PublicSession` leaves the API.

`google-cloud-firestore` is imported lazily in `__init__`, so `STORE=memory` (the default) never
needs the package or GCP credentials.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.errors import ConflictError, NotFoundError
from app.persistence.settings import FirestoreSettings
from app.persistence.store import encode_for_firestore
from app.schemas.session import FitSession, StoredImport, StoredMessage
from app.schemas.state import FittingState

_MSG_COUNT = "message_count"
_SEQ = "seq"

_MISSING_DEP = (
    "STORE=firestore needs the `google-cloud-firestore` package, which is not installed. "
    "Add it to backend/pyproject.toml (ask the lead: deps are frozen) or run with STORE=memory."
)


def _now() -> datetime:
    return datetime.now(UTC)


def _bumped(new: FittingState, stored_version: int) -> FittingState:
    """Same rule as the memory store: past the stored version, never below the caller's."""
    return new.model_copy(update={"version": max(stored_version + 1, new.version)})


def _session_doc(s: FitSession, message_count: int) -> dict[str, Any]:
    return encode_for_firestore({**s.model_dump(mode="json"), _MSG_COUNT: message_count})


def _from_snap(snap: Any, sid: str) -> tuple[FitSession, int]:
    if not snap.exists:
        raise NotFoundError(f"session {sid} not found", code="session_not_found")
    data = snap.to_dict() or {}
    count = int(data.pop(_MSG_COUNT, 0))
    return FitSession.model_validate(data), count


class FirestoreSessionStore:
    def __init__(self, settings: FirestoreSettings | None = None) -> None:
        try:
            from google.api_core import exceptions as gexc  # type: ignore[import-not-found]
            from google.cloud import firestore  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - depends on the environment
            raise RuntimeError(_MISSING_DEP) from exc
        cfg = settings or FirestoreSettings()
        self._fs = firestore
        self._already_exists = gexc.AlreadyExists
        self._client = firestore.AsyncClient(project=cfg.project, database=cfg.database)
        self._sessions = self._client.collection(cfg.collection)

    # ------------------------------------------------------------------ helpers

    def _ref(self, sid: str) -> Any:
        return self._sessions.document(sid)

    async def _require(self, sid: str) -> Any:
        ref = self._ref(sid)
        _from_snap(await ref.get(), sid)  # raises session_not_found
        return ref

    async def _run(self, fn: Any) -> Any:
        """Run `fn(transaction)` in a Firestore transaction (retried on contention)."""
        return await self._fs.async_transactional(fn)(self._client.transaction())

    # ------------------------------------------------------------------ SessionStore

    async def create(self, s: FitSession) -> None:
        try:
            await self._ref(s.id).create(_session_doc(s, 0))
        except self._already_exists as exc:
            raise ConflictError(f"session {s.id} exists") from exc

    async def load(self, sid: str) -> FitSession:
        return _from_snap(await self._ref(sid).get(), sid)[0]

    async def save(self, s: FitSession, expected_version: int | None = None) -> FittingState:
        ref = self._ref(s.id)

        async def txn(t: Any) -> FittingState:
            current, count = _from_snap(await ref.get(transaction=t), s.id)
            if expected_version is not None and current.state.version != expected_version:
                raise ConflictError("state changed; reload and retry", code="version_conflict")
            # Never clobber a lock taken by a concurrent turn.
            new = s.model_copy(
                update={
                    "state": _bumped(s.state, current.state.version),
                    "active_turn_id": current.active_turn_id,
                    "active_turn_expires": current.active_turn_expires,
                    "updated_at": _now(),
                }
            )
            t.set(ref, _session_doc(new, count))
            return new.state

        return await self._run(txn)

    async def acquire_turn(self, sid: str, turn_id: str, ttl_s: int = 120) -> bool:
        ref = self._ref(sid)

        async def txn(t: Any) -> bool:
            current, _ = _from_snap(await ref.get(transaction=t), sid)
            now = _now()
            held = current.active_turn_id is not None and (
                current.active_turn_expires is None or current.active_turn_expires > now
            )
            if held and current.active_turn_id != turn_id:
                return False
            expires = (now + timedelta(seconds=ttl_s)).isoformat().replace("+00:00", "Z")
            t.update(ref, {"active_turn_id": turn_id, "active_turn_expires": expires})
            return True

        return await self._run(txn)

    async def commit_turn(
        self,
        sid: str,
        turn_id: str,
        messages: list[StoredMessage],
        session: FitSession,
        expected_version: int,
    ) -> FittingState:
        ref = self._ref(sid)
        msgs = ref.collection("messages")

        async def txn(t: Any) -> FittingState:
            current, count = _from_snap(await ref.get(transaction=t), sid)
            if current.active_turn_id != turn_id:
                raise ConflictError("turn lock lost", code="turn_lock_lost")
            if current.state.version != expected_version:
                raise ConflictError("state changed during the turn", code="version_conflict")
            encoded = [  # encode all before writing
                encode_for_firestore({**m.model_dump(mode="json"), _SEQ: count + i})
                for i, m in enumerate(messages)
            ]
            committed = session.model_copy(
                update={
                    "state": _bumped(session.state, current.state.version),
                    "active_turn_id": None,
                    "active_turn_expires": None,
                    "updated_at": _now(),
                }
            )
            doc = _session_doc(committed, count + len(encoded))
            for m in encoded:
                t.create(msgs.document(f"{m[_SEQ]:08d}"), m)
            t.set(ref, doc)
            return committed.state

        return await self._run(txn)

    async def release_turn(self, sid: str, turn_id: str) -> None:
        ref = self._ref(sid)

        async def txn(t: Any) -> None:
            current, _ = _from_snap(await ref.get(transaction=t), sid)
            if current.active_turn_id == turn_id:
                t.update(ref, {"active_turn_id": None, "active_turn_expires": None})

        await self._run(txn)

    async def list_messages(self, sid: str) -> list[StoredMessage]:
        ref = await self._require(sid)
        out: list[StoredMessage] = []
        async for snap in ref.collection("messages").order_by(_SEQ).stream():
            data = snap.to_dict() or {}
            data.pop(_SEQ, None)
            out.append(StoredMessage.model_validate(data))
        return out

    async def put_import(self, sid: str, imp: StoredImport) -> None:
        ref = await self._require(sid)
        await ref.collection("imports").document(imp.import_id).set(encode_for_firestore(imp))

    async def get_import(self, sid: str, import_id: str) -> StoredImport:
        ref = await self._require(sid)
        snap = await ref.collection("imports").document(import_id).get()
        if not snap.exists:
            raise NotFoundError(f"import {import_id} not found", code="import_not_found")
        return StoredImport.model_validate(snap.to_dict())
