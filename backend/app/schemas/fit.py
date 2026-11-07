"""Fit I/O models (plan §3.2, §3.5, §3.7). Owned by FIT after v0: additive changes only."""

from typing import Any, Literal

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
from app.schemas.evidence import Flag, Shot


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
    lie_override_deg: float | None = Field(
        default=None,
        description="Continuous lie need from evidence (test-club shots, or ball-line / own-7i "
        "Dynamic Lie fused with the chart). None = the static chart decides.",
    )
    est_7i_speed_mph: float | None = Field(
        default=None, description="The 7-iron club speed behind swing_bucket, when one is known"
    )
    est_hand_length_cm: float | None = None


class IntakeAnswers(BaseModel):
    """What the golfer told us (conversation, form or questionnaire.csv). All optional: the
    conversation fills it in over time; `fitting.mapping.missing_inputs` lists what is still
    needed before a fit can run."""

    age: int | None = Field(default=None, ge=8, le=100)
    sex: Sex | None = None
    handedness: Handedness | None = None
    rounds_per_year: str | None = None
    score_bucket: Bucket | None = None
    reported_7i_speed_mph: float | None = None
    reported_7i_carry_yd: float | None = None
    characteristics: list[Characteristic] = Field(default_factory=list)
    flight: FlightPref | None = None
    tempo: Tempo | None = None
    height_cm: float | None = None
    wrist_to_floor_cm: float | None = None
    glove: Glove | None = None
    glove_was_guessed: bool = False
    own_7i_loft_deg: float | None = None
    joint_pain: list[Literal["hands", "wrists", "elbows", "shoulders", "none"]] | None = Field(
        default=None,
        description="Asked, never changes the spec (C3): a why-panel note and a graphite tinker",
    )


class PhoneMeasurements(BaseModel):
    """At-home capture output (pack phone_measurements.csv; simulated in the pack)."""

    body_photo_quality: Literal["good", "poor"] | None = None
    height_photo_cm: float | None = None
    wrist_to_floor_photo_cm: float | None = None
    hand_length_photo_cm: float | None = None
    backswing_video_s: float | None = None
    downswing_video_s: float | None = None
    clubhead_speed_video_mph: float | None = None


class FitEvidence(BaseModel):
    """Measured evidence for `build_answers`. `shots` are the usable shots: the caller drops
    plausibility rejects (S1/S3) first and keeps mishits (they carry lie information)."""

    phone: PhoneMeasurements | None = None
    shots: list[Shot] = Field(default_factory=list)
    ball_line_tilt_deg: list[float] = Field(
        default_factory=list, description="Ball-line test readings, + = toe up (own club)"
    )
    round_avg_score: float | None = Field(
        default=None, description="Average 18-hole score from a round-stats import"
    )
    flags: list[Flag] = Field(
        default_factory=list,
        description="Plausibility flags on sources, matched by `field` (an IntakeAnswers or "
        "PhoneMeasurements field name): reject drops it, downweight doubles its sigma, an "
        "unresolved confirm triples it",
    )


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


# --- Flight & Dispersion (plan §3.6, §3.8) ----------------------------------------------------


class Ellipse(BaseModel):
    cx: float
    cz: float
    rx: float
    rz: float
    angle_deg: float


class Ellipses(BaseModel):
    one_sigma: Ellipse
    two_sigma: Ellipse


class CarryStats(BaseModel):
    mean: float
    p10: float | None = None
    p90: float | None = None


class SideStats(BaseModel):
    mean: float
    sd: float


class FlightSummary(BaseModel):
    carry: CarryStats
    total: float | None = None
    side: SideStats | None = None
    apex: float
    land_angle: float | None = None
    launch: float | None = None
    spin: float | None = None


class HeadFlight(BaseModel):
    head: HeadSlug
    label: str | None = None
    recommended: bool = False
    trajectory: list[tuple[float, float, float, float]] = Field(default_factory=list)
    landing_pts: list[tuple[float, float]] = Field(default_factory=list)
    ellipses: Ellipses | None = None
    summary: FlightSummary


class FlightRequest(BaseModel):
    session_id: str
    heads: list[HeadSlug] = Field(default_factory=list, max_length=5)


class FlightResult(BaseModel):
    per_head: list[HeadFlight]
    own_shots: list[tuple[float, float]] = Field(default_factory=list)


class FitResult(BaseModel):
    recs: list[Recommendation] = Field(default_factory=list)
    ranking: list[HeadScore] = Field(default_factory=list)
    why: list[WhyItem] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    close_calls: list[CloseCall] = Field(default_factory=list)
    flight: FlightResult | None = None


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
