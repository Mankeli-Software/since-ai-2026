"""Golfer-level flags for a stored session (issue #31). Pure: reads the FitSession it is given.

`refresh(session)` re-runs G1, G2, G3 and G11 (plus the W2 profile rules G4-G10 when
`EVIDENCE_WAVE2=1`) on the profile and the confirmed shots, merges the
result into `session.flags` (keeping what the golfer already resolved) and returns the new flags
plus the pending list for `FittingState.pending_flags`. Callers that change the profile or the
shots (import confirm, `POST /flags/recheck`, FIT's profile patch, AGENT's update_profile) call it
and save the session.

`refresh_fit_flags(session, ...)` (W2 only) re-runs the rules that need the fit, G12 (FIT's swing
buckets, passed in by the caller) and G14 (`state.best`). Call it **after** the rescore.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.evidence.fuse import merge_flags
from app.evidence.plausibility.golfer import golfer_flags
from app.evidence.plausibility.golfer_w2 import wave2_fit_flags, wave2_golfer_flags
from app.evidence.settings import settings
from app.schemas.evidence import Flag
from app.schemas.session import FitSession

GOLFER_CODES = {"G1", "G2", "G3", "G11"}
W2_GOLFER_CODES = {"G4", "G5", "G6", "G7", "G8", "G9", "G10"}
W2_FIT_CODES = {"G12", "G14"}  # info only: never pending


def pending(flags: Sequence[Flag]) -> list[Flag]:
    """Unresolved confirms: what the assistant still has to ask about."""
    return [f for f in flags if f.severity == "confirm" and not f.resolved]


def _values(session: FitSession) -> dict[str, object]:
    return {k: pv.value for k, pv in session.profile.items() if pv.value is not None}


def refresh(
    session: FitSession, extra_pending: Sequence[Flag] = ()
) -> tuple[list[Flag], list[Flag]]:
    """(session flags, pending flags) after re-running the v1 golfer rules."""
    values = _values(session)
    sex = values.get("sex")
    sex = sex if isinstance(sex, str) else None
    fresh = golfer_flags(values, session.state.shots, sex=sex)
    codes = GOLFER_CODES
    if settings.wave2:
        fresh += wave2_golfer_flags(values, sex=sex)
        codes = GOLFER_CODES | W2_GOLFER_CODES
    flags = merge_flags(session.flags, fresh, codes)
    # Shot-level confirms (S10, S14) of earlier imports stay pending until answered.
    earlier = [f for f in pending(session.state.pending_flags) if f.code not in codes]
    seen = {(f.code, f.field, f.import_id, f.shot_index) for f in earlier}
    shots_pending = earlier + [
        f
        for f in pending(extra_pending)
        if (f.code, f.field, f.import_id, f.shot_index) not in seen
    ]
    return flags, pending(flags) + shots_pending


def refresh_fit_flags(
    session: FitSession,
    *,
    self_bucket: int | None,
    measured_bucket: int | None,
    measured_speed_mph: float | None = None,
) -> list[Flag]:
    """Session flags after re-running G12 and G14 against the current fit (W2 only, or G14 with
    EVIDENCE_ENABLE_G14; otherwise the flags come back unchanged). Both are info, so the pending
    list does not change."""
    if not (settings.wave2 or settings.enable_g14):
        return list(session.flags)
    fresh = wave2_fit_flags(
        _values(session),
        spec=session.state.best,
        self_bucket=self_bucket,
        measured_bucket=measured_bucket,
        measured_speed_mph=measured_speed_mph,
    )
    return merge_flags(session.flags, fresh, W2_FIT_CODES)
