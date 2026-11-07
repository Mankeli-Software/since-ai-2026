"""Evidence I/O models (plan §5). Owned by EVIDENCE after v0: additive changes only."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.flags import Flag, FlagCode, FlagSeverity
from app.schemas.shots import Shot, ShotField, ShotSession
from app.schemas.state import FittingState

ImportKind = Literal["trackman_csv", "ball_line", "manual", "screenshot", "round_stats"]
ImportStatus = Literal["pending", "confirmed", "discarded"]


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
    clubs: dict[str, int] = Field(
        default_factory=dict,
        description="Shots per club slug (a CSV `Club` column can carry several)",
    )
    dropped_clubs: dict[str, int] = Field(
        default_factory=dict,
        description="Rows left out because their `Club` value is not a 7-iron (label capped)",
    )
    vendor: str | None = Field(default=None, description="Header alias set that matched")
    units_seen: list[str] = Field(default_factory=list, description="Units row, as read (capped)")
    dynamic_lie_absolute: bool = Field(
        default=False,
        description="Dynamic Lie was absolute (45-80 deg) and was converted to toe-up vs club lie",
    )


class FlagsReport(BaseModel):
    """The session's golfer-level flags after a recheck, and what is still pending (#31)."""

    flags: list[Flag] = Field(default_factory=list)
    pending_flags: list[Flag] = Field(default_factory=list)
    state: FittingState | None = None


ResolveAction = Literal["keep", "exclude", "confirm_value"]


class ResolveFlagsRequest(BaseModel):
    """The golfer's answer to an `outlier_review` (#31): what to do with the pending flags of
    `codes` (all pending flags when empty), optionally only those of one import."""

    action: ResolveAction
    codes: list[FlagCode] = Field(default_factory=list)
    import_id: str | None = Field(default=None, max_length=64)


class ResolveFlagsResponse(BaseModel):
    resolved: list[Flag] = Field(default_factory=list, description="The flags this answer closed")
    changed_fields: list[str] = Field(
        default_factory=list, description="Profile fields set or cleared by the answer"
    )
    shots_removed: int = 0
    shots_converted: int = 0
    pending_flags: list[Flag] = Field(default_factory=list)
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
    "FlagsReport",
    "ImportKind",
    "ImportReport",
    "ImportStatus",
    "ResolveAction",
    "ResolveFlagsRequest",
    "ResolveFlagsResponse",
    "Shot",
    "ShotField",
    "ShotQualityReport",
    "ShotSession",
]
