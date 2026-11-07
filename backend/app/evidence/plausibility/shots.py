"""v1 shot-level rules S1, S3, S7, S8, S10, S14 (plan §5.2; issue #31). Pure: shots in, flags out.

One function per rule. Each takes the shots of **one session = one club** and returns flags whose
`shot_index` is the position in the list it was given (V3 in `extraction.py` relies on that).
`check_shots()` runs every v1 rule per club group of a mixed import and maps the indices back.

Flags carry codes and numbers only; the assistant phrases them (plan §5.3).

| Rule | Severity | Field |
|---|---|---|
| S1 hard 7-iron bounds | reject | the out-of-bounds field |
| S3 smash checksum | reject | smash_factor |
| S7 club-speed spike (robust z) | downweight > 3.5, reject > 5 | club_speed_mph |
| S8 mishit (kept for means and lie) | downweight | smash_factor / impact_offset_mm |
| S10 carry looks like metres | confirm (session) | carry_yd |
| S14 shot count | confirm < 3, info 3-4, info < 8 near a flex line | club_speed_mph |
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Callable, Sequence

from app.evidence.plausibility.extraction import S1_CELL_BOUNDS, S3_SMASH_TOL
from app.pack import swing_bucket_from_speed
from app.schemas.evidence import Flag, Shot

ShotRule = Callable[[list[Shot]], list[Flag]]

# Plan §5.2. Rule definitions, so constants here; thresholds.json (#33) can replace them later.
S1_BOUNDS = S1_CELL_BOUNDS  # one copy of the hard bounds, shared with V4
S7_DOWNWEIGHT_Z = 3.5
S7_REJECT_Z = 5.0
S7_MIN_SPREAD_MPH = 1.0  # robust z = (x - med) / max(1.4826 MAD, 1.0 mph)
S8_SMASH_Z = -3.5
S8_SMASH_MIN_SPREAD = 0.02
S8_MAX_IMPACT_R_MM = 25.0  # r = sqrt(offset^2 + (1.2 height)^2)
S8_MIN_SMASH = 1.10
S10_METRES_RATIO = (0.87, 0.95)  # median carry / predicted carry
# Predicted 7-iron carry from the ball: least squares on 60k train shots (first half of the first
# 120k rows), terms [1, ball, launch, spin/1000, ball^2/100, ball*launch/100]; RMSE 2.2 yd on the
# held-out half. With it, 1.3% of clean train sessions land in the S10 window and 98.4% of the same
# sessions in metres do. (The club-speed line `2.536 v - 63.3` put 16.7% of clean sessions there.)
# #33's gen_thresholds.py may refit these.
CARRY_FIT = (-160.1567, 3.491, 3.5947, -1.6187, -0.5053, -3.2484)
YD_PER_M = 1.09361
MIN_ROBUST_N = 4  # robust z needs a few shots to mean anything
S14_LOW = 3  # fewer usable shots than this: low confidence
S14_TRUSTED = 5
S14_NEAR_FLEX_N = 8  # within 2 mph of a flex line: ask for 8-10 shots
S14_NEAR_FLEX_MPH = 2.0


def _robust_z(xs: Sequence[float], floor: float) -> list[float]:
    med = statistics.median(xs)
    mad = statistics.median(abs(x - med) for x in xs)
    scale = max(1.4826 * mad, floor)
    return [(x - med) / scale for x in xs]


def s1_hard_bounds(shots: list[Shot]) -> list[Flag]:
    """S1: any value outside the hard 7-iron bounds rejects the shot (one flag per field)."""
    out = []
    for i, s in enumerate(shots):
        for field, (lo, hi) in S1_BOUNDS.items():
            v = getattr(s, field)
            if v is not None and not lo <= v <= hi:
                out.append(
                    Flag(
                        code="S1",
                        severity="reject",
                        field=field,
                        value=v,
                        expected=f"{lo:g} to {hi:g}",
                        shot_index=i,
                        message_id="s1_out_of_bounds",
                    )
                )
    return out


def s3_smash_checksum(shots: list[Shot]) -> list[Flag]:
    """S3: |smash - ball/club| > 0.02 means a digit was misread somewhere: reject the shot."""
    out = []
    for i, s in enumerate(shots):
        if s.smash_factor is None or not s.ball_speed_mph or not s.club_speed_mph:
            continue
        ratio = s.ball_speed_mph / s.club_speed_mph
        if abs(s.smash_factor - ratio) > S3_SMASH_TOL:
            out.append(
                Flag(
                    code="S3",
                    severity="reject",
                    field="smash_factor",
                    value=s.smash_factor,
                    expected=f"ball/club = {ratio:.2f}",
                    shot_index=i,
                    message_id="s3_smash_checksum",
                    suggested_value=round(ratio, 2),
                )
            )
    return out


def s7_club_speed_spike(shots: list[Shot]) -> list[Flag]:
    """S7: robust z of club speed > 3.5 downweights the shot, > 5 rejects it."""
    idx = [i for i, s in enumerate(shots) if s.club_speed_mph is not None]
    if len(idx) < MIN_ROBUST_N:
        return []
    xs = [shots[i].club_speed_mph for i in idx]
    med = statistics.median(xs)  # type: ignore[type-var]
    out = []
    for i, z in zip(idx, _robust_z(xs, S7_MIN_SPREAD_MPH), strict=True):  # type: ignore[arg-type]
        if abs(z) <= S7_DOWNWEIGHT_Z:
            continue
        out.append(
            Flag(
                code="S7",
                severity="reject" if abs(z) > S7_REJECT_Z else "downweight",
                field="club_speed_mph",
                value=shots[i].club_speed_mph,
                expected=f"session median {med:.1f} mph, robust z {z:+.1f}",
                shot_index=i,
                message_id="s7_club_speed_spike",
            )
        )
    return out


def s8_mishit(shots: list[Shot]) -> list[Flag]:
    """S8: smash robust z < -3.5, impact r > 25 mm, or smash < 1.10. Downweight: the shot still
    counts for mean speed, mean carry and lie, just not for solid-shot median carry."""
    smash_idx = [i for i, s in enumerate(shots) if s.smash_factor is not None]
    smash_z: dict[int, float] = {}
    if len(smash_idx) >= MIN_ROBUST_N:
        zs = _robust_z([shots[i].smash_factor for i in smash_idx], S8_SMASH_MIN_SPREAD)  # type: ignore[misc]
        smash_z = dict(zip(smash_idx, zs, strict=True))
    out = []
    for i, s in enumerate(shots):
        field, value, expected = None, None, None
        if s.smash_factor is not None and s.smash_factor < S8_MIN_SMASH:
            field, value, expected = "smash_factor", s.smash_factor, f">= {S8_MIN_SMASH}"
        elif smash_z.get(i, 0.0) < S8_SMASH_Z:
            field, value = "smash_factor", s.smash_factor
            expected = f"robust z {smash_z[i]:+.1f}"
        elif s.impact_offset_mm is not None and s.impact_height_mm is not None:
            r = math.hypot(s.impact_offset_mm, 1.2 * s.impact_height_mm)
            if r > S8_MAX_IMPACT_R_MM:
                field, value = "impact_offset_mm", s.impact_offset_mm
                expected = f"impact {r:.0f} mm from centre (max {S8_MAX_IMPACT_R_MM:g})"
        if field is not None:
            out.append(
                Flag(
                    code="S8",
                    severity="downweight",
                    field=field,
                    value=value,
                    expected=expected,
                    shot_index=i,
                    message_id="s8_mishit",
                )
            )
    return out


def predicted_carry_yd(s: Shot) -> float | None:
    """Carry expected from the ball's launch (CARRY_FIT), or None without ball, launch and spin."""
    b, la, sp = s.ball_speed_mph, s.launch_angle_deg, s.spin_rate_rpm
    if b is None or la is None or sp is None:
        return None
    terms = (1.0, b, la, sp / 1000, b * b / 100, b * la / 100)
    return sum(c * t for c, t in zip(CARRY_FIT, terms, strict=True))


def s10_carry_in_metres(shots: list[Shot]) -> list[Flag]:
    """S10: median carry / median predicted carry in 0.87-0.95 looks like metres: confirm the unit.
    Predicted carry comes from ball speed, launch and spin (`predicted_carry_yd`); shots without
    them are skipped (a speed-only line is too loose to tell yards from metres)."""
    pairs = [
        (s.carry_yd, p) for s in shots if s.carry_yd is not None and (p := predicted_carry_yd(s))
    ]
    if len(pairs) < S14_LOW:
        return []
    carry = statistics.median(c for c, _ in pairs)
    predicted = statistics.median(p for _, p in pairs)
    if predicted <= 0:
        return []
    ratio = carry / predicted
    lo, hi = S10_METRES_RATIO
    if not lo <= ratio <= hi:
        return []
    return [
        Flag(
            code="S10",
            severity="confirm",
            field="carry_yd",
            value=round(carry, 1),
            expected=f"about {predicted:.0f} yd for this launch (ratio {ratio:.2f})",
            message_id="s10_carry_in_metres",
            suggested_value=round(carry * YD_PER_M, 1),
        )
    ]


def s14_shot_count(shots: list[Shot]) -> list[Flag]:
    """S14: < 3 shots is low confidence (confirm, ask for more); 3-4 is info; with 5+ shots but
    a mean speed within 2 mph of a flex line, fewer than 8 shots is info (ask for 8-10).
    Run it on the usable (non-rejected) shots: `check_shots` does."""
    n = len(shots)
    if n < S14_LOW:
        return [
            Flag(
                code="S14",
                severity="confirm",
                value=n,
                expected=f">= {S14_TRUSTED} shots",
                message_id="s14_too_few_shots",
            )
        ]
    if n < S14_TRUSTED:
        return [
            Flag(
                code="S14",
                severity="info",
                value=n,
                expected=f">= {S14_TRUSTED} shots",
                message_id="s14_few_shots",
            )
        ]
    speeds = [s.club_speed_mph for s in shots if s.club_speed_mph is not None]
    if len(speeds) >= n and n < S14_NEAR_FLEX_N:
        mean = statistics.fmean(speeds)
        lo = swing_bucket_from_speed(mean - S14_NEAR_FLEX_MPH)
        hi = swing_bucket_from_speed(mean + S14_NEAR_FLEX_MPH)
        if lo != hi:
            return [
                Flag(
                    code="S14",
                    severity="info",
                    field="club_speed_mph",
                    value=round(mean, 1),
                    expected=f"within {S14_NEAR_FLEX_MPH:g} mph of a flex line: "
                    f"{S14_NEAR_FLEX_N}-10 shots",
                    message_id="s14_near_flex_line",
                )
            ]
    return []


# Per-shot rules in the order they run. S14 runs separately on what survives the rejects.
V1_SHOT_RULES: tuple[ShotRule, ...] = (
    s1_hard_bounds,
    s3_smash_checksum,
    s7_club_speed_spike,
    s8_mishit,
    s10_carry_in_metres,
)


def check_shots(shots: Sequence[Shot], *, import_id: str | None = None) -> list[Flag]:
    """Every v1 shot rule, per club group. `shot_index` is the position in `shots`."""
    groups: dict[str, list[int]] = {}
    for i, s in enumerate(shots):
        groups.setdefault(s.club, []).append(i)
    out: list[Flag] = []
    for idx in groups.values():
        group = [shots[i] for i in idx]
        found: list[Flag] = []
        for rule in V1_SHOT_RULES:
            found += rule(group)
        rejected = {f.shot_index for f in found if f.severity == "reject"}
        usable = [s for j, s in enumerate(group) if j not in rejected]
        found += s14_shot_count(usable)
        for f in found:
            update: dict[str, object] = {"import_id": import_id}
            if f.shot_index is not None:
                update["shot_index"] = idx[f.shot_index]
            out.append(f.model_copy(update=update))
    return out


def rejected_indices(flags: Sequence[Flag]) -> set[int]:
    return {f.shot_index for f in flags if f.severity == "reject" and f.shot_index is not None}


def mishit_indices(flags: Sequence[Flag]) -> set[int]:
    return {f.shot_index for f in flags if f.code == "S8" and f.shot_index is not None}
