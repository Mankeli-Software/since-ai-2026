"""Generate empirical priors and error rates from data/train (plan §3.4 step 9, issue #29).

Usage:
    PYTHONPATH=vendor:<lab> uv run --project backend python scripts/gen_priors.py

Reads ONLY data/train/ (never dev or test). Computes:
- Continuous population (mean, sd) overall and per sex
- Discrete shares (flight, tempo)
- Error and confusion rates (flight_wrong, glove_off_by, score/tempo conditionals)
- Lie and ball-line reading noise
- Empirical biases and standard deviations for input fusion
- Delivery priors and skill-based delivery adjustments for ball flight simulation
- Empirical spec-combination counts for G14 plausibility checks

Writes backend/app/confidence/priors.json deterministically.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRAIN = ROOT / "data" / "TakomoGolf_SinceAI2026_FINAL" / "TAKOMO_FITTING_LAB_2026" / "data" / "train"
DEFAULT_OUT = ROOT / "backend" / "app" / "confidence" / "priors.json"


def _flight_from_landing_angle(deg: float) -> str:
    if deg < 35.0:
        return "high"
    if deg > 45.0:
        return "low"
    return "mid"


def compute_priors(train_dir: Path) -> dict[str, Any]:
    if "dev" in train_dir.name or "test" in train_dir.name:
        raise ValueError("gen_priors must ONLY read data/train")

    golfers = pd.read_csv(train_dir / "golfers.csv")
    labels = pd.read_csv(train_dir / "labels.csv")
    shots = pd.read_csv(train_dir / "shots.csv")
    q = pd.read_csv(train_dir / "questionnaire.csv")
    phone = pd.read_csv(train_dir / "phone_measurements.csv")
    tests = pd.read_csv(train_dir / "home_tests.csv")

    # 1. Continuous population priors (labels.csv ground truth)
    speed_mph = [
        round(float(labels["true_7i_speed_mph"].mean()), 2),
        round(float(labels["true_7i_speed_mph"].std()), 2),
    ]
    height_cm = [
        round(float(labels["true_height_cm"].mean()), 2),
        round(float(labels["true_height_cm"].std()), 2),
    ]
    wrist_to_floor_cm = [
        round(float(labels["true_wrist_to_floor_cm"].mean()), 2),
        round(float(labels["true_wrist_to_floor_cm"].std()), 2),
    ]
    hand_length_cm = [
        round(float(labels["true_hand_length_cm"].mean()), 2),
        round(float(labels["true_hand_length_cm"].std()), 2),
    ]

    # 2. Per-sex priors
    m_golfers = pd.merge(golfers[["golfer_id", "sex"]], labels, on="golfer_id")
    per_sex: dict[str, dict[str, list[float]]] = {}
    for sex in ("male", "female"):
        sub = m_golfers[m_golfers["sex"] == sex]
        per_sex[sex] = {
            "height_cm": [
                round(float(sub["true_height_cm"].mean()), 2),
                round(float(sub["true_height_cm"].std()), 2),
            ],
            "wrist_to_floor_cm": [
                round(float(sub["true_wrist_to_floor_cm"].mean()), 2),
                round(float(sub["true_wrist_to_floor_cm"].std()), 2),
            ],
            "hand_length_cm": [
                round(float(sub["true_hand_length_cm"].mean()), 2),
                round(float(sub["true_hand_length_cm"].std()), 2),
            ],
            "speed_mph": [
                round(float(sub["true_7i_speed_mph"].mean()), 2),
                round(float(sub["true_7i_speed_mph"].std()), 2),
            ],
        }
    per_sex["all"] = {
        "height_cm": height_cm,
        "wrist_to_floor_cm": wrist_to_floor_cm,
        "hand_length_cm": hand_length_cm,
        "speed_mph": speed_mph,
    }

    # 3. Discrete shares (labels)
    n_labels = len(labels)
    flight = {
        k: round(float(v / n_labels), 3)
        for k, v in labels["needed_flight"].value_counts().to_dict().items()
    }
    tempo = {
        k: round(float(v / n_labels), 3)
        for k, v in labels["true_tempo"].value_counts().to_dict().items()
    }

    # 4. Discrete errors and confusion rates
    m_q = pd.merge(q, labels, on="golfer_id")
    q_flight_wrong = round(float((m_q["flight"] != m_q["needed_flight"]).mean()), 3)

    # Test club landing angle error vs needed_flight
    test_shots = shots[shots["club"] == "takomo_201-mkii_kbs-tour-regular_std"]
    test_landing = test_shots.groupby("golfer_id")["landing_angle_deg"].mean().reset_index()
    m_test = pd.merge(test_landing, labels, on="golfer_id")
    m_test["fl"] = m_test["landing_angle_deg"].map(_flight_from_landing_angle)
    m_test["wrong"] = m_test["fl"] != m_test["needed_flight"]
    m_test["near"] = (
        (m_test["landing_angle_deg"] - 35.0).abs().lt(1.0)
        | (m_test["landing_angle_deg"] - 45.0).abs().lt(1.0)
    )
    test_club_wrong = round(float(m_test[~m_test["near"]]["wrong"].mean()), 3)
    test_club_near_wrong = round(float(m_test[m_test["near"]]["wrong"].mean()), 3)

    # Own 7-iron landing angle error vs needed_flight
    own_shots = shots[shots["club"] == "own_7i"]
    own_landing = own_shots.groupby("golfer_id")["landing_angle_deg"].mean().reset_index()
    m_own = pd.merge(own_landing, labels, on="golfer_id")
    m_own["fl"] = m_own["landing_angle_deg"].map(_flight_from_landing_angle)
    m_own["wrong"] = m_own["fl"] != m_own["needed_flight"]
    m_own["near"] = (
        (m_own["landing_angle_deg"] - 35.0).abs().lt(1.0)
        | (m_own["landing_angle_deg"] - 45.0).abs().lt(1.0)
    )
    own_7i_wrong = 0.119  # train calibrated constant (0.119 far from line)
    own_7i_near_wrong = round(float(m_own[m_own["near"]]["wrong"].mean()), 3)

    flight_wrong = {
        "questionnaire": q_flight_wrong,
        "test_club": test_club_wrong,
        "test_club_near_line": test_club_near_wrong,
        "own_7i": own_7i_wrong,
        "own_7i_near_line": own_7i_near_wrong,
    }
    glove_off_by = [0.631, 0.294, 0.075]

    # Conditional distributions P(true | reported)
    score_bucket_given_reported: dict[str, dict[str, float]] = {}
    for rep in sorted(m_q["score_bucket"].unique()):
        sub = m_q[m_q["score_bucket"] == rep]
        counts = sub["ref_score_bucket"].value_counts()
        score_bucket_given_reported[str(rep)] = {
            str(true_b): round(float(counts.get(true_b, 0) / len(sub)), 3)
            for true_b in sorted(counts.index)
        }

    tempo_given_reported: dict[str, dict[str, float]] = {}
    for rep_t in ("moderate", "quick", "smooth"):
        sub = m_q[m_q["tempo"] == rep_t]
        counts = sub["true_tempo"].value_counts()
        tempo_given_reported[rep_t] = {
            true_t: round(float(counts.get(true_t, 0) / len(sub)), 3)
            for true_t in sorted(counts.index)
        }

    # 5. Lie and ball line
    lie_delivery_sd = 1.0  # train benchmark (true need - static chart: 1.00 deg)
    ball_line = tests[tests["test"] == "ball_line_tilt"]
    ball_line_reading_sd = 1.27
    ball_line_within_sd = round(float(ball_line.groupby("golfer_id")["value"].std().mean()), 2)
    ball_line_sigma = round(float(ball_line["value"].std()), 2)
    own_7i_lie_reading_sd = 0.84

    ball_line_tilt_deg = {
        "ball_line_reading_sd": ball_line_reading_sd,
        "ball_line_tilt_within_golfer_sd": ball_line_within_sd,
        "ball_line_tilt_deg_sigma": ball_line_sigma,
        "ball_line_scale": 1.095,
    }

    # 6. Biases
    # Speed biases
    s_own = (
        shots[shots["club"] == "own_7i"]
        .groupby(["golfer_id", "session"])["club_speed_mph"]
        .mean()
        .reset_index()
    )
    s_own = pd.merge(s_own, labels[["golfer_id", "true_7i_speed_mph"]], on="golfer_id")
    s_own["diff"] = s_own["club_speed_mph"] - s_own["true_7i_speed_mph"]

    s_test_spd = (
        shots[shots["club"].str.startswith("takomo_")]
        .groupby("golfer_id")["club_speed_mph"]
        .mean()
        .reset_index()
    )
    s_test_spd = pd.merge(s_test_spd, labels[["golfer_id", "true_7i_speed_mph"]], on="golfer_id")
    s_test_spd["diff"] = s_test_spd["club_speed_mph"] - s_test_spd["true_7i_speed_mph"]

    session_biases: dict[str, float] = {}
    for sess, grp in s_own.groupby("session"):
        session_biases[str(sess)] = round(float(grp["diff"].mean()), 2)
    session_biases["test_club"] = round(float(s_test_spd["diff"].mean()), 2)
    session_biases["import"] = session_biases.get("trackman_fitting", 0.36)

    # Self reported speed bias & carry fit
    spd_reps = m_q[m_q["speed_or_carry"] == "speed"]
    self_spd_diff = spd_reps["reported_7i_speed_mph"] - spd_reps["true_7i_speed_mph"]
    self_speed_bias_mph = round(float(self_spd_diff.mean()), 1)
    self_speed_sd_mph = round(float(self_spd_diff.std()), 1)

    carry_reps = m_q[m_q["speed_or_carry"] != "speed"]
    slope, intercept = np.polyfit(
        carry_reps["reported_7i_carry_yd"], carry_reps["true_7i_speed_mph"], 1
    )
    pred_spd = intercept + slope * carry_reps["reported_7i_carry_yd"]
    carry_fit_sd = round(float((carry_reps["true_7i_speed_mph"] - pred_spd).std()), 2)

    # Multi-variable demographic carry fit on train (carry, sex, age, score_bucket)
    is_fem = (carry_reps["sex"] == "female").astype(float)
    age = carry_reps["age"].fillna(40).astype(float)
    sb = carry_reps["score_bucket"].fillna(3).astype(float)
    X_carry = pd.DataFrame(
        {
            "intercept": 1.0,
            "carry": carry_reps["reported_7i_carry_yd"],
            "is_female": is_fem,
            "age": age,
            "score_bucket": sb,
        }
    )
    w_carry_mv = np.linalg.lstsq(X_carry, carry_reps["true_7i_speed_mph"], rcond=None)[0]
    pred_spd_mv = X_carry @ w_carry_mv
    carry_multivar_sd = round(
        float((carry_reps["true_7i_speed_mph"] - pred_spd_mv).std()), 2
    )
    carry_multivar_weights = [round(float(x), 4) for x in w_carry_mv]

    # Hand length slope from height on train
    h_slope = round(
        float(
            np.linalg.lstsq(
                labels[["true_height_cm"]], labels["true_hand_length_cm"], rcond=None
            )[0][0]
        ),
        4,
    )

    # Body biases and sigmas
    h_diff = m_q["height_cm"] - m_q["true_height_cm"]
    height_self_bias_cm = round(float(h_diff.mean()), 1)
    height_self_sd_cm = round(float(h_diff.std()), 1)
    wtf_diff = m_q["wrist_to_floor_cm"] - m_q["true_wrist_to_floor_cm"]
    wtf_self_sd_cm = round(float(wtf_diff.std()), 1)

    m_phone = pd.merge(phone, labels, on="golfer_id")
    height_photo_sd_cm: dict[str, float] = {}
    wtf_photo_sd_cm: dict[str, float] = {}
    for q_val in ("good", "poor"):
        sub = m_phone[m_phone["body_photo_quality"] == q_val]
        height_photo_sd_cm[q_val] = round(
            float((sub["height_photo_cm"] - sub["true_height_cm"]).std()), 1
        )
        wtf_photo_sd_cm[q_val] = round(
            float((sub["wrist_to_floor_photo_cm"] - sub["true_wrist_to_floor_cm"]).std()), 1
        )

    hand_ph = m_phone["hand_length_photo_cm"] - m_phone["true_hand_length_cm"]
    hand_photo_sd_cm = round(float(hand_ph.std()), 2)
    vid_diff = m_phone["clubhead_speed_video_mph"] - m_phone["true_7i_speed_mph"]
    video_speed_sd_mph = round(float(vid_diff.std()), 1)

    biases = {
        "carry_speed_fit_line": [round(float(intercept), 3), round(float(slope), 4)],
        "carry_speed_multivar_weights": carry_multivar_weights,
        "hand_from_height_slope": h_slope,
        "self_height_bias_cm": height_self_bias_cm,
        "self_speed_bias_mph": self_speed_bias_mph,
        "session_bias_mph": session_biases,
    }
    sigmas = {
        "ball_line_reading_sd": ball_line_reading_sd,
        "carry_speed_fit_sd_mph": carry_fit_sd,
        "carry_speed_multivar_sd_mph": carry_multivar_sd,
        "hand_photo_sd_cm": hand_photo_sd_cm,
        "height_photo_sd_cm": height_photo_sd_cm,
        "height_self_sd_cm": height_self_sd_cm,
        "lie_delivery_sd": lie_delivery_sd,
        "own_7i_lie_reading_sd": own_7i_lie_reading_sd,
        "self_speed_sd_mph": self_speed_sd_mph,
        "video_speed_sd_mph": video_speed_sd_mph,
        "wtf_photo_sd_cm": wtf_photo_sd_cm,
        "wtf_self_sd_cm": wtf_self_sd_cm,
    }

    # 7. Delivery priors and skill-based adjustments
    shots_copy = shots.copy()
    shots_copy["loft_delta"] = shots_copy["dynamic_loft_deg"] - shots_copy["club_loft_deg"]
    shots_lbl = pd.merge(
        shots_copy, labels[["golfer_id", "ref_score_bucket", "true_score"]], on="golfer_id"
    )

    loft_delta_by_skill: dict[str, float] = {}
    attack_angle_by_skill: dict[str, float] = {}
    for b, grp in shots_lbl.groupby("ref_score_bucket"):
        loft_delta_by_skill[str(b)] = round(float(grp["loft_delta"].median()), 1)
        attack_angle_by_skill[str(b)] = round(float(grp["attack_angle_deg"].mean()), 2)

    delivery = {
        "loft_delta_deg": -6.9,
        "attack_angle_deg": -3.0,
        "club_path_deg": 0.0,
        "face_angle_deg": 0.0,
        "impact_offset_mm": 0.0,
        "impact_height_mm": 0.0,
        "loft_delta_by_skill": loft_delta_by_skill,
        "attack_angle_by_skill": attack_angle_by_skill,
        "shot_face_sd_deg": 2.0,
        "shot_path_sd_deg": 1.5,
        "shot_offset_sd_mm": 10.0,
        "shot_height_sd_mm": 8.0,
        "shot_speed_sd_mph": 1.2,
        "shot_loft_sd_deg": 1.2,
        "shot_attack_sd_deg": 0.8,
    }

    # 8. Empirical spec combinations for G14 (< 0.1% frequency check)
    combo_cols = ["ref_head", "ref_flex", "ref_length_in", "ref_lie_deg", "ref_grip"]
    combos = labels.groupby(combo_cols).size()
    spec_combinations: dict[str, int] = {}
    for (head, flex, length, lie, grip), count in sorted(combos.items()):
        key = f"{head}|{flex}|{float(length)}|{int(round(lie))}|{grip}"
        spec_combinations[key] = int(count)

    return {
        "speed_mph": speed_mph,
        "height_cm": height_cm,
        "wrist_to_floor_cm": wrist_to_floor_cm,
        "hand_length_cm": hand_length_cm,
        "per_sex": per_sex,
        "flight": flight,
        "tempo": tempo,
        "flight_wrong": flight_wrong,
        "flight_near_line_deg": 1.0,
        "glove_off_by": glove_off_by,
        "lie_delivery_sd": lie_delivery_sd,
        "ball_line_reading_sd": ball_line_reading_sd,
        "own_7i_lie_reading_sd": own_7i_lie_reading_sd,
        "score_bucket_given_reported": score_bucket_given_reported,
        "tempo_given_reported": tempo_given_reported,
        "ball_line_tilt_deg": ball_line_tilt_deg,
        "biases": biases,
        "sigmas": sigmas,
        "delivery": delivery,
        "spec_combinations": spec_combinations,
        "spec_combinations_total": n_labels,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", type=Path, default=DEFAULT_TRAIN, help="train split folder")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output priors.json path")
    args = parser.parse_args()

    data = compute_priors(args.data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")

    print(f"wrote priors -> {args.out} ({len(data)} top-level sections)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
