"""Wave 2 shot-level rules S2, S5, S6, S9, S11, S12, S13, S16, S17, S18 (plan §5.2; issue #33).

Same shape as the v1 rules in `shots.py`: one function per rule, the shots of **one session = one
club** in, flags out, `shot_index` = position in the list given. `check_shots(...,
extra_rules=wave2_shot_rules(ctx))` runs them per club group next to the v1 rules; the routes
pass them only when `EVIDENCE_WAVE2=1` (`evidence/settings.py`). S15 (TrackMan's own ignore flag)
belongs to the link importer, which is cut (L6).

| Rule | Severity | Field |
|---|---|---|
| S2 rare value (train p0.1-p99.9) | confirm | the rare field |
| S5 carry vs flight | confirm / reject, x device tol | carry_yd |
| S6 total < carry - 3 yd | confirm (columns swapped?) | total_yd |
| S9 high carry or smash (robust z > +3.5) | confirm | carry_yd / smash_factor |
| S11 carries inconsistent (ratio outside 0.87-1.12; metres without spin) | confirm | carry_yd |
| S12 side sign flipped | confirm, suggested flip (session) | side_yd |
| S13 face-to-path checksum | reject that field only (`usable_shots` blanks it) | face_to_path_deg |
| S16 hitting surface is a mat / simulator | info (session) | - |
| S17 device is not TrackMan / GCQuad | info (session); S5 / S11 tolerance x 1.6 | - |
| S18 not normalised, high altitude or far from 20 C | info (session); carry tolerance x 1.6 | - |

Session context the app does not collect yet (surface, normalisation, altitude) comes in through
`ShotContext`; a rule whose input is absent returns no flags. S5 / S11 predict carry from the ball:
with spin through `shots.predicted_carry_yd` (fitted on train shots, which the pack's
`physics.fly` produced; `gen_thresholds.py` prints how close it is), without spin through the
quadratic fits in `thresholds.json`.
"""

from __future__ import annotations

import statistics
from collections.abc import Sequence
from dataclasses import dataclass
from functools import partial

from app.evidence.plausibility.shots import (
    MIN_ROBUST_N,
    S10_METRES_RATIO,
    S14_LOW,
    YD_PER_M,
    ShotRule,
    _robust_z,
    predicted_carry_yd,
)
from app.evidence.plausibility.thresholds import (
    CARRY_FITS_NO_SPIN,
    PRECISE_MONITORS,
    S1_BOUNDS,
    S2_RARE,
    S5_CONFIRM,
    S5_REJECT,
    S6_TOTAL_BELOW_CARRY_YD,
    S9_Z,
    S11_BAND,
    S13_F2P_TOL_DEG,
    S18_ALTITUDE_M,
    S18_TEMP_DELTA_C,
    TOL_PRECISE,
    TOL_RADAR,
)
from app.schemas.evidence import Flag, Shot

S9_MIN_SPREAD = {"carry_yd": 3.0, "smash_factor": 0.02}
S12_LAUNCH_DIR_K = 2.19  # side ~ 2.19 launch_dir + 0.74 spin_axis (plan §5.2)
S12_SPIN_AXIS_K = 0.74


@dataclass(frozen=True)
class ShotContext:
    """What an import knows about where its shots came from. Everything optional."""

    monitor: str | None = None  # "trackman", a vision `monitor` read, a vendor alias name
    hitting_surface: str | None = None  # TrackMan "hittingSurface": "Mat" | "Grass"
    simulator: bool = False
    normalization_mode: str | None = None  # TrackMan "normalizationMode": "Actual" | ...
    altitude_m: float | None = None
    temperature_c: float | None = None


def _precise(monitor: str | None) -> bool | None:
    if monitor is None:
        return None
    m = monitor.lower().replace(" ", "")
    return any(p in m for p in PRECISE_MONITORS)


def _not_normalised(ctx: ShotContext) -> bool:
    if (ctx.normalization_mode or "").lower() != "actual":
        return False
    high = ctx.altitude_m is not None and ctx.altitude_m > S18_ALTITUDE_M
    hot_cold = ctx.temperature_c is not None and abs(ctx.temperature_c - 20.0) > S18_TEMP_DELTA_C
    return high or hot_cold


def device_tol(shots: Sequence[Shot], ctx: ShotContext | None = None) -> float:
    """S5 / S11 tolerance: 1.6 for a radar (a non-TrackMan / GCQuad monitor, a pack
    `home_radar` session) or an S18 not-normalised session, else 1.0."""
    ctx = ctx or ShotContext()
    radar = _precise(ctx.monitor) is False or any(s.session == "home_radar" for s in shots)
    return TOL_RADAR if radar or _not_normalised(ctx) else TOL_PRECISE


def _no_spin_terms(s: Shot) -> dict[str, float | None]:
    b, la, cs = s.ball_speed_mph, s.launch_angle_deg, s.club_speed_mph
    return {
        "1": 1.0,
        "ball": b,
        "launch": la,
        "club": cs,
        "ball2": None if b is None else b * b / 100,
        "launch2": None if la is None else la * la / 100,
        "club2": None if cs is None else cs * cs / 100,
        "ball_launch": None if b is None or la is None else b * la / 100,
    }


def predict_carry_no_spin(s: Shot) -> float | None:
    """Carry from the first `thresholds.json` no-spin fit whose inputs this shot has."""
    terms = _no_spin_terms(s)
    for fit in CARRY_FITS_NO_SPIN:
        xs = [terms.get(t) for t in fit["terms"]]
        if all(x is not None for x in xs):
            return sum(c * x for c, x in zip(fit["coef"], xs, strict=True))  # type: ignore[operator]
    return None


def predict_carry(s: Shot) -> float | None:
    """With spin: `shots.predicted_carry_yd`; without: the no-spin quadratic fits."""
    p = predicted_carry_yd(s)
    return p if p is not None else predict_carry_no_spin(s)


def s2_rare_value(shots: list[Shot]) -> list[Flag]:
    """S2: a value outside the train p0.1-p99.9 range (but inside S1) -> confirm."""
    out = []
    for i, s in enumerate(shots):
        for field, (lo, hi) in S2_RARE.items():
            v = getattr(s, field)
            if v is None:
                continue
            if (lo is not None and v < lo) or (hi is not None and v > hi):
                expected = (
                    f"usually {lo:g} to {hi:g}"
                    if lo is not None and hi is not None
                    else f"usually below {hi:g}"
                    if hi is not None
                    else f"usually above {lo:g}"
                )
                out.append(
                    Flag(
                        code="S2",
                        severity="confirm",
                        field=field,
                        value=v,
                        expected=expected,
                        shot_index=i,
                        message_id="s2_rare_value",
                    )
                )
    return out


def s5_carry_vs_flight(shots: list[Shot], *, ctx: ShotContext | None = None) -> list[Flag]:
    """S5: carry vs the carry its launch predicts. Confirm above max(12 yd, 8 %) x tol, reject
    above max(25 yd, 18 %) x tol; tol 1.0 for TrackMan / GCQuad / vision, 1.6 for a radar."""
    tol = device_tol(shots, ctx)
    out = []
    for i, s in enumerate(shots):
        if s.carry_yd is None:
            continue
        pred = predict_carry(s)
        if pred is None or pred <= 0:
            continue
        resid = s.carry_yd - pred
        confirm = max(S5_CONFIRM[0], S5_CONFIRM[1] * pred) * tol
        reject = max(S5_REJECT[0], S5_REJECT[1] * pred) * tol
        if abs(resid) <= confirm:
            continue
        out.append(
            Flag(
                code="S5",
                severity="reject" if abs(resid) > reject else "confirm",
                field="carry_yd",
                value=s.carry_yd,
                expected=f"about {pred:.0f} yd for this launch (+-{confirm:.0f})",
                shot_index=i,
                message_id="s5_carry_vs_flight",
                suggested_value=round(pred, 1),
            )
        )
    return out


def s6_total_below_carry(shots: list[Shot]) -> list[Flag]:
    """S6: total < carry - 3 yd -> confirm (were carry and total swapped?)."""
    out = []
    for i, s in enumerate(shots):
        if s.carry_yd is None or s.total_yd is None:
            continue
        if not S1_BOUNDS["carry_yd"][0] <= s.carry_yd <= S1_BOUNDS["carry_yd"][1]:
            continue  # S1 already rejects the carry; total is not the suspect
        if s.total_yd < s.carry_yd - S6_TOTAL_BELOW_CARRY_YD:
            out.append(
                Flag(
                    code="S6",
                    severity="confirm",
                    field="total_yd",
                    value=s.total_yd,
                    expected=f">= carry {s.carry_yd:g} - {S6_TOTAL_BELOW_CARRY_YD:g}",
                    shot_index=i,
                    message_id="s6_total_below_carry",
                )
            )
    return out


def s9_high_carry_or_smash(shots: list[Shot]) -> list[Flag]:
    """S9: carry or smash with a session robust z above +3.5 -> confirm (one flag per field)."""
    out = []
    for field, floor in S9_MIN_SPREAD.items():
        idx = [i for i, s in enumerate(shots) if getattr(s, field) is not None]
        if len(idx) < MIN_ROBUST_N:
            continue
        xs = [getattr(shots[i], field) for i in idx]
        med = statistics.median(xs)
        for i, z in zip(idx, _robust_z(xs, floor), strict=True):
            if z > S9_Z:
                out.append(
                    Flag(
                        code="S9",
                        severity="confirm",
                        field=field,
                        value=getattr(shots[i], field),
                        expected=f"session median {med:g}, robust z {z:+.1f}",
                        shot_index=i,
                        message_id="s9_high_value",
                    )
                )
    return out


def s11_carries_inconsistent(shots: list[Shot], *, ctx: ShotContext | None = None) -> list[Flag]:
    """S11: median carry / median predicted carry outside 0.87-1.12 (widened by the device tol)
    -> confirm: a wrong column or unit. S10 owns the 0.87-0.95 metres window inside it, but S10
    needs spin; for a radar session without spin, S11 asks about metres in that window too."""
    pairs = [(s.carry_yd, p) for s in shots if s.carry_yd is not None and (p := predict_carry(s))]
    if len(pairs) < S14_LOW:
        return []
    carry = statistics.median(c for c, _ in pairs)
    predicted = statistics.median(p for _, p in pairs)
    if predicted <= 0:
        return []
    tol = device_tol(shots, ctx)
    lo = 1 - (1 - S11_BAND[0]) * tol
    hi = 1 + (S11_BAND[1] - 1) * tol
    ratio = carry / predicted
    no_spin = all(predicted_carry_yd(s) is None for s in shots)
    metres = no_spin and S10_METRES_RATIO[0] <= ratio <= S10_METRES_RATIO[1]
    if lo <= ratio <= hi and not metres:
        return []
    return [
        Flag(
            code="S11",
            severity="confirm",
            field="carry_yd",
            value=round(carry, 1),
            expected=f"about {predicted:.0f} yd for this launch (ratio {ratio:.2f}, "
            f"usually {lo:.2f}-{hi:.2f})",
            message_id="s11_carry_in_metres" if metres else "s11_carries_inconsistent",
            suggested_value=round(carry * YD_PER_M, 1) if metres else None,
        )
    ]


def s12_side_sign_flipped(shots: list[Shot]) -> list[Flag]:
    """S12: sum of side x (2.19 launch_dir + 0.74 spin_axis) < 0 -> confirm, then auto-flip.
    Side, launch direction and spin axis are all in the target frame (left-handers too)."""
    terms = [
        s.side_yd * (S12_LAUNCH_DIR_K * s.launch_direction_deg + S12_SPIN_AXIS_K * s.spin_axis_deg)
        for s in shots
        if s.side_yd is not None
        and s.launch_direction_deg is not None
        and s.spin_axis_deg is not None
    ]
    if len(terms) < S14_LOW or sum(terms) >= 0:
        return []
    return [
        Flag(
            code="S12",
            severity="confirm",
            field="side_yd",
            value=round(sum(terms), 1),
            expected="side follows launch direction and spin axis (+ = right)",
            message_id="s12_side_sign_flipped",
            suggested_value="flip",
        )
    ]


def s13_face_to_path_checksum(shots: list[Shot]) -> list[Flag]:
    """S13: |face_to_path - (face - path)| > 0.2 deg -> reject that field only (the shot stays:
    `fuse.usable_shots` blanks `face_to_path_deg`)."""
    out = []
    for i, s in enumerate(shots):
        f2p, face, path = s.face_to_path_deg, s.face_angle_deg, s.club_path_deg
        if f2p is None or face is None or path is None:
            continue
        diff = face - path
        if abs(f2p - diff) > S13_F2P_TOL_DEG:
            out.append(
                Flag(
                    code="S13",
                    severity="reject",
                    field="face_to_path_deg",
                    value=f2p,
                    expected=f"face - path = {diff:+.1f}",
                    shot_index=i,
                    message_id="s13_face_to_path_checksum",
                    suggested_value=round(diff, 1),
                )
            )
    return out


def s16_hitting_surface(
    shots: Sequence[Shot], *, hitting_surface: str | None = None, simulator: bool = False
) -> list[Flag]:
    """S16: a mat or a simulator forgives fat strikes (attack angle and low point look better
    than on turf; carry is mostly unaffected) -> info. No surface known, no flag."""
    mat = (hitting_surface or "").strip().lower() == "mat"
    if not shots or not (mat or simulator):
        return []
    return [
        Flag(
            code="S16",
            severity="info",
            value="simulator" if simulator else "mat",
            message_id="s16_hitting_surface",
        )
    ]


def s17_device_tolerance(shots: Sequence[Shot], *, monitor: str | None = None) -> list[Flag]:
    """S17: the monitor is not a TrackMan or GCQuad (a home radar, or unknown) -> info; S5 and
    S11 use the radar tolerance x1.6 (`device_tol`). No monitor named, no flag."""
    if not shots or _precise(monitor) is not False:
        return []
    return [
        Flag(
            code="S17",
            severity="info",
            expected=f"carry checks widened x{TOL_RADAR:g}",
            message_id="s17_device_tolerance",
        )
    ]


def s18_not_normalised(shots: Sequence[Shot], *, ctx: ShotContext | None = None) -> list[Flag]:
    """S18: "Actual" (not normalised) numbers above 500 m or far from 20 C -> info; carry
    checks use the wider tolerance. Without the normalisation mode, no flag."""
    if not shots or ctx is None or not _not_normalised(ctx):
        return []
    return [
        Flag(
            code="S18",
            severity="info",
            value=ctx.altitude_m,
            expected=f"normalised, or below {S18_ALTITUDE_M:g} m and near 20 C",
            message_id="s18_not_normalised",
        )
    ]


def wave2_shot_rules(ctx: ShotContext | None = None) -> tuple[ShotRule, ...]:
    """The W2 per-session rules for `check_shots(..., extra_rules=...)`, bound to this import's
    context. Pure: the caller decides whether W2 is on (`evidence.settings.settings.wave2`)."""
    return (
        s2_rare_value,
        partial(s5_carry_vs_flight, ctx=ctx),
        s6_total_below_carry,
        s9_high_carry_or_smash,
        partial(s11_carries_inconsistent, ctx=ctx),
        s12_side_sign_flipped,
        s13_face_to_path_checksum,
    )


def wave2_session_flags(
    shots: Sequence[Shot], ctx: ShotContext | None = None, *, import_id: str | None = None
) -> list[Flag]:
    """S16, S17, S18: once per import (they describe the session, not a club group)."""
    ctx = ctx or ShotContext()
    flags = s16_hitting_surface(shots, hitting_surface=ctx.hitting_surface, simulator=ctx.simulator)
    flags += s17_device_tolerance(shots, monitor=ctx.monitor)
    flags += s18_not_normalised(shots, ctx=ctx)
    return [f.model_copy(update={"import_id": import_id}) for f in flags]
