"""Shared literals and value types (plan §3.1). Values mirror the pack's own vocabularies."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.flags import FlagCode

HeadSlug = Literal["101-mkii", "201-mkii", "201t-mkii", "301-cb", "301-mb"]
Flex = Literal["lady", "senior", "regular", "stiff", "x-stiff"]  # products.FLEX_ORDER
Material = Literal["steel", "graphite"]
GripSize = Literal["standard", "midsize", "oversize"]  # products.GRIP_ORDER
Glove = Literal["XS", "S", "M", "M/L", "L", "XL"]  # products.GLOVE_ORDER
Handedness = Literal["right", "left"]
Purchase = Literal["stock", "custom"]
Sex = Literal["male", "female"]
Tempo = Literal["smooth", "moderate", "quick"]
FlightPref = Literal["low", "mid", "high"]
Characteristic = Literal[
    "forgiveness",
    "distance",
    "forged feel",
    "distance control",
    "workability",
    "less offset",
    "more offset",
]
Bucket = Literal[1, 2, 3, 4, 5]
# The spec parts the official scorer weights (WEIGHTS, copied into app.pack).
Part = Literal[
    "head", "flex", "material", "shaft_model", "length", "lie", "grip", "purchase", "handedness"
]
Gate = Literal["needs_info", "no_result", "provisional", "confident"]
Depth = Literal["beginner", "standard", "numbers"]
Engine = Literal["scripted", "live"]
Source = Literal[
    "questionnaire", "photo", "video", "trackman", "radar", "ball_line", "vision", "derived"
]
SpecValue = str | int | float


class Spec(BaseModel):
    """A buildable iron spec, mirroring takomo_fit.baseline.Recommendation's spec fields."""

    model_config = ConfigDict(frozen=True)

    head: HeadSlug
    shaft: str = Field(description="Shaft slug from takomo_products.json")
    shaft_model: str | None = None
    flex: Flex
    material: Material
    length_in: float
    lie_deg: int = Field(ge=-3, le=3)
    grip: GripSize
    handedness: Handedness = "right"
    purchase: Purchase


class Provenance(BaseModel):
    """Where a value came from (plan §3.3)."""

    model_config = ConfigDict(frozen=True)

    source: Source
    sd: float | None = None
    n: int | None = Field(default=None, description="Number of readings/shots behind the value")
    import_id: str | None = None
    note: str | None = None


class ProvenancedValue(Provenance):
    """A profile field value with its provenance: {value, source, sd, flags[]}."""

    value: float | int | str | bool | list[str] | None = None
    unit: str | None = None
    flags: list[FlagCode] = Field(default_factory=list)


class ErrorDetail(BaseModel):
    """One request-validation problem: where (`loc`), what (`msg`) and the pydantic error `type`."""

    loc: list[str | int]
    msg: str
    type: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    retryable: bool = False
    details: list[ErrorDetail] | None = None  # only on 422 invalid_input from request validation


def require_type_field(schema: dict[str, Any]) -> None:
    """Mark the defaulted `type` discriminator as required in JSON Schema, so generated TS
    types get a non-optional discriminant while Python callers can still omit it."""
    if "type" in schema.get("properties", {}):
        required = schema.setdefault("required", [])
        if "type" not in required:
            required.insert(0, "type")
