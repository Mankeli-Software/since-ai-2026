"""Evidence I/O models (plan §5). Owned by EVIDENCE after v0: additive changes only."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.flags import Flag, FlagCode, FlagSeverity
from app.schemas.state import FittingState

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
ImportKind = Literal["trackman_csv", "ball_line", "manual", "screenshot", "round_stats"]
ImportStatus = Literal["pending", "confirmed", "discarded"]


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


class ShotQualityReport(BaseModel):
    """Per-import quality summary; `quality` scales the launch-monitor weight (plan §5.3)."""

    n_shots: int = 0
    n_used: int = 0
    n_rejected: int = 0
    n_mishits: int = 0
    quality: float = Field(default=0.0, ge=0, le=1)
    flags: list[Flag] = Field(default_factory=list)
    summary: dict[str, float] = Field(
        default_factory=dict, description="Numeric means, e.g. club_speed_mph, carry_yd"
    )


class ImportReport(BaseModel):
    import_id: str
    kind: ImportKind
    club: str | None = None
    shots: list[Shot] = Field(default_factory=list)
    report: ShotQualityReport = Field(default_factory=ShotQualityReport)
    status: ImportStatus = "pending"
    state: FittingState | None = None


class Cell(BaseModel):
    """One cell read by vision. Every field required; an unreadable cell is absent (§5.1)."""

    row: int
    field: ShotField
    literal: str
    value: float
    confidence: float


class ExtractedSession(BaseModel):
    """Flat vision output schema (kept flat for structured-output limits, §5.1)."""

    monitor: str
    unit_labels_seen: list[str]
    headers_read: list[str]
    cells: list[Cell]


__all__ = [
    "Cell",
    "ExtractedSession",
    "Flag",
    "FlagCode",
    "FlagSeverity",
    "ImportKind",
    "ImportReport",
    "ImportStatus",
    "Shot",
    "ShotField",
    "ShotQualityReport",
    "ShotSession",
]
