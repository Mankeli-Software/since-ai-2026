"""Shot primitives (a leaf module: no app imports).

`app.schemas.evidence` re-exports everything here, so import from there. This module exists only
to break the import cycle evidence -> state -> evidence (confirmed shots live on FittingState).
Owned by EVIDENCE: additive changes only.
"""

from typing import Literal

from pydantic import BaseModel, Field

# The pack's shots.csv session values, plus our own imports.
ShotSession = Literal["trackman_fitting", "home_radar", "import"]
# Pack shots.csv metric columns (same names and units: mph, yd, deg, rpm, mm).
ShotField = Literal[
    "club_speed_mph",
    "attack_angle_deg",
    "dynamic_loft_deg",
    "club_path_deg",
    "face_angle_deg",
    "face_to_path_deg",
    "ball_speed_mph",
    "smash_factor",
    "launch_angle_deg",
    "launch_direction_deg",
    "spin_rate_rpm",
    "spin_axis_deg",
    "carry_yd",
    "total_yd",
    "side_yd",
    "apex_yd",
    "landing_angle_deg",
    "impact_offset_mm",
    "impact_height_mm",
    "impact_toe_up_deg",
]


class Shot(BaseModel):
    """One shot in the pack's shots.csv schema. Empty cells stay None (home radars)."""

    session: ShotSession = "import"
    club: str = Field(description="own_7i | takomo_<head>_<shaft>_std")
    club_loft_deg: float | None = None
    shot_no: int
    club_speed_mph: float | None = None
    attack_angle_deg: float | None = None
    dynamic_loft_deg: float | None = None
    club_path_deg: float | None = None
    face_angle_deg: float | None = None
    face_to_path_deg: float | None = None
    ball_speed_mph: float | None = None
    smash_factor: float | None = None
    launch_angle_deg: float | None = None
    launch_direction_deg: float | None = None
    spin_rate_rpm: float | None = None
    spin_axis_deg: float | None = None
    carry_yd: float | None = None
    total_yd: float | None = None
    side_yd: float | None = None
    apex_yd: float | None = None
    landing_angle_deg: float | None = None
    impact_offset_mm: float | None = None
    impact_height_mm: float | None = None
    impact_toe_up_deg: float | None = None
