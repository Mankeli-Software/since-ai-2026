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
from app.fitting import priors
from app.schemas.common import Provenance, Source
from app.schemas.evidence import Shot
from app.schemas.fit import FitEvidence, IntakeAnswers, MappedAnswers

# The minimum set a result needs at all (plan §3.4); the rest can fall back to priors.
MINIMUM_INPUTS = ("age", "sex", "handedness", "score_bucket", "swing")

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
    # exp: least-squares carry -> speed line fitted on train. The plan's formula is unbiased on
    # average but its slope is too steep: +1.6 mph at 150-170 yd claims, +4.3 above 170.
    carry_speed_fit: bool = True  # exp, kept: dev 85.59 -> 85.62 (flex 87.1 -> 87.5)
    carry_speed_fit_line: tuple[float, float] = (26.646, 0.3376)
    carry_speed_fit_sd_mph: float = 4.46
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


# --------------------------------------------------------------------------- flags


def _flag_factor(ev: FitEvidence, name: str) -> float | None:
    """σ multiplier from unresolved plausibility flags on one source (plan §3.4 step 1):
    `reject` drops the source (None), `downweight` doubles σ, `confirm` (pending) triples it."""
    factor = 1.0
    for f in ev.flags:
        if f.field != name or f.resolved:
            continue
        if f.severity == "reject":
            return None
        if f.severity == "downweight":
            factor = max(factor, 2.0)
        elif f.severity == "confirm":
            factor = max(factor, 3.0)
    return factor


# --------------------------------------------------------------------------- per field


@dataclass(frozen=True)
class Estimate:
    """A continuous input: best value, its σ, and where it came from."""

    value: float
    sd: float
    prov: Provenance


@dataclass(frozen=True)
class Choice:
    """A discrete input (glove, flight, tempo, score bucket) and where it came from."""

    value: str | int
    prov: Provenance


@dataclass(frozen=True)
class LieEvidence:
    """How the lie need is known. kind: test_club (overrides), ball_line or own_7i (each fused
    with the chart at `weight`). `value` is the fused point estimate given the body estimates."""

    kind: str
    reading: float
    reading_sd: float
    weight: float
    value: float
    prov: Provenance


def _swing(
    intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions
) -> tuple[int, Estimate | None, Provenance] | None:
    """(bucket, speed estimate or None, provenance). Precedence: shots -> video -> self-reported
    speed -> self-reported carry. A rejected source is skipped."""
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
        n_test = sum(_is_test_club(s.club) for s in used)
        clubs = "own 7-iron" if n_test == 0 else f"own 7-iron + {n_test} test-club"
        note = f"mean of {len(speeds)} shots ({clubs}), session bias removed"
        # Plan §3.4: SE of the mean with a 2 mph floor on the shot spread.
        spread = statistics.stdev(speeds) if len(speeds) > 1 else 0.0
        sd = max(spread, 2.0) / math.sqrt(len(speeds))
        prov = Provenance(source=_session_source(used[0].session), sd=sd, n=len(speeds), note=note)
        return pack.swing_bucket_from_speed(speed), Estimate(speed, sd, prov), prov

    video = ev.phone.clubhead_speed_video_mph if ev.phone else None
    k = _flag_factor(ev, "clubhead_speed_video_mph")
    if video is not None and k is not None:
        sd = o.video_speed_sd_mph * k
        prov = Provenance(source="video", sd=sd, n=1, note="240 fps swing video")
        return pack.swing_bucket_from_speed(video), Estimate(video, sd, prov), prov

    k = _flag_factor(ev, "reported_7i_speed_mph")
    if intake.reported_7i_speed_mph is not None and k is not None:
        speed = intake.reported_7i_speed_mph - o.self_speed_bias_mph
        sd = o.self_speed_sd_mph * k
        note = f"reported {intake.reported_7i_speed_mph:g} mph, typical over-report removed"
        prov = Provenance(source="questionnaire", sd=sd, note=note)
        return pack.swing_bucket_from_speed(speed), Estimate(speed, sd, prov), prov

    k = _flag_factor(ev, "reported_7i_carry_yd")
    if intake.reported_7i_carry_yd is not None and k is not None:
        carry = intake.reported_7i_carry_yd
        if o.carry_speed_fit:
            a, b = o.carry_speed_fit_line
            speed = a + b * carry
            sd = o.carry_speed_fit_sd_mph * k
            note = f"speed estimated from reported carry {carry:g} yd"
            prov = Provenance(source="questionnaire", sd=sd, note=note)
            return pack.swing_bucket_from_speed(speed), Estimate(speed, sd, prov), prov
        if o.carry_speed_estimate:
            speed = (carry - 15 + 63.3) / 2.536
            sd = o.carry_speed_sd_mph * k
            note = f"speed estimated from reported carry {carry:g} yd"
            prov = Provenance(source="questionnaire", sd=sd, note=note)
            return pack.swing_bucket_from_speed(speed), Estimate(speed, sd, prov), prov
        prov = Provenance(source="questionnaire", note=f"reported carry {carry:g} yd")
        return pack.swing_bucket_from_carry(carry), None, prov
    return None


def _body(
    ev: FitEvidence,
    self_name: str,
    self_value: float | None,
    self_bias: float,
    self_sd: float,
    photo_name: str,
    photo_value: float | None,
    quality: str | None,
    photo_sd: dict[str, float],
) -> Estimate | None:
    est: list[tuple[float, float]] = []
    k_self, k_photo = _flag_factor(ev, self_name), _flag_factor(ev, photo_name)
    use_photo = False
    if self_value is not None and k_self is not None:
        est.append((self_value - self_bias, self_sd * k_self))
    if photo_value is not None and k_photo is not None:
        use_photo = True
        sd = photo_sd.get(quality or "poor", photo_sd["poor"])
        est.append((photo_value, sd * k_photo))
    if not est:
        return None
    value, sd = _fuse(est)
    if len(est) == 2:
        prov = Provenance(source="derived", sd=sd, n=2, note=f"self-report + {quality} photo")
    elif use_photo:
        prov = Provenance(source="photo", sd=sd, n=1, note=f"{quality} photo")
    else:
        prov = Provenance(source="questionnaire", sd=sd)
    return Estimate(value, sd, prov)


def _glove(intake: IntakeAnswers, ev: FitEvidence) -> tuple[Choice, Estimate | None] | None:
    """(glove, hand-length estimate if photographed)."""
    hand = ev.phone.hand_length_photo_cm if ev.phone else None
    k = _flag_factor(ev, "hand_length_photo_cm")
    if hand is not None and k is not None:
        prov = Provenance(source="photo", sd=0.35 * k, note=f"hand length {hand:.1f} cm")
        return Choice(pack.glove_from_hand_length(hand), prov), Estimate(hand, 0.35 * k, prov)
    if intake.glove is not None and _flag_factor(ev, "glove") is not None:
        note = "golfer was not sure; the form's default" if intake.glove_was_guessed else None
        return Choice(intake.glove, Provenance(source="questionnaire", note=note)), None
    return None


def _tempo(intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions) -> Choice | None:
    p = ev.phone
    if p and p.backswing_video_s is not None and p.downswing_video_s is not None:
        total = p.backswing_video_s + p.downswing_video_s
        if total < o.tempo_quick_below_s:
            tempo = "quick"
        elif total > o.tempo_smooth_above_s:
            tempo = "smooth"
        else:
            tempo = "moderate"
        return Choice(tempo, Provenance(source="video", note=f"swing time {total:.2f} s"))
    if intake.tempo is not None and _flag_factor(ev, "tempo") is not None:
        return Choice(intake.tempo, Provenance(source="questionnaire"))
    return None


def _flight(intake: IntakeAnswers, ev: FitEvidence, o: MappingOptions) -> Choice | None:
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
            return Choice(flight, prov)
    if intake.flight is not None and _flag_factor(ev, "flight") is not None:
        return Choice(intake.flight, Provenance(source="questionnaire"))
    return None


def _score_bucket(intake: IntakeAnswers, ev: FitEvidence) -> Choice | None:
    if ev.round_avg_score is not None:
        note = f"average score {ev.round_avg_score:g}"
        bucket = pack.score_bucket_from_score(ev.round_avg_score)
        return Choice(bucket, Provenance(source="vision", note=note))
    if intake.score_bucket is not None:
        return Choice(intake.score_bucket, Provenance(source="questionnaire"))
    return None


def _lie(ev: FitEvidence, height: float, wtf: float, o: MappingOptions) -> LieEvidence | None:
    """Lie evidence, or None to let the static chart decide.

    Test-club Dynamic Lie overrides the chart (test clubs are built at standard lie, mishits
    kept). The ball-line test and own-7i Dynamic Lie are relative to the golfer's own club, whose
    lie we don't know, so they are fused with the chart, never override it.
    """
    test = [
        -v for v in _values([s for s in ev.shots if _is_test_club(s.club)], "impact_toe_up_deg")
    ]
    if test:
        mean = statistics.fmean(test)
        se = _se(test) or priors.OWN_7I_LIE_READING_SD
        note = f"test-club Dynamic Lie over {len(test)} shots"
        prov = Provenance(source="trackman", sd=se, n=len(test), note=note)
        return LieEvidence("test_club", mean, se, 1.0, mean, prov)
    chart = pack.static_lie_deg(height, wtf)
    if ev.ball_line_tilt_deg:
        reading = -statistics.fmean(ev.ball_line_tilt_deg) / o.ball_line_scale
        w = o.ball_line_weight
        note = f"ball-line {reading:+.1f} fused with chart {chart:+.1f}"
        prov = Provenance(source="ball_line", n=len(ev.ball_line_tilt_deg), note=note)
        sd = priors.BALL_LINE_READING_SD
        return LieEvidence("ball_line", reading, sd, w, w * reading + (1 - w) * chart, prov)
    own = [-v for v in _values([s for s in ev.shots if s.club == "own_7i"], "impact_toe_up_deg")]
    if own:
        reading = statistics.fmean(own)
        w = o.own_7i_lie_weight
        note = (
            f"own 7-iron Dynamic Lie {reading:+.1f} fused with chart {chart:+.1f}; "
            "relative to your current club, whose lie we don't know"
        )
        prov = Provenance(source="trackman", n=len(own), note=note)
        sd = priors.OWN_7I_LIE_READING_SD
        return LieEvidence("own_7i", reading, sd, w, w * reading + (1 - w) * chart, prov)
    return None


# --------------------------------------------------------------------------- entry points


@dataclass(frozen=True)
class InputEstimates:
    """Every input the rules need, with σ and provenance; None where nothing is known yet.

    `build_answers` turns the point values into MappedAnswers; `app.confidence` samples around
    them. One source of truth, so the meter and the recommendation always agree.
    """

    swing_bucket: int | None
    speed: Estimate | None
    swing_prov: Provenance | None
    score_bucket: Choice | None
    flight: Choice | None
    tempo: Choice | None
    glove: Choice | None
    hand: Estimate | None
    height: Estimate | None
    wrist_to_floor: Estimate | None
    lie: LieEvidence | None
    at_prior: tuple[str, ...] = ()


def _prior_prov(what: str) -> Provenance:
    return Provenance(source="derived", note=f"population average {what} (not measured yet)")


def _fill_priors(e: InputEstimates, o: MappingOptions, ev: FitEvidence) -> InputEstimates:
    """Missing non-minimum fields -> population priors (point value = mean or mode)."""
    at_prior: list[str] = []
    height, wtf, glove, hand = e.height, e.wrist_to_floor, e.glove, e.hand
    flight, tempo = e.flight, e.tempo
    if height is None:
        mu, sd = priors.HEIGHT_CM
        height = Estimate(mu, sd, _prior_prov("height"))
        at_prior.append("height_cm")
    if wtf is None:
        mu, sd = priors.WRIST_TO_FLOOR_CM
        wtf = Estimate(mu, sd, _prior_prov("wrist-to-floor"))
        at_prior.append("wrist_to_floor_cm")
    if glove is None:
        mu, sd = priors.HAND_LENGTH_CM
        hand = Estimate(mu, sd, _prior_prov("hand length"))
        glove = Choice(pack.glove_from_hand_length(mu), hand.prov)
        at_prior.append("glove")
    if flight is None:
        flight = Choice(max(priors.FLIGHT, key=priors.FLIGHT.__getitem__), _prior_prov("flight"))
        at_prior.append("flight")
    if tempo is None:
        tempo = Choice(max(priors.TEMPO, key=priors.TEMPO.__getitem__), _prior_prov("tempo"))
        at_prior.append("tempo")
    lie = e.lie or _lie(ev, height.value, wtf.value, o)
    return InputEstimates(
        e.swing_bucket,
        e.speed,
        e.swing_prov,
        e.score_bucket,
        flight,
        tempo,
        glove,
        hand,
        height,
        wtf,
        lie,
        tuple(at_prior),
    )


def estimate_inputs(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    options: MappingOptions = DEFAULT_OPTIONS,
    fill_priors: bool = False,
) -> InputEstimates:
    """Best source per field (plan §3.3), with σ and provenance. With `fill_priors`, fields
    outside the minimum set that nobody has measured come from population priors and are listed
    in `at_prior`."""
    ev = evidence or FitEvidence()
    o = options
    p = ev.phone
    swing = _swing(intake, ev, o)
    glove = _glove(intake, ev)
    height = _body(
        ev,
        "height_cm",
        intake.height_cm,
        o.height_self_bias_cm,
        o.height_self_sd_cm,
        "height_photo_cm",
        p.height_photo_cm if p else None,
        p.body_photo_quality if p else None,
        o.height_photo_sd_cm,
    )
    wtf = _body(
        ev,
        "wrist_to_floor_cm",
        intake.wrist_to_floor_cm,
        0.0,
        o.wtf_self_sd_cm,
        "wrist_to_floor_photo_cm",
        p.wrist_to_floor_photo_cm if p else None,
        p.body_photo_quality if p else None,
        o.wtf_photo_sd_cm,
    )
    lie = _lie(ev, height.value, wtf.value, o) if height and wtf else None
    e = InputEstimates(
        swing_bucket=swing[0] if swing else None,
        speed=swing[1] if swing else None,
        swing_prov=swing[2] if swing else None,
        score_bucket=_score_bucket(intake, ev),
        flight=_flight(intake, ev, o),
        tempo=_tempo(intake, ev, o),
        glove=glove[0] if glove else None,
        hand=glove[1] if glove else None,
        height=height,
        wrist_to_floor=wtf,
        lie=lie,
    )
    return _fill_priors(e, o, ev) if fill_priors else e


def missing_minimum(intake: IntakeAnswers, evidence: FitEvidence | None = None) -> list[str]:
    """The minimum set a result needs at all (plan §3.4 gate `needs_info`)."""
    ev = evidence or FitEvidence()
    have = {
        "age": intake.age is not None,
        "sex": intake.sex is not None,
        "handedness": intake.handedness is not None,
        "score_bucket": _score_bucket(intake, ev) is not None,
        "swing": _swing(intake, ev, DEFAULT_OPTIONS) is not None,
    }
    return [k for k in MINIMUM_INPUTS if not have[k]]


def missing_inputs(intake: IntakeAnswers, evidence: FitEvidence | None = None) -> list[str]:
    """Required inputs that neither the intake nor the evidence supplies yet."""
    ev = evidence or FitEvidence()
    e = estimate_inputs(intake, ev)
    have = {
        "age": intake.age is not None,
        "sex": intake.sex is not None,
        "handedness": intake.handedness is not None,
        "score_bucket": e.score_bucket is not None,
        "swing": e.swing_bucket is not None,
        "flight": e.flight is not None,
        "tempo": e.tempo is not None,
        "height_cm": e.height is not None,
        "wrist_to_floor_cm": e.wrist_to_floor is not None,
        "glove": e.glove is not None,
    }
    return [k for k in REQUIRED_INPUTS if not have[k]]


def answers_from_estimates(intake: IntakeAnswers, e: InputEstimates) -> MappedAnswers:
    """MappedAnswers from complete estimates (all fields present)."""
    assert e.swing_bucket is not None and e.swing_prov is not None
    assert e.score_bucket and e.flight and e.tempo and e.glove and e.height and e.wrist_to_floor
    prov: dict[str, Provenance] = {
        "score_bucket": e.score_bucket.prov,
        "swing_bucket": e.swing_prov,
        "flight": e.flight.prov,
        "tempo": e.tempo.prov,
        "glove": e.glove.prov,
        "height_cm": e.height.prov,
        "wrist_to_floor_cm": e.wrist_to_floor.prov,
    }
    for name in ("age", "sex", "handedness", "characteristics"):
        prov[name] = Provenance(source="questionnaire")
    if e.lie is not None:
        prov["lie"] = e.lie.prov
    return MappedAnswers.model_validate(
        {
            "age": intake.age,
            "sex": intake.sex,
            "score_bucket": e.score_bucket.value,
            "swing_bucket": e.swing_bucket,
            "characteristics": intake.characteristics[:3],
            "flight": e.flight.value,
            "tempo": e.tempo.value,
            "height_cm": e.height.value,
            "wrist_to_floor_cm": e.wrist_to_floor.value,
            "glove": e.glove.value,
            "handedness": intake.handedness,
            "rounds_per_year": intake.rounds_per_year,
            "provenance": prov,
            "lie_override_deg": e.lie.value if e.lie else None,
            "est_7i_speed_mph": e.speed.value if e.speed else None,
            "est_hand_length_cm": e.hand.value if e.hand and "glove" not in e.at_prior else None,
        }
    )


def build_answers(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    options: MappingOptions = DEFAULT_OPTIONS,
    fill_priors: bool = False,
) -> MappedAnswers:
    """The rules' inputs from everything we know, best source first, with provenance.

    Raises MissingInputsError when a required input has no source. With `fill_priors`, only the
    minimum set is required and the rest falls back to population priors (provenance says so).
    """
    ev = evidence or FitEvidence()
    missing = missing_minimum(intake, ev) if fill_priors else missing_inputs(intake, ev)
    if missing:
        raise MissingInputsError(missing)
    return answers_from_estimates(intake, estimate_inputs(intake, ev, options, fill_priors))
