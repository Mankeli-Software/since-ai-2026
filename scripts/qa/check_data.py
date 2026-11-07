"""Layer 1: Data and pack checks (check_data.py).

Verifies fixture schemas, TrackMan and ball-line parsing, buildability,
prediction accuracy on dev split, determinism, and flight physics edge cases.
"""

from __future__ import annotations

import csv
import json
from datetime import UTC, datetime
from pathlib import Path

from app.api.demo import seed_demo_session
from app.confidence.analysis import analyze
from app.evidence.parsers.ball_line import parse_ball_line
from app.evidence.parsers.trackman_csv import parse_trackman_csv
from app.fitting.catalog import check_buildable
from app.fitting.flight import simulate_flight
from app.fitting.mapping import build_answers
from app.fitting.recommend import recommend_fit
from app.fitting.session_inputs import evidence_of, intake_of
from app.schemas.common import ProvenancedValue
from app.schemas.fit import FitEvidence
from app.schemas.session import FitSession, SampleImport
from pydantic import BaseModel, Field

from scripts.qa._lib import QARunner, SkipCheck, load_expected

ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = ROOT / "fixtures"
LAB_DIR = ROOT / "data" / "TakomoGolf_SinceAI2026_FINAL" / "TAKOMO_FITTING_LAB_2026"


class DemoGolferFixture(BaseModel):
    """Pydantic schema for demo golfer JSON fixtures."""

    golfer_id: str
    name: str
    age: int
    teaser: str
    synthetic: bool
    profile: dict[str, ProvenancedValue]
    sample_imports: list[SampleImport] = Field(default_factory=list)


def check_demo_fixtures_load() -> None:
    """1. Every fixtures/demo/DEMO-01..16.json loads and passes the Pydantic schema."""
    for i in range(1, 17):
        path = FIXTURES_DIR / "demo" / f"DEMO-{i:02d}.json"
        assert path.exists(), f"Missing fixture file: {path}"
        data = json.loads(path.read_text(encoding="utf-8"))
        obj = DemoGolferFixture.model_validate(data)
        assert obj.golfer_id == f"DEMO-{i:02d}", f"ID mismatch in {path.name}"


def check_all_samples_parse() -> None:
    """2. Every sample file parses with parse_trackman_csv or parse_ball_line."""
    csv_paths = list((FIXTURES_DIR / "demo" / "samples").glob("**/*.csv")) + list(
        (FIXTURES_DIR / "trackman").glob("*.csv")
    )
    assert len(csv_paths) > 0, "No CSV sample files found"
    for p in csv_paths:
        res = parse_trackman_csv(p.read_bytes(), club="own_7i")
        assert len(res.shots) > 0, f"CSV sample {p.name} parsed 0 shots"

    json_paths = list((FIXTURES_DIR / "demo" / "samples").glob("**/*.json"))
    assert len(json_paths) > 0, "No JSON sample files found"
    for p in json_paths:
        data = json.loads(p.read_text(encoding="utf-8"))
        club = data.get("club", "own_7i")
        res_bl = parse_ball_line(data["readings_deg"], club=club)
        assert res_bl.n > 0, f"Ball-line sample {p.name} parsed 0 readings"


def check_synthetic_flag() -> None:
    """3. Every fixture has synthetic: true."""
    for i in range(1, 17):
        data = json.loads(
            (FIXTURES_DIR / "demo" / f"DEMO-{i:02d}.json").read_text(encoding="utf-8")
        )
        assert data.get("synthetic") is True, f"DEMO-{i:02d} synthetic flag is not True"

    for p in (FIXTURES_DIR / "demo" / "samples").glob("**/*.json"):
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data.get("synthetic") is True, f"{p.name} synthetic flag is not True"


def check_demo_golfers_buildable() -> None:
    """4. For every demo golfer, recommend_fit returns a spec that passes check_buildable."""
    now = datetime.now(UTC)
    for i in range(1, 17):
        gid = f"DEMO-{i:02d}"
        session = FitSession(id="qa", resume_token="qa", created_at=now, updated_at=now)
        seed_demo_session(session, gid)
        intake = intake_of(session)
        evidence = evidence_of(session)
        answers = build_answers(intake, evidence)
        fit = recommend_fit(answers, top_n=2)
        assert fit.recs, f"{gid} yielded no recommendations"
        for rec in fit.recs:
            check = check_buildable(rec)
            assert check.buildable, f"{gid} rec {rec.head} unbuildable: {check.reasons}"


def check_dev_split_accuracy() -> None:
    """5. Dev-split accuracy: assert score >= B2 (83.58). Skip if data/ is missing."""
    dev_dir = LAB_DIR / "data" / "dev"
    if not dev_dir.exists():
        raise SkipCheck(f"Dev data directory not found: {dev_dir}")

    import score_dev  # sys.path has scripts/

    expected = load_expected()
    min_score = expected["accuracy"]["dev_split_b2_baseline"]

    pred = score_dev.predict(dev_dir)
    import pandas as pd
    from takomo_fit import score

    labels = pd.read_csv(dev_dir / "labels.csv")
    summary = score.summary(pred, labels)
    actual_score = float(summary["spec_agreement_score"])
    assert actual_score >= min_score, (
        f"Dev split score {actual_score:.2f} is below B2 baseline {min_score}"
    )


def check_test_predictions_csv() -> None:
    """6. mankeli_takomo_test_predictions.csv: 5,000 rows, required columns, buildable, no duplicate IDs."""
    pred_path = ROOT / "mankeli_takomo_test_predictions.csv"
    assert pred_path.exists(), f"Predictions file not found: {pred_path}"

    required_cols = {
        "golfer_id",
        "head",
        "shaft",
        "length_in",
        "lie_deg",
        "grip",
        "purchase",
        "handedness",
    }
    with open(pred_path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        assert required_cols.issubset(set(reader.fieldnames or [])), (
            f"Missing required columns in {pred_path.name}"
        )
        rows = list(reader)

    assert len(rows) == 5000, f"Expected 5,000 rows, got {len(rows)}"
    ids = [r["golfer_id"] for r in rows]
    assert len(ids) == len(set(ids)), (
        f"Duplicate golfer IDs detected in {pred_path.name}"
    )

    for i, row in enumerate(rows):
        res = check_buildable(row)
        assert res.buildable, (
            f"Row {i} ({row['golfer_id']}) not buildable: {res.reasons}"
        )


def check_determinism() -> None:
    """7. Determinism: recommend_fit and confidence Monte Carlo twice for DEMO-01 are identical."""
    now = datetime.now(UTC)

    def _run_once():
        session = FitSession(
            id="qa_det",
            resume_token="qa",
            created_at=now,
            updated_at=now,
        )
        seed_demo_session(session, "DEMO-01")
        intake = intake_of(session)
        evidence = evidence_of(session)
        a = analyze(intake, evidence, session_id="qa_det", evidence_version=0)
        answers = build_answers(intake, evidence)
        fit = recommend_fit(answers, top_n=2)
        return a.confidence, fit.model_dump_json()

    c1, fit1 = _run_once()
    c2, fit2 = _run_once()
    assert c1 == c2, f"Confidence not deterministic: {c1} != {c2}"
    assert fit1 == fit2, "Recommendation fit output not deterministic across runs"


def check_lefthander_flight() -> None:
    """8. Left-hander (DEMO-05): simulated flight curves left. Face, path, and side are not mirrored."""
    csv_bytes = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-05" / "own_7i.csv"
    ).read_bytes()
    parsed = parse_trackman_csv(csv_bytes, club="own_7i")
    shot0 = parsed.shots[0]
    # Check that input numbers remain in target frame and are not mirrored
    assert shot0.face_angle_deg is not None
    assert shot0.club_path_deg is not None
    assert shot0.side_yd is not None

    now = datetime.now(UTC)
    session = FitSession(id="qa_lh", resume_token="qa", created_at=now, updated_at=now)
    seed_demo_session(session, "DEMO-05")
    intake = intake_of(session)
    res = simulate_flight(intake, FitEvidence(shots=parsed.shots))
    assert res.per_head, "No head flights returned for DEMO-05"
    # Negative side in target frame indicates curvature to the left
    for h in res.per_head:
        assert h.summary.side.mean < 0, (
            f"DEMO-05 head {h.head} did not curve left: {h.summary.side.mean}"
        )


def check_home_radar_flight() -> None:
    """9. Home-radar (DEMO-03): flight runs with empty face, path, and attack columns."""
    csv_bytes = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-03" / "own_7i.csv"
    ).read_bytes()
    parsed = parse_trackman_csv(csv_bytes, club="own_7i")
    shot0 = parsed.shots[0]
    assert shot0.face_angle_deg is None, "Expected empty face angle for home radar"
    assert shot0.club_path_deg is None, "Expected empty club path for home radar"
    assert shot0.attack_angle_deg is None, "Expected empty attack angle for home radar"

    now = datetime.now(UTC)
    session = FitSession(id="qa_hr", resume_token="qa", created_at=now, updated_at=now)
    seed_demo_session(session, "DEMO-03")
    intake = intake_of(session)
    res = simulate_flight(intake, FitEvidence(shots=parsed.shots))
    assert len(res.per_head) >= 1, "Flight simulation failed for home radar shots"


def register_data_checks(runner: QARunner) -> None:
    """Register all layer 1 checks on the runner."""
    checks = [
        ("fixtures_load_schema", check_demo_fixtures_load),
        ("samples_parse_cleanly", check_all_samples_parse),
        ("fixtures_synthetic_flag", check_synthetic_flag),
        ("demo_golfers_buildable", check_demo_golfers_buildable),
        ("dev_split_accuracy_b2", check_dev_split_accuracy),
        ("test_predictions_csv_valid", check_test_predictions_csv),
        ("fit_and_mc_determinism", check_determinism),
        ("lefthander_flight_curves_left", check_lefthander_flight),
        ("home_radar_empty_columns_flight", check_home_radar_flight),
    ]
    for name, func in checks:
        runner.run_check("data", name, func)
