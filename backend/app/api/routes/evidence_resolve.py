"""`POST /api/sessions/{id}/flags/resolve` (plan §5.3; issue #31).

The golfer's answer to an `outlier_review`: `{action: keep | exclude | confirm_value, codes,
import_id?}` (the web block already sends `{action, codes}`). The answer is applied by
`app.evidence.resolve` (profile values, confirmed shots, flags marked resolved), the golfer rules
re-run, and the meter is refreshed, so the returned state shows what the answer changed.
"""

from fastapi import APIRouter
from pydantic import TypeAdapter
from starlette.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.api.routes.evidence_confirm import rescore
from app.core.errors import NotFoundError
from app.evidence import resolve, session_flags
from app.schemas.evidence import (
    Flag,
    ImportReport,
    ResolveFlagsRequest,
    ResolveFlagsResponse,
    Shot,
)

router = APIRouter(tags=["evidence"])

_SHOTS = TypeAdapter(list[Shot])


@router.post("/api/sessions/{session_id}/flags/resolve")
async def resolve_flags(
    body: ResolveFlagsRequest, session: SessionDep, store: StoreDep
) -> ResolveFlagsResponse:
    report_flags: list[Flag] = []
    if body.import_id is not None:
        imp = await store.get_import(session.id, body.import_id)
        try:
            report_flags = ImportReport.model_validate_json(imp.report_json).report.flags
        except ValueError:
            report_flags = []  # a screenshot review, not an ImportReport
    flags = resolve.targets(body, session.state.pending_flags, report_flags)

    parsed: dict[str, list[Shot]] = {}
    for iid in {f.import_id for f in flags if f.import_id and f.shot_index is not None}:
        try:
            parsed[iid] = _SHOTS.validate_json(
                (await store.get_import(session.id, iid)).parsed_shots_json
            )
        except NotFoundError:
            continue

    expected = session.state.version
    outcome = resolve.resolve(session, body, flags, parsed)
    session.flags, pending = session_flags.refresh(session)
    session.state = session.state.model_copy(update={"pending_flags": pending})
    if outcome.changed_fields or outcome.shots_removed or outcome.shots_converted:
        session.evidence_version += 1
        session.state = session.state.model_copy(
            update={"evidence_version": session.evidence_version}
        )
    session.state = await run_in_threadpool(rescore, session)
    state = await store.save(session, expected_version=expected)
    return ResolveFlagsResponse(
        resolved=outcome.resolved,
        changed_fields=outcome.changed_fields,
        shots_removed=outcome.shots_removed,
        shots_converted=outcome.shots_converted,
        pending_flags=pending,
        state=state,
    )
