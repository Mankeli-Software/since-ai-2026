import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, status

from app.api.deps import SessionDep, SettingsDep, StoreDep
from app.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    FitSession,
    PublicSession,
    TranscriptEntry,
)
from app.schemas.state import FittingState

router = APIRouter(tags=["session"])


@router.post("/api/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest, store: StoreDep, settings: SettingsDep
) -> CreateSessionResponse:
    now = datetime.now(UTC)
    engine = body.engine or ("live" if settings.llm_mode == "live" else "scripted")
    session = FitSession(
        id=secrets.token_urlsafe(24),
        resume_token=secrets.token_urlsafe(24),
        created_at=now,
        updated_at=now,
        engine=engine,
        host=body.host,
        demo_golfer_id=body.demo_golfer_id,
        state=FittingState(),
    )
    await store.create(session)
    return CreateSessionResponse(
        session_id=session.id, resume_token=session.resume_token, state=session.state
    )


@router.get("/api/sessions/{session_id}")
async def get_session(session: SessionDep, store: StoreDep) -> PublicSession:
    messages = await store.list_messages(session.id)
    transcript = [
        TranscriptEntry(turn_no=m.turn_no, role=m.role, text=m.display_text)
        for m in messages
        if m.display_text and m.role in ("user", "assistant")
    ]
    # Never include email (plan §3.8).
    return PublicSession(
        session_id=session.id,
        engine=session.engine,
        status=session.status,
        state=session.state,
        transcript=transcript,
    )
