import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, status

from app.agent.guard import check_session_create, pick_engine
from app.api.deps import SessionDep, SettingsDep, StoreDep
from app.api.guard_deps import DemoKeyHeader
from app.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    FitSession,
    PublicSession,
    ResumeSessionResponse,
    SaveSessionRequest,
    SaveSessionResponse,
    TranscriptEntry,
)
from app.schemas.state import FittingState

router = APIRouter(tags=["session"])


@router.post("/api/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    store: StoreDep,
    settings: SettingsDep,
    demo_key: DemoKeyHeader = None,
) -> CreateSessionResponse:
    check_session_create(demo_key)  # 429: global bucket (#18)
    now = datetime.now(UTC)
    # The server decides: a client can opt out of live (smoke uses scripted), never into it.
    # Past the daily model-call cap, a new session gets scripted + a notice (#18).
    live = settings.llm_mode == "live" and body.engine != "scripted"
    engine, notice = pick_engine(live, body.demo_golfer_id, demo_key)
    session = FitSession(
        id=secrets.token_urlsafe(24),
        resume_token=secrets.token_urlsafe(24),
        created_at=now,
        updated_at=now,
        engine=engine,
        host=body.host,
        demo_golfer_id=body.demo_golfer_id,
        state=FittingState(),
        notice=notice,
    )
    await store.create(session)
    return CreateSessionResponse(
        session_id=session.id, resume_token=session.resume_token, state=session.state, notice=notice
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
        notice=session.notice,
    )


@router.post("/api/sessions/{session_id}/save")
async def save_session(
    session: SessionDep,
    store: StoreDep,
    body: SaveSessionRequest | None = None,
) -> SaveSessionResponse:
    session.status = "saved"
    if body and body.email:
        session.email = body.email.strip() or None
    await store.save(session)
    return SaveSessionResponse(saved=True, resume_url=f"/studio.html?resume={session.resume_token}")


@router.get("/api/resume/{resume_token}")
async def resume_session(
    resume_token: str,
    store: StoreDep,
) -> ResumeSessionResponse:
    session = await store.load_by_resume_token(resume_token)
    return ResumeSessionResponse(
        session_id=session.id,
        demo_golfer_id=session.demo_golfer_id,
        engine=session.engine,
        state=session.state,
    )
