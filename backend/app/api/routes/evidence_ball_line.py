"""`POST /api/sessions/{id}/imports/ball-line` (plan §3.8, §5.1; issue #32).

Accepts typed ball-line tilt readings (3-5 readings, or up to 10 with append_to),
runs plausibility check G15, updates session evidence, and refreshes confidence / state.
"""

from __future__ import annotations

import json
import secrets
from datetime import UTC, datetime

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.confidence.analysis import analyze, refresh_state
from app.confidence.next_question import next_question
from app.core.errors import InvalidInputError
from app.evidence.parsers.ball_line import BallLineEvidence, parse_ball_line
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.common import ProvenancedValue
from app.schemas.evidence import BallLineImportRequest, ImportReport, ShotQualityReport
from app.schemas.session import FitSession, StoredImport
from app.schemas.state import FittingState

router = APIRouter(tags=["evidence"])


def _apply_ball_line(
    session: FitSession, ev_line: BallLineEvidence, import_id: str
) -> FittingState:
    session.profile["ball_line_tilt_deg"] = ProvenancedValue(
        source="ball_line",
        value=ev_line.readings_deg,
    )
    session.evidence_version += 1
    session.flags = [f for f in session.flags if f.field != "ball_line_tilt_deg"] + ev_line.flags

    new_import_ids = list(session.state.import_ids)
    if import_id not in new_import_ids:
        new_import_ids.append(import_id)

    pending_flags = [
        f for f in session.state.pending_flags if f.field != "ball_line_tilt_deg" and not f.resolved
    ]
    for f in ev_line.flags:
        if f.severity == "confirm" and not f.resolved:
            pending_flags.append(f)

    session.state = session.state.model_copy(
        update={
            "evidence_version": session.evidence_version,
            "import_ids": new_import_ids,
            "pending_flags": pending_flags,
        }
    )

    intake, evidence = intake_of(session), evidence_of(session)
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    nq = next_question(
        intake,
        evidence,
        a,
        answered=answered(session),
        offered=session.state.precision_offered,
    )
    return refresh_state(session.state, a, nq)


@router.post("/api/sessions/{session_id}/imports/ball-line")
async def import_ball_line(
    body: BallLineImportRequest,
    session: SessionDep,
    store: StoreDep,
) -> ImportReport:
    prior_readings: list[float] = []
    if body.append_to:
        prior_imp = await store.get_import(session.id, body.append_to)
        if prior_imp is not None and prior_imp.parsed_shots_json:
            try:
                parsed = json.loads(prior_imp.parsed_shots_json)
                if isinstance(parsed, list):
                    prior_readings = [float(x) for x in parsed]
            except (json.JSONDecodeError, ValueError):
                pass

    import_id = "imp_" + secrets.token_urlsafe(9)

    try:
        ev_line = parse_ball_line(
            body.readings_deg,
            club=body.club,
            prior_readings_deg=prior_readings,
            import_id=import_id,
        )
    except ValueError as e:
        raise InvalidInputError(str(e), code="bad_ball_line") from e

    quality_report = ShotQualityReport(
        n_shots=ev_line.n,
        n_used=ev_line.n,
        flags=ev_line.flags,
        summary={"mean_deg": ev_line.mean_deg, "sd_deg": ev_line.sd_deg},
    )

    stored_imp = StoredImport(
        import_id=import_id,
        kind="ball_line",
        club=body.club,
        parsed_shots_json=json.dumps(ev_line.readings_deg),
        report_json=quality_report.model_dump_json(),
        status="confirmed",
        created_at=datetime.now(UTC),
    )
    await store.put_import(session.id, stored_imp)

    expected = session.state.version
    session.state = await run_in_threadpool(_apply_ball_line, session, ev_line, import_id)
    state = await store.save(session, expected_version=expected)

    return ImportReport(
        import_id=import_id,
        kind="ball_line",
        club=body.club,
        readings_deg=ev_line.readings_deg,
        report=quality_report,
        status="confirmed",
        state=state,
    )
