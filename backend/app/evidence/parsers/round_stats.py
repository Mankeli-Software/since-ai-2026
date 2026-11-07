"""Round-stats parser (plan §5.1, §5.4; issue #34). Pure: a dict in, `RoundStats` out.

The source is a GameBook or 18Birdies stats screen read by the vision extractor (`agent/extract.py`)
or typed in chat: `{avg_score, n_rounds}`. The score bucket comes from Takomo's own rule,
`score_bucket_from_score`, called through `app.pack` (never reimplemented here). G13 compares the
result with the self-reported bucket (`plausibility/round_history.py`).
"""

from __future__ import annotations

import math
import re
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.pack import score_bucket_from_score
from app.schemas.common import Bucket

# Keys the extractor or a chat form may use. Only these are read; everything else is ignored, so
# no free text from a screenshot travels further (evidence/CLAUDE.md).
_AVG_KEYS = ("avg_score", "average_score", "avg", "scoring_average")
_N_KEYS = ("n_rounds", "rounds", "rounds_played", "num_rounds")
_NUMBER = re.compile(r"^\s*[+-]?\d{1,4}(?:[.,]\d{1,3})?\s*$")


class RoundStats(BaseModel):
    """An imported scoring history. `score_bucket` is the pack's bucket for `avg_score`."""

    model_config = ConfigDict(frozen=True)

    avg_score: float = Field(gt=0, description="Average 18-hole gross score")
    n_rounds: int = Field(ge=1, description="Rounds behind the average")
    score_bucket: Bucket


def _number(raw: Mapping[str, Any], keys: tuple[str, ...]) -> float:
    for key in keys:
        if key not in raw or raw[key] is None:
            continue
        v = raw[key]
        if isinstance(v, bool):
            break
        if isinstance(v, int | float):
            x = float(v)
        elif isinstance(v, str) and _NUMBER.match(v):
            x = float(v.strip().replace(",", "."))
        else:
            break
        if not math.isfinite(x):
            break
        return x
    raise ValueError(f"round stats: missing or non-numeric {keys[0]}")


def parse_round_stats(raw: Mapping[str, Any]) -> RoundStats:
    """`{avg_score, n_rounds}` -> `RoundStats` with the pack's score bucket.

    Raises `ValueError` when a value is missing, not a number, or not positive. Human bounds
    (G1: score 55-160) are a plausibility rule, not a parse error, so they are not checked here.
    """
    avg = _number(raw, _AVG_KEYS)
    n = _number(raw, _N_KEYS)
    if avg <= 0:
        raise ValueError("round stats: avg_score must be positive")
    if n < 1 or n != int(n):
        raise ValueError("round stats: n_rounds must be a whole number >= 1")
    return RoundStats(
        avg_score=avg,
        n_rounds=int(n),
        score_bucket=score_bucket_from_score(avg),  # type: ignore[arg-type]
    )
