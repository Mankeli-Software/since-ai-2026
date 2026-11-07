"""Manual values parser and unit guesser (plan §5.1, §5.2 G1/G2; issue #32). Pure: no I/O, no LLM.

Parses typed values from chat, sliders or forms. Converts units to standard internal units
(cm, yd, mph, deg). Guesses omitted or suspect units (G2), then checks plausible human bounds (G1).
G2 runs before G1 (evidence/CLAUDE.md).
"""

from __future__ import annotations

import math
import re
from typing import Any

from app.schemas.flags import Flag

# Plan §5.2 G1 hard human bounds.
G1_BOUNDS: dict[str, tuple[float, float]] = {
    "height_cm": (120.0, 230.0),
    "wrist_to_floor_cm": (55.0, 115.0),
    "hand_length_photo_cm": (13.0, 25.0),
    "reported_7i_speed_mph": (30.0, 115.0),
    "reported_7i_carry_yd": (20.0, 230.0),
    "own_7i_loft_deg": (20.0, 45.0),
}

TARGET_UNITS: dict[str, str] = {
    "height_cm": "cm",
    "wrist_to_floor_cm": "cm",
    "hand_length_photo_cm": "cm",
    "reported_7i_speed_mph": "mph",
    "reported_7i_carry_yd": "yd",
    "own_7i_loft_deg": "deg",
}

_FT_IN_REGEX = re.compile(r"^(\d{1})['’\sft]+(\d{1,2})(?:[\"”\sin]*)?$")
_FEET_DOT_INCHES = re.compile(r"^([456])\.(\d{1,2})$")


def _to_float(raw: Any) -> float:
    if isinstance(raw, int | float):
        return float(raw)
    if isinstance(raw, str):
        cleaned = raw.strip().replace(",", ".")
        return float(cleaned)
    raise ValueError(f"cannot convert {raw!r} to float")


def parse_manual_value(
    field: str,
    raw: float | int | str,
    unit: str | None = None,
) -> tuple[float, str, list[Flag]]:
    """Parse a typed manual value with unit guessing (G2) and human bounds check (G1).

    Returns:
        (converted_value, resolved_unit, flags)
    """
    flags: list[Flag] = []
    target_unit = TARGET_UNITS.get(field, unit or "")

    # Check for string patterns such as 5'11" or 5.11 for height
    if field == "height_cm" and isinstance(raw, str):
        s = raw.strip()
        m_ft = _FT_IN_REGEX.match(s)
        if m_ft:
            ft = int(m_ft.group(1))
            inches = int(m_ft.group(2))
            total_in = ft * 12 + inches
            converted = round(total_in * 2.54, 1)
            flags.append(
                Flag(
                    code="G2",
                    severity="confirm",
                    field=field,
                    value=s,
                    expected="cm (120-230 cm)",
                    suggested_value=converted,
                    message_id="g2_height_feet_inches",
                )
            )
            return converted, "cm", flags
        m_dot = _FEET_DOT_INCHES.match(s)
        if m_dot:
            ft = int(m_dot.group(1))
            inches = int(m_dot.group(2))
            if inches < 12:
                total_in = ft * 12 + inches
                converted = round(total_in * 2.54, 1)
                flags.append(
                    Flag(
                        code="G2",
                        severity="confirm",
                        field=field,
                        value=s,
                        expected=f"{ft} ft {inches} in ({converted:g} cm)",
                        suggested_value=converted,
                        message_id="g2_height_dot_inches",
                    )
                )
                return converted, "cm", flags

    val = _to_float(raw)
    if not math.isfinite(val):
        raise ValueError(f"{field}: non-finite value {val}")

    norm_unit = unit.lower().strip() if unit else None
    converted = val

    if field == "height_cm":
        if norm_unit in ("in", "inch", "inches") or (norm_unit is None and 50.0 <= val <= 85.0):
            converted = round(val * 2.54, 1)
            flags.append(
                Flag(
                    code="G2",
                    severity="confirm",
                    field=field,
                    value=val,
                    expected="cm (120-230 cm)",
                    suggested_value=converted,
                    message_id="g2_height_inches",
                )
            )
            target_unit = "cm"
        elif norm_unit in ("m", "meter", "meters", "metres") or (norm_unit is None and val < 3.0):
            converted = round(val * 100.0, 1)
            target_unit = "cm"
        else:
            converted = round(val, 1)
            target_unit = "cm"

    elif field == "wrist_to_floor_cm":
        if norm_unit in ("in", "inch", "inches") or (norm_unit is None and 20.0 <= val <= 48.0):
            converted = round(val * 2.54, 1)
            flags.append(
                Flag(
                    code="G2",
                    severity="confirm",
                    field=field,
                    value=val,
                    expected="cm (55-115 cm)",
                    suggested_value=converted,
                    message_id="g2_wrist_to_floor_inches",
                )
            )
            target_unit = "cm"
        elif norm_unit in ("m", "meter", "meters", "metres") or (norm_unit is None and val < 1.5):
            converted = round(val * 100.0, 1)
            target_unit = "cm"
        else:
            converted = round(val, 1)
            target_unit = "cm"

    elif field == "hand_length_photo_cm":
        if norm_unit in ("mm", "millimeter", "millimeters") or (norm_unit is None and val >= 100.0):
            converted = round(val * 0.1, 1)
            target_unit = "cm"
        elif norm_unit in ("in", "inch", "inches") or (norm_unit is None and 4.0 <= val <= 10.0):
            converted = round(val * 2.54, 1)
            flags.append(
                Flag(
                    code="G2",
                    severity="confirm",
                    field=field,
                    value=val,
                    expected="cm (13-25 cm)",
                    suggested_value=converted,
                    message_id="g2_hand_inches",
                )
            )
            target_unit = "cm"
        else:
            converted = round(val, 1)
            target_unit = "cm"

    elif field == "reported_7i_carry_yd":
        if norm_unit in ("m", "meter", "meters", "metres"):
            converted = round(val * 1.0936133, 1)
            target_unit = "yd"
        else:
            converted = round(val, 1)
            target_unit = "yd"

    elif field == "reported_7i_speed_mph":
        if norm_unit in ("km/h", "kph", "kmh") or (norm_unit is None and 120.0 <= val <= 200.0):
            converted = round(val * 0.6213712, 1)
            if norm_unit is None:
                flags.append(
                    Flag(
                        code="G2",
                        severity="confirm",
                        field=field,
                        value=val,
                        expected="mph (30-115 mph)",
                        suggested_value=converted,
                        message_id="g2_speed_kmh",
                    )
                )
            target_unit = "mph"
        elif norm_unit in ("m/s", "ms") or (
            norm_unit is None and 15.0 <= val <= 52.0 and val < 30.0
        ):
            converted = round(val * 2.23694, 1)
            if norm_unit is None:
                flags.append(
                    Flag(
                        code="G2",
                        severity="confirm",
                        field=field,
                        value=val,
                        expected="mph (30-115 mph)",
                        suggested_value=converted,
                        message_id="g2_speed_ms",
                    )
                )
            target_unit = "mph"
        else:
            converted = round(val, 1)
            target_unit = "mph"

    elif field == "own_7i_loft_deg":
        converted = round(val, 1)
        target_unit = "deg"

    # G1 plausible human bounds (checked after G2 unit conversion)
    if field in G1_BOUNDS:
        lo, hi = G1_BOUNDS[field]
        if converted < lo or converted > hi:
            flags.append(
                Flag(
                    code="G1",
                    severity="reject",
                    field=field,
                    value=converted,
                    expected=f"within {lo:g}-{hi:g} {target_unit}",
                    message_id=f"g1_{field}_out_of_bounds",
                )
            )

    return converted, target_unit, flags
