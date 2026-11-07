"""G13: self-reported score vs imported round history (plan §5.2, issue #1, #34). Pure.

Takomo noted golfers answer the score question with last week's best round. When the imported
average of at least 5 rounds lands 2 or more buckets worse than the self-reported bucket, ask.
"""

from __future__ import annotations

from app.pack import score_bucket_from_score
from app.schemas.evidence import Flag

# Plan §5.2 G13 thresholds (not in thresholds.json: they are rule definitions, not train stats).
G13_MIN_ROUNDS = 5
G13_MIN_BUCKET_GAP = 2


def g13_score_vs_round_history(
    self_score_bucket: int | None,
    avg_score: float | None,
    n_rounds: int | None,
    *,
    import_id: str | None = None,
) -> list[Flag]:
    """G13: confirm when the self-reported bucket is >= 2 buckets better (lower) than the
    bucket of the imported average over >= 5 rounds.

    The flag carries numbers only; the assistant phrases them ("Your last 12 rounds average 94.
    Shall we use that rather than your best day?"). `suggested_value` is the history bucket.
    """
    if self_score_bucket is None or avg_score is None or n_rounds is None:
        return []
    if n_rounds < G13_MIN_ROUNDS:
        return []
    history_bucket = score_bucket_from_score(avg_score)
    if history_bucket - self_score_bucket < G13_MIN_BUCKET_GAP:
        return []
    return [
        Flag(
            code="G13",
            severity="confirm",
            field="score_bucket",
            value=self_score_bucket,
            expected=f"avg {avg_score:.1f} over {n_rounds} rounds = bucket {history_bucket}",
            message_id="g13_score_vs_round_history",
            suggested_value=history_bucket,
            import_id=import_id,
        )
    ]
