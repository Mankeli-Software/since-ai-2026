"""FittingState: the frozen, versioned session state the backend owns (plan §2.3, §4.5).

Composed from per-lane parts so lanes add fields in their own file:
`fit.py` (FIT), `evidence.py` (EVIDENCE), `confidence.py` (FIT). The fields are flat on the wire.
The client keeps whichever copy has the highest `version`.
"""

from pydantic import ConfigDict

from app.schemas.state.confidence import ConfidenceStatePart, NextQuestionHint, PartConfidence
from app.schemas.state.evidence import EvidenceStatePart
from app.schemas.state.fit import FitStatePart


class FittingState(FitStatePart, EvidenceStatePart, ConfidenceStatePart):
    model_config = ConfigDict(frozen=True)

    version: int = 0


__all__ = [
    "ConfidenceStatePart",
    "EvidenceStatePart",
    "FitStatePart",
    "FittingState",
    "NextQuestionHint",
    "PartConfidence",
]
