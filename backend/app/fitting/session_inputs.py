"""A stored session -> the mapping's inputs. Pure (no I/O): reads the FitSession it is given.

`session.profile` holds what the golfer answered (IntakeAnswers fields) and any phone
measurements (PhoneMeasurements fields), each as a ProvenancedValue. A key present with value
None means the golfer answered "I don't know": it counts as asked, not as known.
"""

from __future__ import annotations

from app.fitting.beginner import with_beginner_defaults
from app.schemas.fit import FitEvidence, IntakeAnswers, PhoneMeasurements
from app.schemas.session import FitSession

INTAKE_FIELDS = frozenset(IntakeAnswers.model_fields)
PHONE_FIELDS = frozenset(PhoneMeasurements.model_fields)
# Answers to offers (not profile values): recorded so the same offer is not asked again.
OFFER_FIELDS = frozenset({"ball_line_offer", "precision_offer"})
EVIDENCE_FIELDS = frozenset({"ball_line_tilt_deg", "shots"})
PROFILE_FIELDS = INTAKE_FIELDS | PHONE_FIELDS | OFFER_FIELDS | EVIDENCE_FIELDS


def _values(session: FitSession, names: frozenset[str]) -> dict[str, object]:
    return {k: pv.value for k, pv in session.profile.items() if k in names and pv.value is not None}


def intake_of(session: FitSession) -> IntakeAnswers:
    """The golfer's answers, with the beginner defaults (L26) filled in for a new golfer."""
    return with_beginner_defaults(IntakeAnswers.model_validate(_values(session, INTAKE_FIELDS)))


def evidence_of(session: FitSession) -> FitEvidence:
    """Evidence known to the session: phone values, flags, ball-line readings and the shots of
    confirmed imports (`state.shots`, already free of S1/S3/S7 rejects; S8 mishits kept)."""
    phone = _values(session, PHONE_FIELDS)
    ball_line = session.profile.get("ball_line_tilt_deg")
    ball_line_readings: list[float] = []
    if ball_line is not None and ball_line.value is not None:
        if isinstance(ball_line.value, list):
            ball_line_readings = [float(x) for x in ball_line.value]
        elif isinstance(ball_line.value, (int, float)):
            ball_line_readings = [float(ball_line.value)]
    shots = list(session.state.shots) if session.state and session.state.shots else []
    return FitEvidence(
        phone=PhoneMeasurements.model_validate(phone) if phone else None,
        shots=shots,
        ball_line_tilt_deg=ball_line_readings,
        flags=list(session.flags),
    )


def answered(session: FitSession) -> set[str]:
    """Every profile key the golfer has answered, "I don't know" included."""
    return set(session.profile)
