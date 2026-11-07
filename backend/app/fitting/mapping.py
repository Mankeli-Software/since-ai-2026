"""Input mapping: intake + evidence -> MappedAnswers with provenance per field (plan §3.3).

The template is the pack's `examples/baselines.py::predict` (B2), extended with fusion,
bias corrections and provenance. The app and the batch scripts (`scripts/score_dev.py`,
`scripts/make_test_predictions.py`) all use this one `build_answers`.

Every tunable rule is a `MappingOptions` field. Fields marked *exp* in the plan are kept on
only while `just score` on dev says they help (`just score --opt name=value` to compare).
Default numbers were measured on the train split (never on test).

Pure: no I/O, no LLM. Reaches Takomo's rules only through `app.pack`.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable
from dataclasses import dataclass, field

from app import pack
from app.schemas.common import Provenance, Source
from app.schemas.evidence import Shot
from app.schemas.fit import FitEvidence, IntakeAnswers, MappedAnswers

# Questionnaire fields a fit cannot run without, and the evidence that can stand in for each.
REQUIRED_INPUTS = (
    "age",
    "sex",
    "handedness",
    "score_bucket",
    "swing",
    "flight",
    "tempo",
    "height_cm",
    "wrist_to_floor_cm",
    "glove",
)


@dataclass(frozen=True)
class MappingOptions:
    # --- swing speed (train: TrackMan own-7i reads +0.36 mph, radar +0.41, test clubs -0.14)
    session_bias_mph: dict[str, float] = field(
        default_factory=lambda: {"trackman_fitting": 0.36, "home_radar": 0.40, "import": 0.36}
    )
    test_club_speed: bool = True  # exp, kept: dev 85.44 -> 85.59 (train MAE 0.53 vs 0.84 own-7i)
    test_club_bias_mph: float = -0.14
    trimmed_mean: bool = False  # exp, off: no change on dev (drop 10% at each end)
    video_speed_sd_mph: float = 3.5
    self_speed_bias_mph: float = 2.0  # train: reported speed runs 2.0 mph high (sd 4.0)
    self_speed_sd_mph: float = 4.0
    carry_speed_estimate: bool = True  # exp, kept: dev 84.83 -> 85.44 vs the pack carry table
    carry_speed_sd_mph: float = 5.0
    # --- body (train: self height +1.0 cm sd 1.3; wrist-to-floor sd 3.25; photos per the pack)
    height_self_bias_cm: float = 1.0
    height_self_sd_cm: float = 1.3
    height_photo_sd_cm: dict[str, float] = field(default_factory=lambda: {"good": 1.6, "poor": 3.5})
    wtf_self_sd_cm: float = 3.2
    wtf_photo_sd_cm: dict[str, float] = field(default_factory=lambda: {"good": 2.0, "poor": 3.6})
    # --- tempo (pack: quick < 1.05 s, smooth > 1.35 s total swing time)
    tempo_quick_below_s: float = 1.05
    tempo_smooth_above_s: float = 1.35
    # --- flight (pack: high if landing angle < 35 deg, low if > 45 deg)
    flight_from_own_7i: bool = True  # exp: no dev golfer has own-7i TrackMan without a 201 session
    flight_high_below_deg: float = 35.0
    flight_low_above_deg: float = 45.0
    # --- lie
    ball_line_scale: float = 1.095  # train: tilt ~= 1.095 * (own_lie_adj - need)
    ball_line_weight: float = 0.5  # exp: best of 0.3-0.7 on dev and on train
    own_7i_lie_weight: float = 0.5  # own-7i Dynamic Lie vs the chart (own club lie unknown)


DEFAULT_OPTIONS = MappingOptions()


class MissingInputsError(ValueError):
    def __init__(self, fields: list[str]) -> None:
        super().__init__(f"missing inputs: {', '.join(fields)}")
        self.fields = fields


# --------------------------------------------------------------------------- small helpers


def _mean(xs: list[float], trimmed: bool = False) -> float:
    if trimmed and len(xs) >= 3:
        k = max(1, int(len(xs) * 0.1))
        xs = sorted(xs)[k:-k]
    return statistics.fmean(xs)


def _se(xs: list[float], floor: float = 0.0) -> float | None:
    """Standard error of the mean, or None for a single value."""
    if len(xs) < 2:
        return None
    return math.hypot(statistics.stdev(xs) / math.sqrt(len(xs)), floor)


def _fuse(estimates: Iterable[tuple[float, float]]) -> tuple[float, float]:
    """Inverse-variance fusion of (value, sd) pairs -> (value, sd)."""
    pairs = list(estimates)
    w = [1.0 / (sd * sd) for _, sd in pairs]
    value = sum(wi * v for wi, (v, _) in zip(w, pairs, strict=True)) / sum(w)
    return value, math.sqrt(1.0 / sum(w))


def _session_source(session: str) -> Source:
    return "radar" if session == "home_radar" else "trackman"


def _is_test_club(club: str) -> bool:
    return club.startswith("takomo_")


def _values(shots: Iterable[Shot], attr: str) -> list[float]:
    return [v for s in shots if (v := getattr(s, attr)) is not None and math.isfinite(v)]


# --------------------------------------------------------------------------- per field


def _swing(
    intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions
) -> tuple[int, float | None, Provenance] | None:
    """(bucket, speed estimate or None, provenance). Precedence: shots -> video -> self-reported
    speed -> self-reported carry."""
    used = [
        s
        for s in ev.shots
        if s.club_speed_mph is not None
        and (s.club == "own_7i" or (o.test_club_speed and _is_test_club(s.club)))
    ]
    if used:
        speeds = [
            s.club_speed_mph
            - (
                o.test_club_bias_mph
                if _is_test_club(s.club)
                else o.session_bias_mph.get(s.session, 0.0)
            )
            for s in used
            if s.club_speed_mph is not None
        ]
        speed = _mean(speeds, o.trimmed_mean)
        source = _session_source(used[0].session)
        n_test = sum(_is_test_club(s.club) for s in used)
        clubs = "own 7-iron" if n_test == 0 else f"own 7-iron + {n_test} test-club"
        note = f"mean of {len(speeds)} shots ({clubs}), session bias removed"
        sd = _se(speeds, floor=0.3)
        return (
            pack.swing_bucket_from_speed(speed),
            speed,
            Provenance(source=source, sd=sd, n=len(speeds), note=note),
        )
    video = ev.phone.clubhead_speed_video_mph if ev.phone else None
    if video is not None:
        return (
            pack.swing_bucket_from_speed(video),
            video,
            Provenance(source="video", sd=o.video_speed_sd_mph, n=1, note="240 fps swing video"),
        )
    if intake.reported_7i_speed_mph is not None:
        speed = intake.reported_7i_speed_mph - o.self_speed_bias_mph
        return (
            pack.swing_bucket_from_speed(speed),
            speed,
            Provenance(
                source="questionnaire",
                sd=o.self_speed_sd_mph,
                note=f"reported {intake.reported_7i_speed_mph:g} mph, typical over-report removed",
            ),
        )
    if intake.reported_7i_carry_yd is not None:
        carry = intake.reported_7i_carry_yd
        if o.carry_speed_estimate:
            speed = (carry - 15 + 63.3) / 2.536
            return (
                pack.swing_bucket_from_speed(speed),
                speed,
                Provenance(
                    source="questionnaire",
                    sd=o.carry_speed_sd_mph,
                    note=f"speed estimated from reported carry {carry:g} yd",
                ),
            )
        return (
            pack.swing_bucket_from_carry(carry),
            None,
            Provenance(source="questionnaire", note=f"reported carry {carry:g} yd"),
        )
    return None


def _body(
    self_value: float | None,
    self_bias: float,
    self_sd: float,
    photo_value: float | None,
    quality: str | None,
    photo_sd: dict[str, float],
) -> tuple[float, Provenance] | None:
    est: list[tuple[float, float]] = []
    if self_value is not None:
        est.append((self_value - self_bias, self_sd))
    if photo_value is not None:
        est.append((photo_value, photo_sd.get(quality or "poor", photo_sd["poor"])))
    if not est:
        return None
    value, sd = _fuse(est)
    if len(est) == 2:
        prov = Provenance(source="derived", sd=sd, n=2, note=f"self-report + {quality} photo")
    elif photo_value is not None:
        prov = Provenance(source="photo", sd=sd, n=1, note=f"{quality} photo")
    else:
        prov = Provenance(source="questionnaire", sd=sd)
    return value, prov


def _glove(intake: IntakeAnswers, ev: FitEvidence) -> tuple[str, float | None, Provenance] | None:
    hand = ev.phone.hand_length_photo_cm if ev.phone else None
    if hand is not None:
        note = f"hand length {hand:.1f} cm"
        return (
            pack.glove_from_hand_length(hand),
            hand,
            Provenance(source="photo", sd=0.35, note=note),
        )
    if intake.glove is not None:
        note = "golfer was not sure; the form's default" if intake.glove_was_guessed else None
        return intake.glove, None, Provenance(source="questionnaire", note=note)
    return None


def _tempo(
    intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions
) -> tuple[str, Provenance] | None:
    p = ev.phone
    if p and p.backswing_video_s is not None and p.downswing_video_s is not None:
        total = p.backswing_video_s + p.downswing_video_s
        if total < o.tempo_quick_below_s:
            tempo = "quick"
        elif total > o.tempo_smooth_above_s:
            tempo = "smooth"
        else:
            tempo = "moderate"
        return tempo, Provenance(source="video", note=f"swing time {total:.2f} s")
    if intake.tempo is not None:
        return intake.tempo, Provenance(source="questionnaire")
    return None


def _flight(
    intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions
) -> tuple[str, Provenance] | None:
    for clubs, label, enabled in (
        ([s for s in ev.shots if s.club.startswith("takomo_201")], "201 test club", True),
        ([s for s in ev.shots if s.club == "own_7i"], "own 7-iron", o.flight_from_own_7i),
    ):
        angles = _values(clubs, "landing_angle_deg")
        if enabled and angles:
            mean = statistics.fmean(angles)
            if mean < o.flight_high_below_deg:
                flight = "high"
            elif mean > o.flight_low_above_deg:
                flight = "low"
            else:
                flight = "mid"
            prov = Provenance(
                source=_session_source(clubs[0].session),
                sd=_se(angles),
                n=len(angles),
                note=f"{label} landing angle {mean:.1f} deg",
            )
            return flight, prov
    if intake.flight is not None:
        return intake.flight, Provenance(source="questionnaire")
    return None


def _lie(
    ev: FitEvidence, height: float, wtf: float, o: MappingOptions
) -> tuple[float, Provenance] | None:
    """Continuous lie need from evidence, or None to let the static chart decide.

    Test-club Dynamic Lie overrides the chart (test clubs are built at standard lie, mishits
    kept). The ball-line test and own-7i Dynamic Lie are relative to the golfer's own club, whose
    lie we don't know, so they are fused with the chart, never override it.
    """
    test = [
        -v for v in _values([s for s in ev.shots if _is_test_club(s.club)], "impact_toe_up_deg")
    ]
    if test:
        mean = statistics.fmean(test)
        note = f"test-club Dynamic Lie over {len(test)} shots"
        return mean, Provenance(source="trackman", sd=_se(test), n=len(test), note=note)
    chart = pack.static_lie_deg(height, wtf)
    if ev.ball_line_tilt_deg:
        tilt = statistics.fmean(ev.ball_line_tilt_deg)
        reading = -tilt / o.ball_line_scale
        w = o.ball_line_weight
        note = f"ball-line {reading:+.1f} fused with chart {chart:+.1f}"
        return (
            w * reading + (1 - w) * chart,
            Provenance(source="ball_line", n=len(ev.ball_line_tilt_deg), note=note),
        )
    own = [-v for v in _values([s for s in ev.shots if s.club == "own_7i"], "impact_toe_up_deg")]
    if own:
        reading = statistics.fmean(own)
        w = o.own_7i_lie_weight
        note = (
            f"own 7-iron Dynamic Lie {reading:+.1f} fused with chart {chart:+.1f}; "
            "relative to your current club, whose lie we don't know"
        )
        return (
            w * reading + (1 - w) * chart,
            Provenance(source="trackman", n=len(own), note=note),
        )
    return None


# --------------------------------------------------------------------------- entry points


def missing_inputs(intake: IntakeAnswers, evidence: FitEvidence | None = None) -> list[str]:
    """Required inputs that neither the intake nor the evidence supplies yet."""
    ev = evidence or FitEvidence()
    p = ev.phone
    have = {
        "age": intake.age is not None,
        "sex": intake.sex is not None,
        "handedness": intake.handedness is not None,
        "score_bucket": intake.score_bucket is not None or ev.round_avg_score is not None,
        "swing": _swing(intake, ev, DEFAULT_OPTIONS) is not None,
        "flight": _flight(intake, ev, DEFAULT_OPTIONS) is not None,
        "tempo": _tempo(intake, ev, DEFAULT_OPTIONS) is not None,
        "height_cm": intake.height_cm is not None or bool(p and p.height_photo_cm is not None),
        "wrist_to_floor_cm": intake.wrist_to_floor_cm is not None
        or bool(p and p.wrist_to_floor_photo_cm is not None),
        "glove": _glove(intake, ev) is not None,
    }
    return [k for k in REQUIRED_INPUTS if not have[k]]


def build_answers(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    options: MappingOptions = DEFAULT_OPTIONS,
) -> MappedAnswers:
    """The rules' inputs from everything we know, best source first, with provenance.

    Raises MissingInputsError (listing `missing_inputs`) when a required input has no source.
    """
    ev = evidence or FitEvidence()
    if missing := missing_inputs(intake, ev):
        raise MissingInputsError(missing)
    o = options
    p = ev.phone
    prov: dict[str, Provenance] = {}

    swing = _swing(intake, ev, o)
    flight = _flight(intake, ev, o)
    tempo = _tempo(intake, ev, o)
    glove = _glove(intake, ev)
    height = _body(
        intake.height_cm,
        o.height_self_bias_cm,
        o.height_self_sd_cm,
        p.height_photo_cm if p else None,
        p.body_photo_quality if p else None,
        o.height_photo_sd_cm,
    )
    wtf = _body(
        intake.wrist_to_floor_cm,
        0.0,
        o.wtf_self_sd_cm,
        p.wrist_to_floor_photo_cm if p else None,
        p.body_photo_quality if p else None,
        o.wtf_photo_sd_cm,
    )
    # missing_inputs() passed, so every required piece is present.
    assert swing and flight and tempo and glove and height and wtf

    if ev.round_avg_score is not None:
        score_bucket = pack.score_bucket_from_score(ev.round_avg_score)
        note = f"average score {ev.round_avg_score:g}"
        prov["score_bucket"] = Provenance(source="vision", note=note)
    else:
        score_bucket = intake.score_bucket
        prov["score_bucket"] = Provenance(source="questionnaire")

    bucket, speed, prov["swing_bucket"] = swing
    flight_value, prov["flight"] = flight
    tempo_value, prov["tempo"] = tempo
    glove_value, hand_cm, prov["glove"] = glove
    height_cm, prov["height_cm"] = height
    wtf_cm, prov["wrist_to_floor_cm"] = wtf
    for name in ("age", "sex", "handedness", "characteristics"):
        prov[name] = Provenance(source="questionnaire")

    lie = _lie(ev, height_cm, wtf_cm, o)
    if lie is not None:
        prov["lie"] = lie[1]

    return MappedAnswers.model_validate(
        {
            "age": intake.age,
            "sex": intake.sex,
            "score_bucket": score_bucket,
            "swing_bucket": bucket,
            "characteristics": intake.characteristics[:3],
            "flight": flight_value,
            "tempo": tempo_value,
            "height_cm": height_cm,
            "wrist_to_floor_cm": wtf_cm,
            "glove": glove_value,
            "handedness": intake.handedness,
            "rounds_per_year": intake.rounds_per_year,
            "provenance": prov,
            "lie_override_deg": lie[0] if lie else None,
            "est_7i_speed_mph": speed,
            "est_hand_length_cm": hand_cm,
        }
    )
