"""Write the test-split predictions CSV (plan §12).

    just preds                                   # data/test -> mankeli_takomo_test_predictions.csv
    just preds --data <lab>/data/dev --out /tmp/dev_preds.csv   # also scores dev
    just preds --mapping b2                      # the B2 insurance file instead

`--mapping app` (default) is the app's own `fitting.mapping.build_answers` + `recommend_fit`,
via `scripts/score_dev.py`. `--mapping b2` wraps the organisers' B2 baseline
(`examples.baselines.predict`). The committed file is replaced only when `just score` on dev
beats the number it was made with.

The file is checked before it is written: one row per golfer in the split, required columns,
and every row buildable (an unbuildable spec or a missing golfer scores 0).
If the split has a labels.csv (dev), the predictions are scored too.

Run through `just preds`, which puts `vendor/` and the lab root on PYTHONPATH.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
from examples import baselines
from takomo_fit import score

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "data" / "TakomoGolf_SinceAI2026_FINAL" / "TAKOMO_FITTING_LAB_2026"
DEFAULT_OUT = ROOT / "mankeli_takomo_test_predictions.csv"


def predict_b2(d: Path) -> pd.DataFrame:
    return baselines.predict(
        pd.read_csv(d / "questionnaire.csv"),
        pd.read_csv(d / "phone_measurements.csv"),
        pd.read_csv(d / "shots.csv"),
        pd.read_csv(d / "home_tests.csv"),
    )


def predict_app(d: Path) -> pd.DataFrame:
    """The app's own build_answers + recommend_fit (scripts/score_dev.py): dev 86.19 vs B2 83.58."""
    import score_dev  # scripts/ is on sys.path when this script runs

    return score_dev.predict(d)


MAPPINGS = {"app": predict_app, "b2": predict_b2}


def validate(pred: pd.DataFrame, golfer_ids: pd.Series) -> list[str]:
    """Problems that would cost points; empty when the file is safe to submit."""
    problems = []
    p = score.clean(pred)  # raises on missing columns or duplicate golfer_ids
    expected, got = set(golfer_ids), set(p["golfer_id"])
    if missing := expected - got:
        problems.append(f"{len(missing)} golfers missing, e.g. {sorted(missing)[:3]}")
    if extra := got - expected:
        problems.append(f"{len(extra)} golfers not in the split, e.g. {sorted(extra)[:3]}")
    bad = p.loc[~score.buildable(p), "golfer_id"]
    if len(bad):
        problems.append(f"{len(bad)} unbuildable rows, e.g. {bad.head(3).tolist()}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--mapping", choices=sorted(MAPPINGS), default="app")
    ap.add_argument("--data", type=Path, default=LAB / "data" / "test", help="split folder")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    a = ap.parse_args()

    golfer_ids = pd.read_csv(a.data / "questionnaire.csv")["golfer_id"]
    pred = MAPPINGS[a.mapping](a.data)
    if problems := validate(pred, golfer_ids):
        print("not written:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1

    a.out.parent.mkdir(parents=True, exist_ok=True)
    pred.to_csv(a.out, index=False)
    print(f"wrote {len(pred)} rows ({a.mapping}, {a.data.name}) -> {a.out}")

    labels = a.data / "labels.csv"
    if labels.exists():
        s = score.summary(pred, pd.read_csv(labels))
        print(json.dumps({k: s[k] for k in ("spec_agreement_score", "component_pct")}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
