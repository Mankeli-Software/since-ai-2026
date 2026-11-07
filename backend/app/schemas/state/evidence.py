"""EVIDENCE's part of FittingState. Owned by EVIDENCE after v0: add optional fields only."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.flags import Flag


class EvidenceStatePart(BaseModel):
    model_config = ConfigDict(frozen=True)

    evidence_version: int = 0
    pending_flags: list[Flag] = Field(default_factory=list)
    import_ids: list[str] = Field(default_factory=list)
