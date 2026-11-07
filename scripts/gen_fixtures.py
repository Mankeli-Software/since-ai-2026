"""Generate demo fixtures and sample imports for demo personas.

Reads only demo/ questionnaire.csv, golfers.csv, shots.csv, home_tests.csv,
and event_kit/trackman_column_map.csv.
Never reads labels.csv or phone_measurements.csv (plan §6.6, L16).
Outputs:
  fixtures/demo/DEMO-01.json .. DEMO-16.json
  fixtures/demo/samples/<golfer_id>/<sample_id>.csv (.json for ball_line)
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "TakomoGolf_SinceAI2026_FINAL" / "TAKOMO_FITTING_LAB_2026"
DEMO_DIR = DATA_DIR / "data" / "demo"
EVENT_KIT_DIR = DATA_DIR / "event_kit"
FIXTURES_DIR = ROOT / "fixtures" / "demo"
SAMPLES_DIR = FIXTURES_DIR / "samples"

TRACKMAN_HEADERS = [
    "Shot",
    "Club",
    "Club Speed",
    "Attack Angle",
    "Dynamic Loft",
    "Club Path",
    "Face Angle",
    "Face To Path",
    "Ball Speed",
    "Smash Factor",
    "Launch Angle",
    "Launch Direction",
    "Spin Rate",
    "Spin Axis",
    "Carry",
    "Total",
    "Side",
    "Height",
    "Landing Angle",
    "Impact Offset",
    "Impact Height",
    "Dynamic Lie",
]

TRACKMAN_UNITS = [
    "",
    "",
    "mph",
    "deg",
    "deg",
    "deg",
    "deg",
    "deg",
    "mph",
    "",
    "deg",
    "deg",
    "rpm",
    "deg",
    "yds",
    "yds",
    "yds",
    "yds",
    "deg",
    "mm",
    "mm",
    "deg",
]

# Safe teasers for the four L8 personas (plan §6.6, web/src/features/personas/personas.ts).
# Never use story from golfers.csv because it leaks reference specs and true lie need.
SAFE_TEASERS = {
    "DEMO-01": "Says his 7-iron goes 160 yards. Has TrackMan data.",
    "DEMO-09": "The chart says standard lie. His ball-line test disagrees.",
    "DEMO-04": "Low handicapper who wants a forged head.",
    "DEMO-13": "Almost a stock set. Almost.",
}

VALID_CHARACTERISTICS = {
    "forgiveness",
    "distance",
    "forged feel",
    "distance control",
    "workability",
    "less offset",
    "more offset",
}

CLUB_SAMPLE_CONFIGS = [
    ("own_7i", "own_7i", "Own 7-iron TrackMan CSV"),
    (
        "takomo_201-mkii_kbs-tour-regular_std",
        "takomo_201",
        "Takomo 201 MKII test-club CSV",
    ),
    (
        "takomo_101-mkii_kbs-tour-lite-regular_std",
        "takomo_101",
        "Takomo 101 MKII test-club CSV",
    ),
]


def _build_safe_teaser(row: dict[str, str]) -> str:
    hand = "Right-handed" if row.get("handedness") == "right" else "Left-handed"
    score_label = row.get("score_label", "average score").lower()
    score_part = f"shoots {score_label}"
    if row.get("reported_7i_carry_yd"):
        carry = round(float(row["reported_7i_carry_yd"]))
        stat_part = f"carries 7-iron {carry} yd."
    elif row.get("reported_7i_speed_mph"):
        speed = round(float(row["reported_7i_speed_mph"]))
        stat_part = f"swings 7-iron {speed} mph."
    else:
        stat_part = "looking for irons."
    return f"{hand}, {score_part}, {stat_part}"


def _format_dynamic_lie(toe_up_str: str) -> str:
    """TrackMan Dynamic Lie is absolute (plan §5.1, Issue #30).

    impact_toe_up_deg is relative to 62.0° standard lie.
    Dynamic Lie = 62.0 + impact_toe_up_deg.
    """
    if not toe_up_str.strip():
        return ""
    val = float(toe_up_str)
    return f"{round(62.0 + val, 1):.1f}"


def _write_csv_sample(out_path: Path, club: str, shots: list[dict[str, str]]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(TRACKMAN_HEADERS)
        writer.writerow(TRACKMAN_UNITS)
        for s in shots:
            row = [
                s.get("shot_no", ""),
                club,
                s.get("club_speed_mph", ""),
                s.get("attack_angle_deg", ""),
                s.get("dynamic_loft_deg", ""),
                s.get("club_path_deg", ""),
                s.get("face_angle_deg", ""),
                s.get("face_to_path_deg", ""),
                s.get("ball_speed_mph", ""),
                s.get("smash_factor", ""),
                s.get("launch_angle_deg", ""),
                s.get("launch_direction_deg", ""),
                s.get("spin_rate_rpm", ""),
                s.get("spin_axis_deg", ""),
                s.get("carry_yd", ""),
                s.get("total_yd", ""),
                s.get("side_yd", ""),
                s.get("apex_yd", ""),
                s.get("landing_angle_deg", ""),
                s.get("impact_offset_mm", ""),
                s.get("impact_height_mm", ""),
                _format_dynamic_lie(s.get("impact_toe_up_deg", "")),
            ]
            writer.writerow(row)


def main() -> None:
    # 1. Load questionnaires
    questionnaires: dict[str, dict[str, str]] = {}
    with (DEMO_DIR / "questionnaire.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            questionnaires[row["golfer_id"]] = row

    # 2. Load golfers
    golfers: dict[str, dict[str, str]] = {}
    with (DEMO_DIR / "golfers.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            golfers[row["golfer_id"]] = row

    # 3. Load shots grouped by (golfer_id, club)
    shots_by_golfer: dict[str, dict[str, list[dict[str, str]]]] = {}
    with (DEMO_DIR / "shots.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            gid = row["golfer_id"]
            c = row["club"]
            shots_by_golfer.setdefault(gid, {}).setdefault(c, []).append(row)

    # 4. Load home tests
    ball_line_by_golfer: dict[str, list[float]] = {}
    with (DEMO_DIR / "home_tests.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("test") == "ball_line_tilt":
                gid = row["golfer_id"]
                val = float(row["value"])
                ball_line_by_golfer.setdefault(gid, []).append(val)

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    for i in range(1, 17):
        gid = f"DEMO-{i:02d}"
        q = questionnaires[gid]
        g = golfers[gid]

        persona_str = g.get("persona", f"Golfer {i}")
        name = persona_str.split(",")[0].strip()
        age = int(q["age"])

        teaser = SAFE_TEASERS.get(gid) or _build_safe_teaser(q)

        # Build profile matching IntakeAnswers fields
        raw_chars = [c.strip() for c in q["characteristics"].split("|")]
        filtered_chars = [c for c in raw_chars if c in VALID_CHARACTERISTICS][:3]

        profile: dict[str, dict[str, Any]] = {
            "age": {"value": age, "source": "questionnaire"},
            "sex": {"value": q["sex"], "source": "questionnaire"},
            "handedness": {"value": q["handedness"], "source": "questionnaire"},
            "rounds_per_year": {
                "value": q["rounds_per_year"],
                "source": "questionnaire",
            },
            "score_bucket": {
                "value": int(q["score_bucket"]),
                "source": "questionnaire",
            },
            "characteristics": {"value": filtered_chars, "source": "questionnaire"},
            "flight": {"value": q["flight"], "source": "questionnaire"},
            "tempo": {"value": q["tempo"], "source": "questionnaire"},
            "height_cm": {"value": float(q["height_cm"]), "source": "questionnaire"},
            "wrist_to_floor_cm": {
                "value": float(q["wrist_to_floor_cm"]),
                "source": "questionnaire",
            },
            "glove": {"value": q["glove"], "source": "questionnaire"},
            "glove_was_guessed": {
                "value": q["glove_was_guessed"].strip().lower() == "true",
                "source": "questionnaire",
            },
        }

        if q.get("reported_7i_speed_mph"):
            profile["reported_7i_speed_mph"] = {
                "value": float(q["reported_7i_speed_mph"]),
                "source": "questionnaire",
            }
        if q.get("reported_7i_carry_yd"):
            profile["reported_7i_carry_yd"] = {
                "value": float(q["reported_7i_carry_yd"]),
                "source": "questionnaire",
            }

        # Build sample imports
        sample_imports: list[dict[str, Any]] = []

        # Check TrackMan shots
        golfer_shots = shots_by_golfer.get(gid, {})
        for club_key, sample_id, label in CLUB_SAMPLE_CONFIGS:
            if club_key in golfer_shots:
                shots = golfer_shots[club_key]
                csv_path = SAMPLES_DIR / gid / f"{sample_id}.csv"
                _write_csv_sample(csv_path, club_key, shots)
                sample_imports.append(
                    {
                        "sample_id": sample_id,
                        "kind": "trackman_csv",
                        "club": club_key,
                        "label": label,
                    }
                )

        # Check Ball-line test (DEMO-09 Hannu)
        if gid in ball_line_by_golfer:
            readings = ball_line_by_golfer[gid]
            json_path = SAMPLES_DIR / gid / "ball_line.json"
            json_path.parent.mkdir(parents=True, exist_ok=True)
            ball_line_data = {
                "readings_deg": readings,
                "club": "own_7i",
                "synthetic": True,
            }
            json_path.write_text(
                json.dumps(ball_line_data, indent=2) + "\n", encoding="utf-8"
            )
            label = (
                "Hannu's 5 ball-line readings"
                if gid == "DEMO-09"
                else f"{name}'s ball-line readings"
            )
            sample_imports.append(
                {
                    "sample_id": "ball_line",
                    "kind": "ball_line",
                    "club": "own_7i",
                    "label": label,
                }
            )

        fixture_data = {
            "golfer_id": gid,
            "name": name,
            "age": age,
            "teaser": teaser,
            "synthetic": True,
            "profile": profile,
            "sample_imports": sample_imports,
        }

        fixture_file = FIXTURES_DIR / f"{gid}.json"
        fixture_file.write_text(
            json.dumps(fixture_data, indent=2) + "\n", encoding="utf-8"
        )
        print(
            f"Wrote {fixture_file.relative_to(ROOT)} with {len(sample_imports)} samples."
        )


if __name__ == "__main__":
    main()
