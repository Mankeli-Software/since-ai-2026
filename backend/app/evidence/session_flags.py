"""Golfer-level flags for a stored session (issue #31). Pure: reads the FitSession it is given.

`refresh(session)` re-runs G1, G2, G3 and G11 on the profile and the confirmed shots, merges the
result into `session.flags` (keeping what the golfer already resolved) and returns the new flags
plus the pending list for `FittingState.pending_flags`. Callers that change the profile or the
shots (import confirm, `POST /flags/recheck`, FIT's profile patch, AGENT's update_profile) call it
and save the session.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.evidence.fuse import merge_flags
from app.evidence.plausibility.golfer import golfer_flags
from app.schemas.evidence import Flag
from app.schemas.session import FitSession

GOLFER_CODES = {"G1", "G2", "G3", "G11"}


def pending(flags: Sequence[Flag]) -> list[Flag]:
    """Unresolved confirms: what the assistant still has to ask about."""
    return [f for f in flags if f.severity == "confirm" and not f.resolved]


def refresh(
    session: FitSession, extra_pending: Sequence[Flag] = ()
) -> tuple[list[Flag], list[Flag]]:
    """(session flags, pending flags) after re-running the v1 golfer rules."""
    values = {k: pv.value for k, pv in session.profile.items() if pv.value is not None}
    sex = values.get("sex")
    fresh = golfer_flags(values, session.state.shots, sex=sex if isinstance(sex, str) else None)
    flags = merge_flags(session.flags, fresh, GOLFER_CODES)
    # Shot-level confirms (S10, S14) of earlier imports stay pending until answered.
    earlier = [f for f in session.state.pending_flags if f.code not in GOLFER_CODES]
    seen = {(f.code, f.field, f.import_id, f.shot_index) for f in earlier}
    shots_pending = earlier + [
        f
        for f in pending(extra_pending)
        if (f.code, f.field, f.import_id, f.shot_index) not in seen
    ]
    return flags, pending(flags) + shots_pending
