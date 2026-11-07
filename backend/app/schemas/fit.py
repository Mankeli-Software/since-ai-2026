"""Fit I/O models (plan §3.2, §3.5, §3.7). Owned by FIT after v0: additive changes only."""

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import (
    Bucket,
    Characteristic,
    Depth,
    Flex,
    FlightPref,
    Glove,
    GripSize,
    Handedness,
    HeadSlug,
    Material,
    Part,
    Provenance,
    Purchase,
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


# --- Catalog (plan §3.2, §7 `GET /api/catalog`) -------------------------------------------------


class HeadRatings(BaseModel):
    """Takomo's own relative 0-5 scales, not measured values."""

    distance: int
    forgiveness: int
    workability: int
    distance_control: int
    feel: int
    offset: int


class HeadProduct(BaseModel):
    slug: HeadSlug
    name: str
    description: str
    seven_iron_loft_deg: float
    seven_iron_offset_mm: float
    target_score_bucket: Bucket
    target_score_label: str
    ratings: HeadRatings
    stock_shafts: list[str] = Field(description="Shaft models (not slugs) sold as stock")
    default_shaft: str


class ShaftProduct(BaseModel):
    """One flex of one shaft model (each flex is its own record in the pack)."""

    slug: str
    model: str
    build: str | None = Field(default=None, description="MKII or 301 build, when it matters")
    manufacturer: str
    material: Material
    flex: Flex
    weight_g: float
    tempo_profile: list[str] | None = Field(default=None, description="None means any tempo")
    flight_profile: list[str]
    heads: list[HeadSlug]


class GripProduct(BaseModel):
    slug: GripSize
    name: str
    manufacturer: str


class CatalogResponse(BaseModel):
    heads: list[HeadProduct]
    shafts: list[ShaftProduct]
    grips: list[GripProduct]
    length_options_in: list[float]
    lie_options_deg: list[int]
    videos: dict[str, Any] = Field(
        default_factory=dict, description="fixtures/product_videos.json, keyed by head slug"
    )


class BuildCheck(BaseModel):
    """`check_buildable`: the official scorer's buildability rule, without pandas.

    An unbuildable spec scores 0. `purchase` is what the rules say the spec costs to buy
    (stock or custom, from `purchase_for`); it is None when the spec cannot be built."""

    buildable: bool
    reasons: list[str] = Field(default_factory=list)
    purchase: Purchase | None = None
