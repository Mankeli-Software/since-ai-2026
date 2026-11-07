"""Main entry point for the QA test harness (run_all.py).

Usage:
    python scripts/qa/run_all.py                      # run all layers
    python scripts/qa/run_all.py --layer data         # run layer 1 only
    python scripts/qa/run_all.py --layer api          # run layer 2 only
    python scripts/qa/run_all.py --layer personas     # run layer 3 only
    python scripts/qa/run_all.py --layer trust        # run layer 4 only
    python scripts/qa/run_all.py --url http://...     # against external server
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure repo root and vendor/backend are on sys.path
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "vendor") not in sys.path:
    sys.path.insert(0, str(ROOT / "vendor"))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from scripts.qa._lib import QARunner, format_summary_table, write_github_summary
from scripts.qa.check_api import register_api_checks
from scripts.qa.check_data import register_data_checks
from scripts.qa.check_personas import register_persona_checks
from scripts.qa.check_trust import register_trust_checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Takomo Fitter Studio QA harness")
    parser.add_argument(
        "--layer",
        choices=["all", "data", "api", "personas", "trust"],
        default="all",
        help="Which QA layer to execute (default: all)",
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Base URL of running server (e.g. http://localhost:8080). Defaults to in-process TestClient.",
    )
    args = parser.parse_args()

    print(f"=== Takomo Fitter Studio QA Harness (layer={args.layer}) ===")
    runner = QARunner(selected_layer=args.layer, base_url=args.url)

    if runner.should_run("data"):
        print("\n--- Running Layer 1: Data and Pack ---")
        register_data_checks(runner)

    if runner.should_run("api"):
        print("\n--- Running Layer 2: API Contract ---")
        register_api_checks(runner)

    if runner.should_run("personas"):
        print("\n--- Running Layer 3: Persona End-to-End ---")
        register_persona_checks(runner)

    if runner.should_run("trust"):
        print("\n--- Running Layer 4: Trust and Safety ---")
        register_trust_checks(runner)

    print("\n=== QA Summary ===")
    table = format_summary_table(runner.results)
    print(table)

    write_github_summary(runner.results)

    failures = [r for r in runner.results if r.status == "FAIL"]
    if failures:
        print(f"\nCompleted with {len(failures)} failure(s).")
        for f in failures:
            print(f"  FAIL [{f.layer}] {f.name}: {f.message}")
        return 1

    print("\nAll executed checks passed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
