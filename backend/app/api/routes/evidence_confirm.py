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
from pydantic import TypeAdapter

from app.api.deps import SessionDep, StoreDep
from app.core.errors import ConflictError
from app.evidence import session_flags
from app.evidence.fuse import usable_shots
from app.evidence.plausibility.shots import check_shots
from app.evidence.plausibility.shots_w2 import ShotContext, wave2_shot_rules
from app.evidence.settings import settings
from app.schemas.evidence import ImportReport, Shot
from app.schemas.session import StoredImport

router = APIRouter(tags=["evidence"])

_SHOTS = TypeAdapter(list[Shot])


def _report(imp: StoredImport) -> ImportReport:
    try:
        base = ImportReport.model_validate_json(imp.report_json)
    except ValueError:  # screenshot imports store an ExtractionReview here, not an ImportReport
        base = ImportReport(import_id=imp.import_id, kind="screenshot", club=imp.club)
    return base.model_copy(update={"status": imp.status})


@router.post("/api/sessions/{session_id}/imports/{import_id}/confirm")
async def confirm_import(import_id: str, session: SessionDep, store: StoreDep) -> ImportReport:
    imp = await store.get_import(session.id, import_id)
    if imp.status == "discarded":
        raise ConflictError("This import was discarded.", code="import_discarded")
    shots = _SHOTS.validate_json(imp.parsed_shots_json)
    if imp.status == "confirmed" or import_id in session.state.import_ids:
        return _report(imp).model_copy(update={"shots": shots, "state": session.state})

    # Same rules as the pending report (W2 too when EVIDENCE_WAVE2=1).
    extra = wave2_shot_rules(ShotContext(monitor=_report(imp).vendor)) if settings.wave2 else ()
    shot_flags = check_shots(shots, import_id=import_id, extra_rules=extra)
    expected = session.state.version
    session.evidence_version += 1
    session.state = session.state.model_copy(
        update={
            "evidence_version": session.evidence_version,
            "import_ids": [*session.state.import_ids, import_id],
            "shots": [*session.state.shots, *usable_shots(shots, shot_flags)],
        }
    )
    session.flags, pending = session_flags.refresh(session, extra_pending=shot_flags)
    session.state = session.state.model_copy(update={"pending_flags": pending})
    state = await store.save(session, expected_version=expected)
    imp = imp.model_copy(update={"status": "confirmed"})
    await store.put_import(session.id, imp)
    return _report(imp).model_copy(update={"shots": shots, "state": state})
