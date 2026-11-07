"""v1 priors and error rates (plan §3.4): one global prior per field, measured on the train split.

A field nobody has measured yet is drawn from its prior, so missing data lowers confidence on its
own. Wave 2 replaces these with per-sex priors from `scripts/gen_priors.py` (`priors.json`, #29).
Pure constants: no I/O.
"""

from __future__ import annotations

# Continuous fields: (mean, sd) over train golfers.
SPEED_MPH = (72.24, 9.56)
HEIGHT_CM = (175.96, 8.83)
WRIST_TO_FLOOR_CM = (87.43, 4.80)
HAND_LENGTH_CM = (19.00, 1.09)

# Discrete fields: population shares (train `needed_flight`, `true_tempo`).
FLIGHT = {"mid": 0.640, "high": 0.229, "low": 0.131}
TEMPO = {"moderate": 0.567, "smooth": 0.250, "quick": 0.182}

# How often a source gets a discrete field wrong.
FLIGHT_WRONG = {"questionnaire": 0.412, "landing_angle": 0.095}
# Questionnaire glove vs true glove on train: exact, one size off, two or more off.
GLOVE_OFF_BY = (0.631, 0.294, 0.075)

# Lie (degrees): true need minus the static chart on true body values (train sd 1.00), and the
# error of each evidence reading on its own.
LIE_DELIVERY_SD = 1.0
BALL_LINE_READING_SD = 1.27
OWN_7I_LIE_READING_SD = 0.84

# Self-reported discrete answers: P(true value | reported value) on train. Score: 85% report about
# 2.5 strokes better than their average, so a reported bucket is often one too low. Tempo answers
# are right 79% for "moderate" but about half the time for "quick" / "smooth". (The plan put these
# in Wave 2; v1 calibration on dev showed head and shaft-model shares running 6-12 points high
# without them.)
SCORE_BUCKET_GIVEN_REPORTED: dict[int, dict[int, float]] = {
    1: {1: 0.481, 2: 0.505, 3: 0.014},
    2: {1: 0.002, 2: 0.417, 3: 0.579, 4: 0.003},
    3: {2: 0.005, 3: 0.571, 4: 0.423},
    4: {3: 0.012, 4: 0.706, 5: 0.282},
    5: {4: 0.017, 5: 0.983},
}
TEMPO_GIVEN_REPORTED: dict[str, dict[str, float]] = {
    "moderate": {"moderate": 0.785, "quick": 0.087, "smooth": 0.127},
    "quick": {"moderate": 0.429, "quick": 0.493, "smooth": 0.078},
    "smooth": {"moderate": 0.391, "quick": 0.032, "smooth": 0.577},
}
