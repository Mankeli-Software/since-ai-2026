"""Flags -> σ multipliers and usable evidence (plan §3.4 step 1, §5.3; issue #31). Pure.

| Severity | Effect |
|---|---|
| reject | excluded from every estimate (`None`) |
| downweight | σ × 2 |
| confirm | pending at σ × 3 until the golfer answers (resolved -> no effect) |
| info | shown only |

FIT's `mapping._flag_factor` applies the same table to profile fields; this module is the evidence
side: which shots survive an import and how good the import is.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.schemas.evidence import Flag, Shot, ShotQualityReport

SIGMA_FACTOR: dict[str, float] = {"downweight": 2.0, "confirm": 3.0, "info": 1.0}
TRUSTED_SHOTS = 5  # S14: quality saturates at 5 usable shots per club
MISHIT_PENALTY = 0.5  # a mishit counts half against quality: it still carries speed and lie


def sigma_factor(flags: Sequence[Flag], field: str) -> float | None:
    """σ multiplier for one source from its unresolved flags; None when a reject drops it."""
    factor = 1.0
    for f in flags:
        if f.field != field or f.resolved:
            continue
        if f.severity == "reject":
            return None
        factor = max(factor, SIGMA_FACTOR.get(f.severity, 1.0))
    return factor


def usable_shots(shots: Sequence[Shot], flags: Sequence[Flag]) -> list[Shot]:
    """Shots minus rejects (S1, S3, S7 > 5). S8 mishits are kept (they carry lie information)."""
    rejected = {f.shot_index for f in flags if f.severity == "reject" and not f.resolved}
    return [s for i, s in enumerate(shots) if i not in rejected]


def shot_quality(
    shots: Sequence[Shot], flags: Sequence[Flag], summary: dict[str, float]
) -> ShotQualityReport:
    """`ShotQualityReport` (plan §5.3): quality = count part (saturating at 5 per club, the
    smallest club counts) x (1 - reject share) x (1 - 0.5 mishit share)."""
    n = len(shots)
    rejected = {f.shot_index for f in flags if f.severity == "reject" and f.shot_index is not None}
    mishits = {f.shot_index for f in flags if f.code == "S8" and f.shot_index is not None}
    mishits -= rejected
    per_club: dict[str, int] = {}
    for i, s in enumerate(shots):
        if i not in rejected:
            per_club[s.club] = per_club.get(s.club, 0) + 1
    count = min(min(per_club.values(), default=0), TRUSTED_SHOTS) / TRUSTED_SHOTS
    quality = 0.0
    if n:
        quality = count * (1 - len(rejected) / n) * (1 - MISHIT_PENALTY * len(mishits) / n)
    return ShotQualityReport(
        n_shots=n,
        n_used=n - len(rejected),
        n_rejected=len(rejected),
        n_mishits=len(mishits),
        quality=round(quality, 2),
        flags=list(flags),
        summary=summary,
    )


def merge_flags(old: Sequence[Flag], new: Sequence[Flag], codes: set[str]) -> list[Flag]:
    """Replace the flags of `codes` with a fresh run, keeping `resolved` on any flag that is the
    same finding (code, field, import) as before. Flags of other codes are kept as they were."""
    resolved = {(f.code, f.field, f.import_id) for f in old if f.resolved}
    kept = [f for f in old if f.code not in codes]
    fresh = [
        f.model_copy(update={"resolved": True}) if (f.code, f.field, f.import_id) in resolved else f
        for f in new
    ]
    return kept + fresh
