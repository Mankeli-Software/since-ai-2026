"""Fit I/O models (plan §3.2, §3.5, §3.7). Owned by FIT after v0: additive changes only."""

from pydantic import BaseModel, Field

from app.schemas.common import (
    Bucket,
    Characteristic,
    Depth,
    FlightPref,
    Glove,
    Handedness,
    HeadSlug,
    Part,
    Provenance,
    Sex,
    Spec,
    SpecValue,
    Tempo,
)


class MappedAnswers(BaseModel):
    """Validated inputs for takomo_fit.baseline.Answers (Literals guard the pack's KeyErrors)."""

    age: int = Field(ge=8, le=100)
    sex: Sex
    score_bucket: Bucket
    swing_bucket: Bucket
    characteristics: list[Characteristic] = Field(default_factory=list, max_length=3)
    flight: FlightPref
    tempo: Tempo
    height_cm: float
    wrist_to_floor_cm: float
    glove: Glove
    handedness: Handedness = "right"
    rounds_per_year: str | None = None
    provenance: dict[str, Provenance] = Field(default_factory=dict)


class Cutoff(BaseModel):
    name: str
    value: float
    distance: float
    sigma: float | None = None


class CloseCall(BaseModel):
    part: Part
    ours: SpecValue
    alt: SpecValue | None = None
    share: float = Field(ge=0, le=1)
    nearest_cutoff: Cutoff | None = None
    next_step: str | None = None


class WhyItem(BaseModel):
    """One explanation line from the pack's `.trace`. Numbers come from tools, never the LLM."""

    part: Part
    plain: str
    numbers: dict[str, float] = Field(default_factory=dict)
    sources: list[Provenance] = Field(default_factory=list)
    close_call: CloseCall | None = None
    depth_hint: Depth = "standard"


class Recommendation(Spec):
    """A ranked spec with the pack's scoring detail."""

    rank: int
    head_score: float
    score_parts: dict[str, float] = Field(default_factory=dict)
    trace: list[str] = Field(default_factory=list)


class HeadScore(BaseModel):
    head: HeadSlug
    total: float
    parts: dict[str, float] = Field(default_factory=dict)


class FitResult(BaseModel):
    recs: list[Recommendation] = Field(default_factory=list)
    ranking: list[HeadScore] = Field(default_factory=list)
    why: list[WhyItem] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    close_calls: list[CloseCall] = Field(default_factory=list)
