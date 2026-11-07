"""Dev-split accuracy of the app's own mapping (plan §12 step 2). Offline scoring, not a test.

    just score                                    # build_answers + recommend_fit on data/dev
    just score --strict                           # also the exact-match weighted score (§3.4)
    just score --opt carry_speed_estimate=false   # flip a mapping option (repeatable)
    just score --out /tmp/dev_preds.csv           # keep the predictions

Runs **the same** `fitting.mapping.build_answers` and `fitting.recommend.recommend_fit` the app
uses, over <data>/{questionnaire,phone_measurements,shots,home_tests,golfers}.csv, then scores
with `takomo_fit.score` against <data>/labels.csv. Tune on dev only; never on test.

`load_inputs` / `predict` are shared with `scripts/make_test_predictions.py` (`--mapping app`).
Run through `just score`, which puts `vendor/` and the lab root on PYTHONPATH.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from takomo_fit import score

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "data" / "TakomoGolf_SinceAI2026_FINAL" / "TAKOMO_FITTING_LAB_2026"
sys.path.insert(0, str(ROOT / "backend"))

from app.fitting.mapping import DEFAULT_OPTIONS, MappingOptions, build_answers  # noqa: E402
from app.fitting.recommend import recommend_fit  # noqa: E402
from app.schemas.evidence import Shot  # noqa: E402
from app.schemas.fit import FitEvidence, IntakeAnswers, PhoneMeasurements  # noqa: E402

EST_COLUMNS = ["est_7i_speed_mph", "est_height_cm", "est_wrist_to_floor_cm", "est_hand_length_cm"]


def _v(x: Any) -> Any:
    """CSV cell -> Python value (NaN -> None)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return x.item() if hasattr(x, "item") else x


def _records(df: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for row in df.to_dict("records"):
        out.setdefault(row["golfer_id"], []).append({k: _v(v) for k, v in row.items()})
    return out


def load_inputs(d: Path) -> dict[str, tuple[IntakeAnswers, FitEvidence]]:
    """One (intake, evidence) pair per golfer in a pack split folder, in questionnaire order."""
    q = pd.read_csv(d / "questionnaire.csv")
    golfers = {g: r[0] for g, r in _records(pd.read_csv(d / "golfers.csv")).items()}
    phone = {g: r[0] for g, r in _records(pd.read_csv(d / "phone_measurements.csv")).items()}
    shots = _records(pd.read_csv(d / "shots.csv"))
    tests = pd.read_csv(d / "home_tests.csv")
    tilt = _records(tests[tests["test"] == "ball_line_tilt"])

    out: dict[str, tuple[IntakeAnswers, FitEvidence]] = {}
    for r in (dict((k, _v(v)) for k, v in row.items()) for row in q.to_dict("records")):
        gid = r["golfer_id"]
        chars = [c for c in str(r["characteristics"] or "").split("|") if c]
        intake = IntakeAnswers(
            age=r["age"],
            sex=r["sex"],
            handedness=r["handedness"],
            rounds_per_year=r["rounds_per_year"],
            score_bucket=r["score_bucket"],
            reported_7i_speed_mph=r["reported_7i_speed_mph"]
            if r["speed_or_carry"] == "speed"
            else None,
            reported_7i_carry_yd=r["reported_7i_carry_yd"]
            if r["speed_or_carry"] != "speed"
            else None,
            characteristics=chars,
            flight=r["flight"],
            tempo=r["tempo"],
            height_cm=r["height_cm"],
            wrist_to_floor_cm=r["wrist_to_floor_cm"],
            glove=r["glove"],
            glove_was_guessed=bool(r["glove_was_guessed"]),
            own_7i_loft_deg=golfers.get(gid, {}).get("own_7i_loft_deg"),
        )
        evidence = FitEvidence(
            phone=PhoneMeasurements.model_validate(phone[gid]) if gid in phone else None,
            shots=[Shot.model_validate(s) for s in shots.get(gid, [])],
            ball_line_tilt_deg=[t["value"] for t in tilt.get(gid, [])],
        )
        out[gid] = (intake, evidence)
    return out


def predict(d: Path, options: MappingOptions = DEFAULT_OPTIONS) -> pd.DataFrame:
    """Prediction rows (takomo_fit.score.REQUIRED + est_* columns) for every golfer in the split."""
    rows = []
    for gid, (intake, evidence) in load_inputs(d).items():
        a = build_answers(intake, evidence, options)
        rec = recommend_fit(a, top_n=1).recs[0]
        rows.append(
            {
                "golfer_id": gid,
                "head": rec.head,
                "shaft": rec.shaft,
                "length_in": rec.length_in,
                "lie_deg": rec.lie_deg,
                "grip": rec.grip,
                "purchase": rec.purchase,
                "handedness": rec.handedness,
                "est_7i_speed_mph": a.est_7i_speed_mph,
                "est_height_cm": a.height_cm,
                "est_wrist_to_floor_cm": a.wrist_to_floor_cm,
                "est_hand_length_cm": a.est_hand_length_cm,
                "est_lie_need_deg": a.lie_override_deg,
            }
        )
    return pd.DataFrame(rows)


def strict_score(pred: pd.DataFrame, labels: pd.DataFrame) -> dict[str, Any]:
    """Exact match only (no runner-up or close-call credit), weighted with score.WEIGHTS.
    Used to calibrate the confidence model (plan §3.4 step 9)."""
    p = score.clean(pred).set_index("golfer_id")
    lab = labels.set_index("golfer_id").loc[p.index]
    built = score.buildable(p.reset_index()).to_numpy()

    def attr(slug: str, key: str) -> Any:
        try:
            return score.PR.shaft(slug)[key]
        except KeyError:
            return None

    parts = {
        "head": p["head"].eq(lab["ref_head"]),
        "flex": p["shaft"].map(lambda s: attr(s, "flex")).eq(lab["ref_flex"]),
        "material": p["shaft"].map(lambda s: attr(s, "material")).eq(lab["ref_material"]),
        "shaft_model": p["shaft"].map(lambda s: attr(s, "model")).eq(lab["ref_shaft_model"]),
        "length": (p["length_in"] - lab["ref_length_in"]).abs().lt(1e-6),
        "lie": (p["lie_deg"] - lab["ref_lie_deg"]).abs().lt(1e-6),
        "grip": p["grip"].eq(lab["ref_grip"]),
        "purchase": p["purchase"].eq(lab["ref_purchase"]),
        "handedness": p["handedness"].eq(lab["ref_handedness"]),
    }
    per = sum(parts[k].to_numpy() * built * w for k, w in score.WEIGHTS.items())
    return {
        "strict_score": round(float(per.mean()), 2),
        "component_pct": {
            k: round(float((v.to_numpy() * built).mean()) * 100, 1) for k, v in parts.items()
        },
    }


def parse_options(pairs: list[str]) -> MappingOptions:
    """`name=value` overrides of MappingOptions (bools: true/false; dicts: JSON)."""
    fields = {f.name: f for f in dataclasses.fields(MappingOptions)}
    updates: dict[str, Any] = {}
    for pair in pairs:
        name, _, raw = pair.partition("=")
        if name not in fields:
            raise SystemExit(f"unknown option {name!r}; options: {', '.join(sorted(fields))}")
        current = getattr(DEFAULT_OPTIONS, name)
        if isinstance(current, bool):
            updates[name] = raw.strip().lower() in ("1", "true", "yes", "on")
        elif isinstance(current, dict):
            updates[name] = {**current, **json.loads(raw)}
        else:
            updates[name] = type(current)(raw)
    return dataclasses.replace(DEFAULT_OPTIONS, **updates)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--data", type=Path, default=LAB / "data" / "dev", help="split folder")
    ap.add_argument("--labels", type=Path, default=None, help="default: <data>/labels.csv")
    ap.add_argument("--opt", action="append", default=[], metavar="NAME=VALUE")
    ap.add_argument("--strict", action="store_true", help="also print the exact-match score")
    ap.add_argument("--out", type=Path, default=None, help="write the predictions CSV here")
    a = ap.parse_args()

    if "test" in a.data.name:
        raise SystemExit("never score or tune on the test split")
    options = parse_options(a.opt)
    pred = predict(a.data, options)
    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        pred.to_csv(a.out, index=False)
        print(f"wrote {len(pred)} rows -> {a.out}")

    labels = pd.read_csv(a.labels or a.data / "labels.csv")
    res: dict[str, Any] = {"options": a.opt or "defaults", **score.summary(pred, labels)}
    if a.strict:
        res["strict"] = strict_score(pred, labels)
    print(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
