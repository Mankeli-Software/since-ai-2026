"""One home for the plausibility thresholds (plan §5.2; issues #31, #33, #34).

Two kinds of number live here:

- **Rule definitions** (S1 hard bounds, the S3 / S6 / S13 checksum tolerances, the S5 / S11 bands):
  plain constants, the same for every dataset.
- **Train statistics** (S2 rare-value percentiles, the no-spin carry fits, the G4 / G5 body lines,
  the G9 ego-carry percentile, the G14 spec frequencies): read once at import from the checked-in
  `evidence/thresholds.json`, written by `scripts/gen_thresholds.py` from the train split.
  The defaults below are the plan's figures, so the rules still work if the file is missing.

Reading a checked-in file at import is the only I/O here; every rule stays a pure function.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

THRESHOLDS_PATH = Path(__file__).resolve().parent.parent / "thresholds.json"


def _load() -> dict[str, Any]:
    try:
        return json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


TRAIN: dict[str, Any] = _load()

# --------------------------------------------------------------------------- rule definitions

# S1 hard 7-iron bounds (plan §5.2): reject. V4 applies them to single screenshot cells.
S1_BOUNDS: dict[str, tuple[float, float]] = {
    "club_speed_mph": (25.0, 115.0),
    "ball_speed_mph": (20.0, 150.0),
    "smash_factor": (0.5, 1.53),
    "launch_angle_deg": (2.0, 40.0),
    "spin_rate_rpm": (1000.0, 13000.0),
    "carry_yd": (5.0, 230.0),
    "apex_yd": (0.5, 55.0),
    "landing_angle_deg": (5.0, 65.0),
    "impact_offset_mm": (-75.0, 75.0),
    "impact_height_mm": (-40.0, 40.0),
    "impact_toe_up_deg": (-12.0, 12.0),
}
S3_SMASH_TOL = 0.02  # |smash - ball/club| > 0.02: reject (a digit was misread)
S6_TOTAL_BELOW_CARRY_YD = 3.0  # total < carry - 3 yd: confirm (columns swapped?)
S13_F2P_TOL_DEG = 0.2  # |f2p - (face - path)| > 0.2: reject that field
# Rejects that drop one field, not the shot (`fuse.usable_shots` blanks the field instead).
FIELD_ONLY_REJECTS = frozenset({"S13"})
# RMSE of `shots.CARRY_FIT` (ball, launch, spin) on train TrackMan shots, as #31 measured it.
CARRY_FIT_RMSE_YD = 2.3

# S5 carry vs flight: confirm above max(12 yd, 8 %) x tol, reject above max(25 yd, 18 %) x tol,
# and never inside 3 / 5 RMSE of the carry predictor used (the club-speed-only fit is loose).
S5_CONFIRM = (12.0, 0.08)
S5_REJECT = (25.0, 0.18)
S5_CONFIRM_SIGMA = 3.0
S5_REJECT_SIGMA = 5.0
# Device tolerance (S5, S11, S17): 1.0 for TrackMan / GCQuad / vision, 1.6 for a home radar.
TOL_PRECISE = 1.0
TOL_RADAR = 1.6
# Known home radars (plan §5.2 S17), matched lower-case with spaces and dashes removed. Anything
# else (TrackMan, GCQuad, a vision read, no name) counts as precise.
RADAR_MONITORS = ("garmin", "approachr10", "r10", "r50", "shotscope", "lm1", "rapsodo", "mevo")
# S9: robust z of carry or smash within the session above +3.5: confirm.
S9_Z = 3.5
# S11: median carry / predicted carry outside 0.87-1.12: confirm (wrong column or unit). The band
# widens by the device tolerance: 1 - 0.13 tol .. 1 + 0.12 tol.
S11_BAND = (0.87, 1.12)
# A carry predictor with an RMSE above this (the club-speed-only fit) is loose: S5 only confirms
# with it (never rejects) and S11 does not ask about metres with it.
TIGHT_FIT_RMSE_YD = 6.0

# --------------------------------------------------------------------------- train statistics

# S2: outside the train p0.1-p99.9 -> confirm. Smash has only an upper edge: low smash is S8's.
S2_RARE: dict[str, tuple[float | None, float | None]] = {
    k: (None if v[0] is None else float(v[0]), None if v[1] is None else float(v[1]))
    for k, v in TRAIN.get(
        "s2_rare",
        {
            "club_speed_mph": [43.0, 98.0],
            "smash_factor": [None, 1.45],
            "spin_rate_rpm": [2900.0, 10500.0],
            "carry_yd": [30.0, 193.0],
        },
    ).items()
}

# Carry predicted from what the radar did read, when there is no spin (S5, S11). Least squares on
# train shots; terms are named so the json carries its own design: see `predict_carry_no_spin`.
CARRY_FITS_NO_SPIN: list[dict[str, Any]] = TRAIN.get("carry_fits_no_spin", [])

# G4: wrist-to-floor vs height, |w2f - (a h + b)| > 9 cm. G5: |hand - k h| > 2.3 cm.
G4_LINE: tuple[float, float] = tuple(TRAIN.get("g4_w2f_line", [0.4855, 2.0]))  # type: ignore[assignment]
G4_TOL_CM = 9.0
G5_SLOPE: float = float(TRAIN.get("g5_hand_slope", 0.108))
G5_TOL_CM = 2.3
# G9 / G10: self carry - (2.536 speed - 63.3). +30 yd is about p90 of the train residual.
CARRY_SPEED_LINE = (2.536, -63.3)
G9_EGO_YD: float = float(TRAIN.get("g9_ego_carry_yd", 30.0))
G10_SHORT_YD: float = float(TRAIN.get("g10_short_carry_yd", -35.0))
# G14: share of train reference specs with this (head, flex, length, lie, grip).
G14_RARE_SHARE = 0.001
G14_SPEC_COUNTS: dict[str, int] = {k: int(v) for k, v in TRAIN.get("g14_spec_counts", {}).items()}
G14_N_SPECS: int = int(TRAIN.get("g14_n_specs", 0))
