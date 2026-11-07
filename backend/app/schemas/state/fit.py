"""FIT's part of FittingState. Owned by FIT after v0: add optional fields only."""

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Spec


class FitStatePart(BaseModel):
    model_config = ConfigDict(frozen=True)

    best: Spec | None = None
    runner_up: Spec | None = None
