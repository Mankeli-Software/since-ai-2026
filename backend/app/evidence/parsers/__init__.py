"""Evidence parsers (plan §5.1). Pure layer: no I/O, no LLM."""

from app.evidence.parsers.ball_line import BallLineEvidence, parse_ball_line
from app.evidence.parsers.manual import parse_manual_value
from app.evidence.parsers.round_stats import RoundStats, parse_round_stats

__all__ = [
    "BallLineEvidence",
    "RoundStats",
    "parse_ball_line",
    "parse_manual_value",
    "parse_round_stats",
]
