"""G15: ball-line readings (plan §5.2, v3.1; issue #31). Pure: readings in, flags out.

Train range is -9.9 to +10.2 deg, p0.1-p99.9 is -8.7 to +7.3 deg, and the within-golfer SD is
1.6 deg median and 3.45 deg p99. Sign: + = the line leans toward the toe. Copy says "readings",
never "shots". The flags' `field` is `ball_line_tilt_deg` (`FitEvidence`), `shot_index` the reading.
"""

from __future__ import annotations

import statistics
from collections.abc import Sequence

from app.schemas.evidence import Flag

G15_REJECT_DEG = 15.0
G15_CONFIRM_DEG = 9.0
G15_MAX_SD_DEG = 3.5
G15_MIN_READINGS = 3
FIELD = "ball_line_tilt_deg"


def g15_ball_line(readings_deg: Sequence[float], *, import_id: str | None = None) -> list[Flag]:
    """Reject a reading with |x| > 15 deg, confirm one outside +-9 deg, confirm an SD > 3.5 deg
    across readings; fewer than 3 readings is low confidence (info)."""
    out: list[Flag] = []
    for i, x in enumerate(readings_deg):
        if abs(x) > G15_REJECT_DEG:
            sev, exp, msg = "reject", f"within +-{G15_REJECT_DEG:g}", "g15_reading_out_of_range"
        elif abs(x) > G15_CONFIRM_DEG:
            sev, exp, msg = "confirm", f"usually within +-{G15_CONFIRM_DEG:g}", "g15_check_sign"
        else:
            continue
        out.append(
            Flag(
                code="G15",
                severity=sev,  # type: ignore[arg-type]
                field=FIELD,
                value=x,
                expected=exp,
                shot_index=i,
                message_id=msg,
                import_id=import_id,
            )
        )
    kept = [x for x in readings_deg if abs(x) <= G15_REJECT_DEG]
    if len(kept) >= 2 and (sd := statistics.stdev(kept)) > G15_MAX_SD_DEG:
        out.append(
            Flag(
                code="G15",
                severity="confirm",
                field=FIELD,
                value=round(sd, 2),
                expected=f"readings SD <= {G15_MAX_SD_DEG:g}",
                message_id="g15_readings_spread",
                import_id=import_id,
            )
        )
    if len(kept) < G15_MIN_READINGS:
        out.append(
            Flag(
                code="G15",
                severity="info",
                field=FIELD,
                value=len(kept),
                expected=f">= {G15_MIN_READINGS} readings",
                message_id="g15_few_readings",
                import_id=import_id,
            )
        )
    return out
