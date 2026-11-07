"""Screenshot import shapes (plan §3.8 `POST /imports/screenshot`, §5.1, #15/#19). Additive only.

A separate module from `evidence.py` so the vision work (AGENT) and the pure evidence work
(EVIDENCE) never edit the same file. `ExtractedSession` / `Cell` stay in `evidence.py`.
"""

from typing import Literal, Protocol

from pydantic import BaseModel, Field

from app.schemas.evidence import ExtractedSession
from app.schemas.flags import Flag

ScreenshotKind = Literal["launch_monitor", "round_stats"]
ExtractionSource = Literal["vision", "fixture"]
# low_confidence = V4's confidence check; plausibility = any other rule from validate_extraction.
FlaggedReason = Literal["low_confidence", "plausibility"]


class RoundStatsRead(BaseModel):
    """Flat vision output for a round-stats screen (Golf GameBook, 18Birdies; plan §5.4).
    Every field required for structured output; unreadable numbers are null."""

    app: str
    avg_score: float | None
    n_rounds: int | None
    period: str
    confidence: float


class ReviewCell(BaseModel):
    """One value in the "this is what we read" table (V6)."""

    field: str = Field(description="ShotField for launch_monitor; avg_score | n_rounds otherwise")
    literal: str = Field(description="Characters read from the image, capped ^[\\w %./°-]{0,32}$")
    value: float | None
    confidence: float = Field(ge=0, le=1)
    flagged: bool = False


class ReviewRow(BaseModel):
    row: int
    cells: list[ReviewCell] = Field(default_factory=list)


class FlaggedCell(BaseModel):
    row: int
    field: str
    reason: FlaggedReason = "low_confidence"
    confidence: float | None = None
    code: str | None = Field(default=None, description="FlagCode when reason=plausibility")
    message_id: str | None = Field(default=None, description="Copy key of the deciding flag")
    suggested_value: float | str | None = None


class ExtractionReview(BaseModel):
    """`POST /api/sessions/{id}/imports/screenshot` response. Nothing is used until the golfer
    confirms (`/imports/{import_id}/confirm`, EVIDENCE)."""

    import_id: str
    rows: list[ReviewRow] = Field(default_factory=list)
    flagged_cells: list[FlaggedCell] = Field(default_factory=list)
    status: Literal["pending"] = "pending"
    kind: ScreenshotKind = "launch_monitor"
    source: ExtractionSource = "vision"
    synthetic: bool = Field(default=False, description="True for scripted-mode fixture data")
    monitor: str = ""
    columns: list[str] = Field(default_factory=list, description="Table column order (fields)")
    unit_labels_seen: list[str] = Field(default_factory=list)
    headers_read: list[str] = Field(default_factory=list)
    round_stats: RoundStatsRead | None = None
    flags: list[Flag] = Field(
        default_factory=list,
        description="Every deterministic flag (V1-V5, S rules), incl. table-level V2 units",
    )


class RoundStatsExtractor(Protocol):
    """Round-stats screenshots (agent/extract.py). `Extractor.extract` covers launch monitors."""

    async def extract_round_stats(self, image: bytes) -> RoundStatsRead: ...


__all__ = [
    "ExtractedSession",
    "ExtractionReview",
    "ExtractionSource",
    "FlaggedCell",
    "FlaggedReason",
    "ReviewCell",
    "ReviewRow",
    "RoundStatsExtractor",
    "RoundStatsRead",
    "ScreenshotKind",
]
