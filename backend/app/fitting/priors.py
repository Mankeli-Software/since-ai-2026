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
# Flight from a mean landing angle is much less reliable within 1 deg of the 35 / 45 deg lines
# (train: 201 test club 33% wrong near a line vs 5% further away; own 7-iron 41% vs 12%, because
# the own club's loft is usually unknown; questionnaire 41% overall).
FLIGHT_WRONG = {
    "questionnaire": 0.412,
    "test_club": 0.050,
    "test_club_near_line": 0.334,
    "own_7i": 0.119,
    "own_7i_near_line": 0.410,
}
FLIGHT_NEAR_LINE_DEG = 1.0
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

# Delivery priors for ball flight simulation (train median/sd, plan §3.6).
LOFT_DELTA_DEG = -6.9
ATTACK_ANGLE_DEG = -3.0
CLUB_PATH_DEG = 0.0
FACE_ANGLE_DEG = 0.0
IMPACT_OFFSET_MM = 0.0
IMPACT_HEIGHT_MM = 0.0

# Shot-to-shot dispersion SDs for 200-sample Monte Carlo per head.
SHOT_FACE_SD_DEG = 2.0
SHOT_PATH_SD_DEG = 1.5
SHOT_OFFSET_SD_MM = 10.0
SHOT_HEIGHT_SD_MM = 8.0
SHOT_SPEED_SD_MPH = 1.2
SHOT_LOFT_SD_DEG = 1.2
SHOT_ATTACK_SD_DEG = 0.8
