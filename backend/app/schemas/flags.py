"""Flag primitives shared by evidence, state and common (a leaf module: no app imports).

`app.schemas.evidence` re-exports everything here, so import from there. This module exists only
to break the import cycle evidence -> state -> evidence (ImportReport carries a FittingState,
FittingState carries pending Flags). Owned by EVIDENCE after v0: add codes additively.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

# Plan §5.2. S4 is merged into S1/S2 and has no code.
FlagCode = Literal[
    # shot level
    "S1", "S2", "S3", "S5", "S6", "S7", "S8", "S9", "S10",
    "S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18",
    # golfer level
    "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9",
    "G10", "G11", "G12", "G13", "G14", "G15",
    # vision extraction
    "V1", "V2", "V3", "V4", "V5", "V6",
]  # fmt: skip

# reject: excluded; downweight: sigma x2; confirm: pending at sigma x3 and asked; info: shown only.
FlagSeverity = Literal["reject", "downweight", "confirm", "info"]


class Flag(BaseModel):
    """A deterministic plausibility finding. The LLM only phrases it (plan §5.3)."""

    model_config = ConfigDict(frozen=True)

    code: FlagCode
    severity: FlagSeverity
    field: str | None = None
    value: float | str | None = None
    expected: str | None = None
    shot_index: int | None = None
    message_id: str | None = None
    suggested_value: float | str | None = None
    import_id: str | None = None
    resolved: bool = False
