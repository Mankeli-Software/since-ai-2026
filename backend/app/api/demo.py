"""Demo fixtures loader and session seeding helpers (plan §3.8, §6.6, L16)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.confidence.analysis import analyze, refresh_state
from app.confidence.next_question import next_question
from app.core.errors import NotFoundError
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.common import ProvenancedValue
from app.schemas.session import DemoGolferSummary, FitSession, SampleImport

_DEMO_ID_RE = re.compile(r"^DEMO-\d{2}$")
_SAMPLE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
L8_PERSONAS = ("DEMO-01", "DEMO-09", "DEMO-04", "DEMO-13")


def find_fixtures_dir() -> Path:
    """Find the fixtures/ directory across worktree, root, and Docker environments."""
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        cand = parent / "fixtures"
        if cand.is_dir():
            return cand
    cand = Path.cwd() / "fixtures"
    if cand.is_dir():
        return cand
    return Path(__file__).resolve().parents[4] / "fixtures"


def load_demo_fixture(golfer_id: str) -> dict[str, Any]:
    """Load JSON fixture for a demo golfer."""
    if not _DEMO_ID_RE.match(golfer_id):
        raise NotFoundError(f"invalid demo golfer id: {golfer_id!r}")
    fixtures_dir = find_fixtures_dir()
    path = fixtures_dir / "demo" / f"{golfer_id}.json"
    if not path.is_file():
        raise NotFoundError(f"demo golfer fixture {golfer_id!r} not found")
    return json.loads(path.read_text(encoding="utf-8"))


def seed_demo_session(session: FitSession, demo_golfer_id: str) -> dict[str, Any]:
    """Seed session profile from questionnaire fixture and compute initial state."""
    fixture = load_demo_fixture(demo_golfer_id)
    profile_raw = fixture.get("profile", {})
    for k, pv in profile_raw.items():
        session.profile[k] = ProvenancedValue(
            source=pv.get("source", "questionnaire"),
            value=pv.get("value"),
        )
    intake = intake_of(session)
    evidence = evidence_of(session)
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    nq = next_question(intake, evidence, a, answered=answered(session), offered=[])
    session.state = refresh_state(session.state, a, nq)
    return fixture


def get_demo_personas() -> list[DemoGolferSummary]:
    """Return the four L8 demo personas for the persona picker."""
    summaries: list[DemoGolferSummary] = []
    for gid in L8_PERSONAS:
        try:
            data = load_demo_fixture(gid)
            summaries.append(
                DemoGolferSummary(
                    golfer_id=data["golfer_id"],
                    name=data["name"],
                    age=data["age"],
                    teaser=data["teaser"],
                    synthetic=data.get("synthetic", True),
                    sample_imports=[SampleImport(**s) for s in data.get("sample_imports", [])],
                )
            )
        except NotFoundError:
            continue
    return summaries


def get_sample_file(golfer_id: str, sample_id: str) -> tuple[bytes, str, str]:
    """Return (file_bytes, media_type, filename) for a demo sample."""
    if not _DEMO_ID_RE.match(golfer_id):
        raise NotFoundError(f"invalid demo golfer id: {golfer_id!r}")
    if not _SAMPLE_ID_RE.match(sample_id):
        raise NotFoundError(f"invalid sample id: {sample_id!r}")

    fixtures_dir = find_fixtures_dir()
    sample_dir = fixtures_dir / "demo" / "samples" / golfer_id
    csv_file = sample_dir / f"{sample_id}.csv"
    if csv_file.is_file():
        return csv_file.read_bytes(), "text/csv", f"{sample_id}.csv"

    json_file = sample_dir / f"{sample_id}.json"
    if json_file.is_file():
        return json_file.read_bytes(), "application/json", f"{sample_id}.json"

    raise NotFoundError(f"sample {sample_id!r} not found for {golfer_id}")
