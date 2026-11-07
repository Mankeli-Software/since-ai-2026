"""Ball-line test parser (plan §3.3, §5.1, §5.2; issue #32). Pure: no I/O, no LLM.

Readings come from the ball-line test: a straight vertical line drawn on the ball leaves a mark
on the face. + = the line leans toward the toe (club delivers too upright), so lie_need = -mean.
The ball-line test is fused with the static chart in `mapping.py`, never overrides it.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.flags import Flag

MIN_READINGS = 3
MAX_READINGS = 10
HARD_BOUND_DEG = 15.0
SOFT_BOUND_DEG = 9.0
MAX_CONSISTENT_SD_DEG = 2.0
MAX_OPPOSITE_SIGN_SPREAD_DEG = 3.0


class BallLineEvidence(BaseModel):
    """Parsed ball-line test results and plausibility flags."""

    model_config = ConfigDict(frozen=True)

    readings_deg: list[float]
    mean_deg: float
    sd_deg: float
    n: int
    club: str = "own_7i"
    flags: list[Flag] = Field(default_factory=list)


def parse_ball_line(
    readings_deg: Sequence[float],
    *,
    club: str = "own_7i",
    prior_readings_deg: Sequence[float] = (),
    import_id: str | None = None,
) -> BallLineEvidence:
    """Parse, pool, validate, and check G15 on ball-line tilt readings.

    Pools prior readings with new readings, capped at 10.
    Requires at least 3 readings. Each reading must sit in [-15.0, 15.0] deg.
    Emits G15 downweight on high spread, and G15 confirm on reading outside ±9.0 deg.
    """
    pooled = [float(x) for x in prior_readings_deg] + [float(x) for x in readings_deg]
    pooled = pooled[:MAX_READINGS]

    if len(pooled) < MIN_READINGS:
        raise ValueError("ball-line test needs at least 3 readings")

    for r in pooled:
        if not math.isfinite(r) or r < -HARD_BOUND_DEG or r > HARD_BOUND_DEG:
            raise ValueError(
                f"ball-line reading {r:g} is outside "
                f"[{-HARD_BOUND_DEG:g}, {HARD_BOUND_DEG:g}] deg or not finite"
            )

    n = len(pooled)
    mean = statistics.fmean(pooled)
    sd = statistics.stdev(pooled) if n >= 2 else 0.0

    flags: list[Flag] = []

    has_pos = any(x > 0 for x in pooled)
    has_neg = any(x < 0 for x in pooled)
    spread = max(pooled) - min(pooled)

    high_spread = sd > MAX_CONSISTENT_SD_DEG
    opposite_signs = has_pos and has_neg and spread > MAX_OPPOSITE_SIGN_SPREAD_DEG
    if high_spread or opposite_signs:
        flags.append(
            Flag(
                code="G15",
                severity="downweight",
                field="ball_line_tilt_deg",
                value=round(sd, 2),
                expected="consistent tilt (sd <= 2.0 deg)",
                message_id="g15_ball_line_spread",
                import_id=import_id,
            )
        )

    for r in pooled:
        if abs(r) > SOFT_BOUND_DEG:
            flags.append(
                Flag(
                    code="G15",
                    severity="confirm",
                    field="ball_line_tilt_deg",
                    value=round(r, 2),
                    expected=f"reading within ±{SOFT_BOUND_DEG:g} deg",
                    message_id="g15_ball_line_extreme",
                    import_id=import_id,
                )
            )
            break

    return BallLineEvidence(
        readings_deg=pooled,
        mean_deg=round(mean, 2),
        sd_deg=round(sd, 2),
        n=n,
        club=club,
        flags=flags,
    )
