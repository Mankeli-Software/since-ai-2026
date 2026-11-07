"""`POST /api/sessions/{id}/imports/{import_id}/confirm` (plan §5.1, §5.3, §5.5; issues #30, #31).

The golfer confirms a pending import ("this is what we read", V6). Its **usable** shots join
`FittingState.shots`: S1 / S3 / S7 rejects are dropped, S8 mishits are kept (they carry lie
information). The import id joins `import_ids` and `evidence_version` is bumped so the confidence
re-runs. The golfer rules (G1, G2, G3, G11) re-run on the profile and the new shots, so G11 fires
when a claimed carry disagrees with the measured one. Unresolved confirms go to `pending_flags`.

Evidence accumulates: a new import never replaces an earlier one. Confirming twice is a no-op; a
discarded import cannot be confirmed.
"""

from fastapi import APIRouter
from pydantic import TypeAdapter, ValidationError
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.confidence.analysis import analyze, refresh_state
from app.confidence.next_question import next_question
from app.core.errors import ConflictError
from app.evidence import session_flags
from app.evidence.fuse import usable_shots
from app.evidence.settings import settings as evidence_settings
from app.evidence.shot_checks import run_shot_rules, stored_monitor
from app.fitting.mapping import estimate_inputs
from app.fitting.session_inputs import answered, evidence_of, intake_of
from app.schemas.evidence import Flag, ImportReport, Shot
from app.schemas.fit import FitEvidence
from app.schemas.session import FitSession, StoredImport
from app.schemas.state import FittingState

router = APIRouter(tags=["evidence"])

_SHOTS = TypeAdapter(list[Shot])


def _report(imp: StoredImport) -> ImportReport:
    try:
        base = ImportReport.model_validate_json(imp.report_json)
    except ValueError:  # screenshot imports store an ExtractionReview here, not an ImportReport
        base = ImportReport(import_id=imp.import_id, kind="screenshot", club=imp.club)
    return base.model_copy(update={"status": imp.status})


def rescore(session: FitSession) -> FittingState:
    """Re-run the meter, close calls, best spec and next question on the new evidence, as the
    profile patch does, so the returned state shows confidence rise (plan §3.4 step 8). Shared
    with the flag-resolve route."""
    try:
        intake, evidence = intake_of(session), evidence_of(session)
    except ValidationError:
        return session.state
    a = analyze(intake, evidence, session_id=session.id, evidence_version=session.evidence_version)
    offered = session.state.precision_offered
    nq = next_question(intake, evidence, a, answered=answered(session), offered=offered)
    return refresh_state(session.state, a, nq)


def fit_flags(session: FitSession) -> list[Flag]:
    """W2 G12 / G14 against the fit as it stands (call after `rescore`): FIT's own swing bucket
    from the self-report alone vs from the measured shots, and `state.best`. Without
    EVIDENCE_WAVE2 the session's flags come back unchanged. Shared with the recheck route."""
    if not evidence_settings.wave2:
        return list(session.flags)
    try:
        intake, ev = intake_of(session), evidence_of(session)
    except ValidationError:
        return list(session.flags)
    own = estimate_inputs(intake, FitEvidence(flags=ev.flags))
    measured = estimate_inputs(intake, FitEvidence(shots=ev.shots, flags=ev.flags))
    shot_based = ev.shots and measured.speed is not None
    shot_based = shot_based and measured.speed.prov.source in ("trackman", "radar")  # type: ignore[union-attr]
    return session_flags.refresh_fit_flags(
        session,
        self_bucket=own.swing_bucket,
        measured_bucket=measured.swing_bucket if shot_based else None,
        measured_speed_mph=measured.speed.value if shot_based else None,  # type: ignore[union-attr]
    )


@router.post("/api/sessions/{session_id}/imports/{import_id}/confirm")
async def confirm_import(import_id: str, session: SessionDep, store: StoreDep) -> ImportReport:
    imp = await store.get_import(session.id, import_id)
    if imp.status == "discarded":
        raise ConflictError("This import was discarded.", code="import_discarded")
    shots = _SHOTS.validate_json(imp.parsed_shots_json)
    if imp.status == "confirmed" or import_id in session.state.import_ids:
        return _report(imp).model_copy(update={"shots": shots, "state": session.state})

    # Same rules (and monitor) as the pending report.
    monitor = stored_monitor(imp.report_json)
    shot_flags = run_shot_rules(shots, monitor=monitor, import_id=import_id)
    expected = session.state.version
    session.evidence_version += 1
    session.state = session.state.model_copy(
        update={
            "evidence_version": session.evidence_version,
            "import_ids": [*session.state.import_ids, import_id],
            "shots": [
                *session.state.shots,
                *(
                    s.model_copy(update={"import_id": import_id})
                    for s in usable_shots(shots, shot_flags)
                ),
            ],
        }
    )
    session.flags, pending = session_flags.refresh(session, extra_pending=shot_flags)
    session.state = session.state.model_copy(update={"pending_flags": pending})
    session.state = await run_in_threadpool(rescore, session)
    session.flags = fit_flags(session)  # W2 G12 / G14 see the new fit
    state = await store.save(session, expected_version=expected)
    imp = imp.model_copy(update={"status": "confirmed"})
    await store.put_import(session.id, imp)
    return _report(imp).model_copy(update={"shots": shots, "state": state})
