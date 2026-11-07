"""Demo routes: picker personas, demo golfer sessions, and sample files (plan §3.8, L16)."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from app.agent.guard import pick_engine
from app.api.demo import (
    get_demo_personas,
    get_sample_file,
    load_demo_fixture,
    seed_demo_session,
)
from app.api.deps import SettingsDep, StoreDep
from app.schemas.session import (
    DemoGolferDetail,
    DemoGolferSummary,
    FitSession,
    SampleImport,
)
from app.schemas.state import FittingState

router = APIRouter(tags=["demo"])


@router.get("/api/demo")
async def list_demo_golfers() -> list[DemoGolferSummary]:
    """Return the four L8 demo personas for the 'Try as' picker (plan §6.6, L16)."""
    return get_demo_personas()


@router.get("/api/demo/{golfer_id}")
async def get_demo_golfer(
    golfer_id: str,
    store: StoreDep,
    settings: SettingsDep,
) -> DemoGolferDetail:
    """Return a demo golfer with a pre-seeded session (plan §3.8)."""
    fixture = load_demo_fixture(golfer_id)
    now = datetime.now(UTC)
    live = settings.llm_mode == "live"
    engine, notice = pick_engine(live, golfer_id, None)
    session = FitSession(
        id=secrets.token_urlsafe(24),
        resume_token=secrets.token_urlsafe(24),
        created_at=now,
        updated_at=now,
        engine=engine,
        demo_golfer_id=golfer_id,
        state=FittingState(),
        notice=notice,
    )
    await run_in_threadpool(seed_demo_session, session, golfer_id)
    await store.create(session)
    return DemoGolferDetail(
        session_id=session.id,
        resume_token=session.resume_token,
        golfer_id=fixture["golfer_id"],
        name=fixture["name"],
        age=fixture["age"],
        teaser=fixture["teaser"],
        synthetic=fixture.get("synthetic", True),
        profile=session.profile,
        sample_imports=[SampleImport(**s) for s in fixture.get("sample_imports", [])],
        state=session.state,
    )


@router.get("/api/demo/{golfer_id}/samples/{sample_id}")
async def get_demo_sample(golfer_id: str, sample_id: str) -> Response:
    """Serve a synthetic sample file (TrackMan CSV or ball_line JSON)."""
    content, media_type, filename = get_sample_file(golfer_id, sample_id)
    headers = {}
    if media_type == "text/csv":
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return Response(content=content, media_type=media_type, headers=headers)
