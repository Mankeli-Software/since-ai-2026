"""The confidence gate (plan §3.4 step 7, L10; decision D3 for the 30-50% band).

| C           | gate                         | the user sees                                   |
|-------------|------------------------------|-------------------------------------------------|
| min. set missing | needs_info              | "—" and the missing list                        |
| < 0.30      | no_result                    | a request for the minimum missing data          |
| 0.30-0.50   | provisional, strength "low"  | the result, framed as "add data to firm this up" |
| 0.50-0.70   | provisional                  | the result plus "add data" suggestions          |
| >= 0.70     | confident                    | the full result                                 |
"""

from __future__ import annotations

from typing import Literal

from app.schemas.common import Gate

NO_RESULT_BELOW = 0.30
LOW_BELOW = 0.50
CONFIDENT_FROM = 0.70

# Bands in order, so "moved up a band" is a comparison of ranks.
BAND_RANK = {
    "needs_info": 0,
    "no_result": 1,
    "provisional_low": 2,
    "provisional": 3,
    "confident": 4,
}


def gate_for(confidence: float) -> tuple[Gate, Literal["low"] | None]:
    """(gate, strength) for a confidence C in [0, 1]."""
    if confidence < NO_RESULT_BELOW:
        return "no_result", None
    if confidence < LOW_BELOW:
        return "provisional", "low"
    if confidence < CONFIDENT_FROM:
        return "provisional", None
    return "confident", None


def band(gate: Gate, strength: Literal["low"] | None) -> str:
    """The band name: the gate, with provisional split by strength."""
    return "provisional_low" if gate == "provisional" and strength == "low" else gate
