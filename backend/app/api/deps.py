"""Shared FastAPI dependencies. Routes get the store and the session through these, never globals.

from app.api.deps import SessionDep, StoreDep

@router.get("/api/sessions/{session_id}/thing", tags=["fit"])
async def thing(session: SessionDep, store: StoreDep) -> Thing: ...
"""

from typing import Annotated

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.schemas.ports import SessionStore
from app.schemas.session import FitSession


def get_store(request: Request) -> SessionStore:
    return request.app.state.store


StoreDep = Annotated[SessionStore, Depends(get_store)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def load_session(session_id: str, store: StoreDep) -> FitSession:
    """Loads `{session_id}` from the path; raises NotFoundError (404) before any streaming."""
    return await store.load(session_id)


SessionDep = Annotated[FitSession, Depends(load_session)]
