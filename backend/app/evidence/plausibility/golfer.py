"""v1 golfer-level rules G1, G2, G3, G11 (carry) (plan §5.2; issue #31). Pure.

Values are profile fields (`IntakeAnswers` / `PhoneMeasurements` names), so every flag's `field` is
that name and FIT's `mapping._flag_factor` applies the σ effect directly: reject drops the source,
downweight doubles σ, an unresolved confirm triples it.

**G2 runs before G1.** A value outside the soft range that lands inside it after a unit conversion
("71" for height -> 71 in = 180 cm) gets one G2 confirm with the converted value as
`suggested_value`, and G1 / G3 are skipped for it. Otherwise G1 rejects values outside the hard
human bounds, and G3 asks about rare-but-possible values, by sex.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Callable, Mapping, Sequence

from app.schemas.evidence import Flag, Shot

# G1 hard human bounds (plan §5.2). Field -> kind.
KIND: dict[str, str] = {
    "height_cm": "height",
    "height_photo_cm": "height",
    "wrist_to_floor_cm": "wtf",
    "wrist_to_floor_photo_cm": "wtf",
    "hand_length_photo_cm": "hand",
    "reported_7i_speed_mph": "speed",
    "clubhead_speed_video_mph": "speed",
    "reported_7i_carry_yd": "carry",
    "round_avg_score": "score",
    "age": "age",
}
G1_BOUNDS: dict[str, tuple[float, float]] = {
    "height": (120.0, 230.0),
    "wtf": (55.0, 115.0),
    "hand": (13.0, 25.0),
    "speed": (30.0, 115.0),
    "carry": (20.0, 230.0),
    "score": (55.0, 160.0),
    "age": (8.0, 100.0),
}
# G3 rare-value ranges by sex (plan §5.2); unknown sex uses the union.
G3_SOFT: dict[str, dict[str, tuple[float, float]]] = {
    "male": {"height": (157, 200), "wtf": (76, 101), "hand": (16.5, 22.2), "speed": (52, 98)},
    "female": {"height": (147, 186), "wtf": (71, 94), "hand": (15.4, 20.9), "speed": (42, 77)},
}
_M, _F = G3_SOFT["male"], G3_SOFT["female"]
G3_SOFT[""] = {k: (min(_M[k][0], _F[k][0]), max(_M[k][1], _F[k][1])) for k in _M}


def _ft_in(x: float) -> float | None:
    """'5.11' -> 5 ft 11 in -> cm. Only for 4-7 ft with 0-11 inches after the point."""
    feet, _, frac = f"{x:g}".partition(".")
    if not frac or not 4 <= int(feet) <= 7:
        return None
    inches = int(frac)
    return (int(feet) * 12 + inches) * 2.54 if inches <= 11 else None


Conversion = tuple[str, Callable[[float], float | None]]
# G2 conversions tried in order (plan §5.2): in x2.54, m x100, mm x0.1, ft x30.48; km/h / 1.609;
# m/s x2.237. "5.11" -> "5 ft 11?" is tried first for heights.
G2_CONVERSIONS: dict[str, tuple[Conversion, ...]] = {
    "height": (
        ("ft_in", _ft_in),
        ("in", lambda x: x * 2.54),
        ("m", lambda x: x * 100),
        ("mm", lambda x: x * 0.1),
        ("ft", lambda x: x * 30.48),
    ),
    "wtf": (("in", lambda x: x * 2.54), ("m", lambda x: x * 100), ("mm", lambda x: x * 0.1)),
    "hand": (("in", lambda x: x * 2.54), ("mm", lambda x: x * 0.1)),
    "speed": (("km/h", lambda x: x / 1.609), ("m/s", lambda x: x * 2.237)),
}

# G11 (plan §5.2): |self - measured| / sqrt(σs² + σm²) > 2.5.
G11_Z = 2.5
# σ of a self-reported carry: the v1 carry->speed σ (5 mph, mapping.carry_speed_sd_mph) times the
# speed->carry slope 2.536. A placeholder until gen_priors.py measures it on train (#33).
G11_SELF_CARRY_SD_YD = 5.0 * 2.536
G11_MIN_SHOT_SD_YD = 5.0  # floor on the shot spread, like the 2 mph floor for speed


def _soft(kind: str, sex: str | None) -> tuple[float, float] | None:
    return G3_SOFT.get(sex or "", G3_SOFT[""]).get(kind)


def g2_unit_confusion(field: str, value: float, sex: str | None = None) -> list[Flag]:
    """G2: a value no human has in this unit, but typical after a unit conversion -> confirm.

    Tried only when the value is outside the G1 hard bounds or outside the soft range of both
    sexes: a fast woman's 82 mph is a G3 question, not a km/h mix-up."""
    kind = KIND.get(field)
    soft = _soft(kind, sex) if kind else None
    either = _soft(kind, None) if kind else None
    if soft is None or either is None or kind is None:
        return []
    lo, hi = G1_BOUNDS[kind]
    if lo <= value <= hi and either[0] <= value <= either[1]:
        return []
    for unit, convert in G2_CONVERSIONS.get(kind, ()):  # type: ignore[arg-type]
        y = convert(value)
        if y is not None and soft[0] <= y <= soft[1]:
            return [
                Flag(
                    code="G2",
                    severity="confirm",
                    field=field,
                    value=value,
                    expected=f"{value:g} {unit} = {y:.0f}",
                    message_id=f"g2_unit_{unit.replace('/', '_')}",
                    suggested_value=round(y, 1),
                )
            ]
    return []


def g1_human_bounds(field: str, value: float) -> list[Flag]:
    """G1: outside the hard human bounds -> reject (the source is dropped)."""
    kind = KIND.get(field)
    if kind is None:
        return []
    lo, hi = G1_BOUNDS[kind]
    if lo <= value <= hi:
        return []
    return [
        Flag(
            code="G1",
            severity="reject",
            field=field,
            value=value,
            expected=f"{lo:g} to {hi:g}",
            message_id="g1_out_of_bounds",
        )
    ]


def g3_rare_value(field: str, value: float, sex: str | None = None) -> list[Flag]:
    """G3: possible but rare for this sex -> confirm (the assistant may add a light line, #17)."""
    kind = KIND.get(field)
    soft = _soft(kind, sex) if kind else None
    if soft is None or soft[0] <= value <= soft[1]:
        return []
    return [
        Flag(
            code="G3",
            severity="confirm",
            field=field,
            value=value,
            expected=f"usually {soft[0]:g} to {soft[1]:g}",
            message_id=f"g3_rare_{kind}",
        )
    ]


def g11_carry_self_vs_measured(
    self_carry_yd: float | None, shots: Sequence[Shot], *, import_id: str | None = None
) -> list[Flag]:
    """G11 (carry): self-reported carry vs the mean of measured own-7-iron carries. Pass usable
    (non-rejected) shots; S8 mishits stay in, as for every mean carry."""
    carries = [s.carry_yd for s in shots if s.club == "own_7i" and s.carry_yd is not None]
    if self_carry_yd is None or not carries:
        return []
    n = len(carries)
    mean = statistics.fmean(carries)
    spread = statistics.stdev(carries) if n > 1 else 0.0
    sd_measured = max(spread, G11_MIN_SHOT_SD_YD) / math.sqrt(n)
    z = (self_carry_yd - mean) / math.hypot(G11_SELF_CARRY_SD_YD, sd_measured)
    if abs(z) <= G11_Z:
        return []
    return [
        Flag(
            code="G11",
            severity="confirm",
            field="reported_7i_carry_yd",
            value=self_carry_yd,
            expected=f"measured {mean:.1f} yd over {n} shots (z {z:+.1f})",
            message_id="g11_carry_self_vs_measured",
            suggested_value=round(mean, 1),
            import_id=import_id,
        )
    ]


def check_profile(values: Mapping[str, object], sex: str | None = None) -> list[Flag]:
    """G2, then G1, then G3 on every numeric profile value this module knows. Pure."""
    out: list[Flag] = []
    for field in sorted(values):
        v = values[field]
        if field not in KIND or isinstance(v, bool) or not isinstance(v, int | float):
            continue
        x = float(v)
        if not math.isfinite(x):
            continue
        g2 = g2_unit_confusion(field, x, sex)
        if g2:
            out += g2
            continue
        g1 = g1_human_bounds(field, x)
        out += g1 or g3_rare_value(field, x, sex)
    return out


def golfer_flags(
    values: Mapping[str, object], shots: Sequence[Shot], *, sex: str | None = None
) -> list[Flag]:
    """Every v1 golfer rule on a profile plus its usable confirmed shots."""
    carry = values.get("reported_7i_carry_yd")
    self_carry = (
        float(carry) if isinstance(carry, int | float) and not isinstance(carry, bool) else None
    )
    return check_profile(values, sex) + g11_carry_self_vs_measured(self_carry, shots)
