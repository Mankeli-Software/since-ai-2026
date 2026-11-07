"""Wave 2 golfer-level rules G4-G10, G12, G14 (plan §5.2; issue #33). Pure.

Same conventions as `golfer.py`: values are profile fields (`IntakeAnswers` / `PhoneMeasurements`
names) and each flag's `field` is that name, so FIT's `mapping._flag_factor` applies the σ effect.
G13 (score vs round history) is in `round_history.py`. With `EVIDENCE_WAVE2=1`,
`session_flags.refresh` runs `wave2_golfer_flags` (G4-G10) and `refresh_fit_flags` runs
`wave2_fit_flags` (G12, G14) after the rescore. A rule whose inputs are missing returns no flags.

| Rule | Severity | Field |
|---|---|---|
| G4 wrist-to-floor vs height | confirm | wrist_to_floor_cm / wrist_to_floor_photo_cm |
| G5 hand vs height | confirm | hand_length_photo_cm |
| G6 glove vs hand photo, 2+ sizes apart | info ("we'll go with the photo") | glove |
| G7 speed vs profile | confirm (suggests km/h when it fits) | reported_7i_speed_mph |
| G8 driver speed typed in | confirm | reported_7i_speed_mph |
| G9 ego carry (profile only) | downweight | reported_7i_carry_yd |
| G10 carry short for speed | confirm | reported_7i_carry_yd |
| G12 self bucket vs measured bucket | info | reported_7i_speed_mph / reported_7i_carry_yd |
| G14 rare spec combination | info (simulated-golfer share) | spec |
"""

from __future__ import annotations

from collections.abc import Mapping

from app.evidence.plausibility.golfer import G1_BOUNDS, KIND
from app.evidence.plausibility.thresholds import (
    CARRY_SPEED_LINE,
    G4_LINE,
    G4_TOL_CM,
    G5_SLOPE,
    G5_TOL_CM,
    G9_EGO_YD,
    G10_SHORT_YD,
    G14_N_SPECS,
    G14_RARE_SHARE,
    G14_SPEC_COUNTS,
)
from app.evidence.settings import settings
from app.pack import GLOVE_ORDER, glove_from_hand_length
from app.schemas.common import Spec
from app.schemas.evidence import Flag

# G7 (plan §5.2): z = (v - mu) / (sigma + 2.5) > 3.5. Men: mu = 79 + 0.6 (88 - score)
# - 0.22 max(age - 45, 0), sigma 4.5. Women: 0.8 mu, sigma 3.6.
G7_Z = 3.5
G7_UNIT_Z = 2.5  # suggest a unit when converting brings z under this
G7_SD_PAD = 2.5
# Only units that make a typed number *too high* fit here: km/h. An m/s entry is too low and is
# G2's job (v1, `golfer.G2_CONVERSIONS`), so G7 never sees it.
G7_UNITS = (("km/h", 1 / 1.609),)
# G8: men, speed > 95 mph and score > 85.
G8_SPEED_MPH = 95.0
G8_SCORE = 85.0
# Score bucket -> a typical score, when there is no round-stats average (buckets: under 71, 71-77,
# 78-84, 85-92, over 92).
BUCKET_SCORE = {1: 68.0, 2: 74.0, 3: 81.0, 4: 88.5, 5: 97.0}


def _num(values: Mapping[str, object], field: str) -> float | None:
    v = values.get(field)
    if isinstance(v, bool) or not isinstance(v, int | float):
        return None
    return float(v)


def _in_g1(field: str, v: float | None) -> bool:
    """Only values inside the G1 hard bounds are compared: G1 / G2 already own the rest."""
    if v is None:
        return False
    lo, hi = G1_BOUNDS[KIND[field]]
    return lo <= v <= hi


def _score(values: Mapping[str, object]) -> float | None:
    avg = _num(values, "round_avg_score")
    if avg is not None:
        return avg
    bucket = _num(values, "score_bucket")
    return None if bucket is None else BUCKET_SCORE.get(int(bucket))


def g4_wrist_to_floor_vs_height(
    height_cm: float | None, wrist_to_floor_cm: float | None, *, field: str = "wrist_to_floor_cm"
) -> list[Flag]:
    """G4: |w2f - (0.4855 h + 2.0)| > 9 cm -> confirm ("measured in golf shoes, to the wrist
    crease?"). Run per source pair: typed height + typed w2f, photo height + photo w2f."""
    h_field = "height_photo_cm" if field.endswith("_photo_cm") else "height_cm"
    if not (_in_g1(h_field, height_cm) and _in_g1(field, wrist_to_floor_cm)):
        return []
    a, b = G4_LINE
    expected = a * height_cm + b  # type: ignore[operator]
    if abs(wrist_to_floor_cm - expected) <= G4_TOL_CM:  # type: ignore[operator]
        return []
    return [
        Flag(
            code="G4",
            severity="confirm",
            field=field,
            value=wrist_to_floor_cm,
            expected=f"about {expected:.0f} cm for {height_cm:g} cm tall (+-{G4_TOL_CM:g})",
            message_id="g4_wrist_to_floor_vs_height",
        )
    ]


def g5_hand_vs_height(hand_cm: float | None, height_cm: float | None) -> list[Flag]:
    """G5: |hand - 0.108 h| > 2.3 cm -> confirm."""
    if not (_in_g1("hand_length_photo_cm", hand_cm) and _in_g1("height_cm", height_cm)):
        return []
    expected = G5_SLOPE * height_cm  # type: ignore[operator]
    if abs(hand_cm - expected) <= G5_TOL_CM:  # type: ignore[operator]
        return []
    return [
        Flag(
            code="G5",
            severity="confirm",
            field="hand_length_photo_cm",
            value=hand_cm,
            expected=f"about {expected:.1f} cm for {height_cm:g} cm tall (+-{G5_TOL_CM:g})",
            message_id="g5_hand_vs_height",
        )
    ]


def g6_glove_vs_hand_photo(glove: str | None, hand_cm: float | None) -> list[Flag]:
    """G6: the typed glove and the hand photo's glove are 2+ sizes apart -> info ("we'll go
    with the photo"). The photo's glove comes from the pack's own table."""
    if glove not in GLOVE_ORDER or not _in_g1("hand_length_photo_cm", hand_cm):
        return []
    photo = glove_from_hand_length(hand_cm)  # type: ignore[arg-type]
    if abs(GLOVE_ORDER.index(photo) - GLOVE_ORDER.index(glove)) < 2:  # type: ignore[arg-type]
        return []
    return [
        Flag(
            code="G6",
            severity="info",
            field="glove",
            value=glove,
            expected=f"hand photo {hand_cm:g} cm = {photo}",
            message_id="g6_glove_vs_hand_photo",
            suggested_value=photo,
        )
    ]


def _g7_z(v: float, sex: str, score: float, age: float | None) -> float:
    mu = 79 + 0.6 * (88 - score) - 0.22 * max((age or 0) - 45, 0)
    sd = 4.5
    if sex == "female":
        mu, sd = 0.8 * mu, 3.6
    return (v - mu) / (sd + G7_SD_PAD)


def g7_speed_vs_profile(
    speed_mph: float | None, *, sex: str | None, score: float | None, age: float | None = None
) -> list[Flag]:
    """G7: typed 7-iron speed far above what sex, score and age suggest (z > 3.5) -> confirm.
    When reading it as km/h brings |z| under 2.5, that unit is the suggestion."""
    if speed_mph is None or sex not in ("male", "female") or score is None:
        return []
    z = _g7_z(speed_mph, sex, score, age)  # type: ignore[arg-type]
    if z <= G7_Z:
        return []
    suggested, unit = None, None
    for name, k in G7_UNITS:
        y = speed_mph * k
        if abs(_g7_z(y, sex, score, age)) < G7_UNIT_Z:  # type: ignore[arg-type]
            suggested, unit = round(y, 1), name
            break
    return [
        Flag(
            code="G7",
            severity="confirm",
            field="reported_7i_speed_mph",
            value=speed_mph,
            expected=f"z {z:+.1f} for this profile" + (f"; {unit}?" if unit else ""),
            message_id="g7_speed_vs_profile_unit" if unit else "g7_speed_vs_profile",
            suggested_value=suggested,
        )
    ]


def g8_driver_speed(speed_mph: float | None, *, sex: str | None, score: float | None) -> list[Flag]:
    """G8: a man typing over 95 mph with a score above 85 -> confirm ("Is that your driver
    speed?")."""
    if speed_mph is None or sex != "male" or score is None:
        return []
    if not (speed_mph > G8_SPEED_MPH and score > G8_SCORE):
        return []
    return [
        Flag(
            code="G8",
            severity="confirm",
            field="reported_7i_speed_mph",
            value=speed_mph,
            expected=f"7-iron speed; > {G8_SPEED_MPH:g} mph with a score above {G8_SCORE:g}",
            message_id="g8_driver_speed",
        )
    ]


def _carry_residual(carry_yd: float, speed_mph: float) -> tuple[float, float]:
    k, c = CARRY_SPEED_LINE
    line = k * speed_mph + c
    return carry_yd - line, line


def g9_ego_carry(carry_yd: float | None, speed_mph: float | None) -> list[Flag]:
    """G9 (profile only): self carry - (2.536 speed - 63.3) > +30 yd -> downweight (+ a light
    line). Never subtract the bias and call `swing_bucket_from_carry` with it (plan §3.3)."""
    if carry_yd is None or speed_mph is None:
        return []
    resid, line = _carry_residual(carry_yd, speed_mph)
    if resid <= G9_EGO_YD:
        return []
    return [
        Flag(
            code="G9",
            severity="downweight",
            field="reported_7i_carry_yd",
            value=carry_yd,
            expected=f"about {line:.0f} yd at {speed_mph:g} mph (+{resid:.0f})",
            message_id="g9_ego_carry",
        )
    ]


def g10_carry_short_for_speed(carry_yd: float | None, speed_mph: float | None) -> list[Flag]:
    """G10: self carry more than 35 yd short of the speed line -> confirm (metres? a driver
    speed?)."""
    if carry_yd is None or speed_mph is None:
        return []
    resid, line = _carry_residual(carry_yd, speed_mph)
    if resid >= G10_SHORT_YD:
        return []
    return [
        Flag(
            code="G10",
            severity="confirm",
            field="reported_7i_carry_yd",
            value=carry_yd,
            expected=f"about {line:.0f} yd at {speed_mph:g} mph ({resid:+.0f})",
            message_id="g10_carry_short_for_speed",
        )
    ]


def g12_buckets_disagree(
    *,
    self_bucket: int | None,
    measured_bucket: int | None,
    field: str,
    value: float | None,
    measured_speed_mph: float | None = None,
) -> list[Flag]:
    """G12: the swing bucket FIT would take from the self-report differs from the bucket FIT
    takes from the measured shots -> info; the why panel names the value used (the measured one).

    Both buckets come from the caller, computed by FIT's own mapping (bias-corrected typed speed,
    or FIT's carry -> speed estimate), so this rule agrees with what the fit used. Evidence never
    re-derives them (and never feeds a corrected carry to `swing_bucket_from_carry`)."""
    if self_bucket is None or measured_bucket is None or self_bucket == measured_bucket:
        return []
    speed = f" ({measured_speed_mph:.1f} mph)" if measured_speed_mph is not None else ""
    return [
        Flag(
            code="G12",
            severity="info",
            field=field,
            value=value,
            expected=f"bucket {self_bucket} vs measured bucket {measured_bucket}{speed}",
            message_id="g12_buckets_disagree",
            suggested_value=measured_bucket,
        )
    ]


def spec_key(spec: Spec) -> str:
    """G14's table key: head|flex|length|lie|grip (as `gen_thresholds.py` writes it)."""
    return f"{spec.head}|{spec.flex}|{spec.length_in:+.2f}|{spec.lie_deg:+d}|{spec.grip}"


def g14_rare_spec(spec: Spec | None) -> list[Flag]:
    """G14: the final spec's (head, flex, length, lie, grip) is under 0.1 % of train reference
    specs -> info + humour. The share is of **simulated** golfers; say so."""
    if spec is None or G14_N_SPECS <= 0:
        return []
    share = G14_SPEC_COUNTS.get(spec_key(spec), 0) / G14_N_SPECS
    if share >= G14_RARE_SHARE:
        return []
    return [
        Flag(
            code="G14",
            severity="info",
            field="spec",
            value=round(100 * share, 3),
            expected=f"% of {G14_N_SPECS} simulated golfers' reference specs",
            message_id="g14_rare_spec",
        )
    ]


def wave2_golfer_flags(values: Mapping[str, object], *, sex: str | None = None) -> list[Flag]:
    """The W2 profile rules G4-G10 (`session_flags.refresh`)."""
    height, w2f = _num(values, "height_cm"), _num(values, "wrist_to_floor_cm")
    height_ph, w2f_ph = _num(values, "height_photo_cm"), _num(values, "wrist_to_floor_photo_cm")
    hand = _num(values, "hand_length_photo_cm")
    speed, carry = _num(values, "reported_7i_speed_mph"), _num(values, "reported_7i_carry_yd")
    video_speed = _num(values, "clubhead_speed_video_mph")
    glove = values.get("glove")
    score = _score(values)

    out = g4_wrist_to_floor_vs_height(height, w2f)
    out += g4_wrist_to_floor_vs_height(height_ph, w2f_ph, field="wrist_to_floor_photo_cm")
    out += g5_hand_vs_height(hand, height_ph if height_ph is not None else height)
    out += g6_glove_vs_hand_photo(glove if isinstance(glove, str) else None, hand)
    if _in_g1("reported_7i_speed_mph", speed):
        out += g7_speed_vs_profile(speed, sex=sex, score=score, age=_num(values, "age"))
        out += g8_driver_speed(speed, sex=sex, score=score)
    profile_speed = speed if speed is not None else video_speed
    if _in_g1("reported_7i_carry_yd", carry) and _in_g1("reported_7i_speed_mph", profile_speed):
        out += g9_ego_carry(carry, profile_speed)
        out += g10_carry_short_for_speed(carry, profile_speed)
    return out


def wave2_fit_flags(
    values: Mapping[str, object],
    *,
    spec: Spec | None,
    self_bucket: int | None,
    measured_bucket: int | None,
    measured_speed_mph: float | None = None,
) -> list[Flag]:
    """The W2 rules that need the fit: G12 (FIT's buckets) and G14 (the current best spec).
    `session_flags.refresh_fit_flags` runs them after the rescore, so they see the new fit."""
    out: list[Flag] = []
    if settings.wave2:
        speed, carry = _num(values, "reported_7i_speed_mph"), _num(values, "reported_7i_carry_yd")
        if speed is not None:
            field, value = "reported_7i_speed_mph", speed
        else:
            field, value = "reported_7i_carry_yd", carry
        out += g12_buckets_disagree(
            self_bucket=self_bucket,
            measured_bucket=measured_bucket,
            field=field,
            value=value,
            measured_speed_mph=measured_speed_mph,
        )
    if settings.wave2 or settings.enable_g14:
        out += g14_rare_spec(spec)
    return out
