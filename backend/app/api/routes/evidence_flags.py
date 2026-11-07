"""`POST /api/sessions/{id}/flags/recheck` (plan §5.2, §5.3; issue #31).

Re-runs the v1 golfer rules (G2 before G1, then G3; G11 carry against the confirmed shots) on the
stored profile, keeps what the golfer already resolved, saves, and returns the flags. Call it after
the profile changes (the import confirm route runs the same refresh itself). Codes and numbers only:
the assistant phrases them.
"""

from fastapi import APIRouter

from app.api.deps import SessionDep, StoreDep
from app.api.routes.evidence_confirm import fit_flags
from app.evidence import session_flags
from app.schemas.evidence import FlagsReport

router = APIRouter(tags=["evidence"])


@router.post("/api/sessions/{session_id}/flags/recheck")
async def recheck_flags(session: SessionDep, store: StoreDep) -> FlagsReport:
    expected = session.state.version
    session.flags, pending = session_flags.refresh(session)
    session.flags = fit_flags(session)  # W2 G12 / G14 (no-op without EVIDENCE_WAVE2)
    session.state = session.state.model_copy(update={"pending_flags": pending})
    state = await store.save(session, expected_version=expected)
    return FlagsReport(flags=session.flags, pending_flags=pending, state=state)
