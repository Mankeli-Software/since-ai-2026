"""`POST /api/sessions/{id}/imports/{import_id}/confirm` (plan §5.1, §5.5; issue #30).

The golfer confirms a pending import ("this is what we read"). Its parsed shots join
`FittingState.shots`, the import id joins `import_ids`, and `evidence_version` is bumped so the
confidence re-runs on the new evidence. Evidence accumulates: a new import never replaces an earlier
one. Confirming twice is a no-op; a discarded import cannot be confirmed.
"""

from fastapi import APIRouter
from pydantic import TypeAdapter

from app.api.deps import SessionDep, StoreDep
from app.core.errors import ConflictError
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

    # TODO(#31): drop S1/S3 rejects here (keep S8 mishits: they carry lie information).
    expected = session.state.version
    session.evidence_version += 1
    session.state = session.state.model_copy(
        update={
            "evidence_version": session.evidence_version,
            "import_ids": [*session.state.import_ids, import_id],
            "shots": [*session.state.shots, *shots],
        }
    )
    state = await store.save(session, expected_version=expected)
    imp = imp.model_copy(update={"status": "confirmed"})
    await store.put_import(session.id, imp)
    return _report(imp).model_copy(update={"shots": shots, "state": state})
