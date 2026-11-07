"""Ports: Protocols implemented by outer layers and wired together in routes (plan §2.2).

`SessionStore` lives here (not only in `persistence/store.py`, which re-exports it) so that
`core/tooling.py` can type `ToolContext.store` while importing only `schemas`.
`ReportFetcher` (TrackMan link) is cut by L6 and deliberately absent.
"""

from typing import Literal, Protocol

from app.schemas.evidence import ExtractedSession
from app.schemas.session import FitSession, StoredImport, StoredMessage


class Extractor(Protocol):
    """Vision extraction of a launch-monitor or round-stats screenshot (agent/extract.py)."""

    async def extract(
        self, image: bytes, kind: Literal["launch_monitor", "round_stats"]
    ) -> ExtractedSession: ...


class SessionStore(Protocol):
    """Session persistence (plan §8.1). Every write is Firestore-safe (encode_for_firestore)."""

    async def create(self, s: FitSession) -> None: ...

    async def load(self, sid: str) -> FitSession:
        """Raise `app.core.errors.NotFoundError` if the session does not exist."""
        ...

    async def save(self, s: FitSession, expected_version: int | None = None) -> None:
        """Write outside a turn (REST imports, profile patch). Optimistic on state.version."""
        ...

    async def acquire_turn(self, sid: str, turn_id: str, ttl_s: int = 120) -> bool:
        """Compare-and-set the per-session turn lock; False if another turn holds it."""
        ...

    async def commit_turn(
        self,
        sid: str,
        turn_id: str,
        messages: list[StoredMessage],
        session: FitSession,
        expected_version: int,
    ) -> None:
        """Atomically append messages + write the session, then release the lock."""
        ...

    async def release_turn(self, sid: str, turn_id: str) -> None: ...

    async def list_messages(self, sid: str) -> list[StoredMessage]: ...

    async def put_import(self, sid: str, imp: StoredImport) -> None: ...

    async def get_import(self, sid: str, import_id: str) -> StoredImport: ...
