"""Regenerate the synthetic TrackMan CSV samples in this folder (L6, plan §6.6). Offline only.

    uv run --project backend python fixtures/trackman/generate.py

Reads the pack's `data/demo/shots.csv` (read-only) and writes one TrackMan-style export per persona
and club: TrackMan headers from `event_kit/trackman_column_map.csv`, a units row, and **absolute**
Dynamic Lie (62 deg + the pack's toe-up), as a real TrackMan export would show it. Mikko also gets
one combined test-club file with a `Club` column, to exercise grouping. All data is synthetic.
"""

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026"
OUT = Path(__file__).resolve().parent
PERSONAS = {"DEMO-01": "Mikko", "DEMO-04": "Lars", "DEMO-13": "Anders"}
SHORT = {
    "own_7i": "own_7i",
    "takomo_101-mkii_kbs-tour-lite-regular_std": "test_101",
    "takomo_201-mkii_kbs-tour-regular_std": "test_201",
}
UNITS = {
    "club_speed_mph": "[mph]", "ball_speed_mph": "[mph]", "smash_factor": "",
    "spin_rate_rpm": "[rpm]", "carry_yd": "[yds]", "total_yd": "[yds]", "side_yd": "[yds]",
    "apex_yd": "[yds]", "impact_offset_mm": "[mm]", "impact_height_mm": "[mm]",
}  # fmt: skip
STANDARD_LIE = 62.0


def main() -> None:
    cmap = list(csv.DictReader((PACK / "event_kit/trackman_column_map.csv").open()))
    shots = list(csv.DictReader((PACK / "data/demo/shots.csv").open()))
    cols = [r["pack_column"] for r in cmap]
    names = [r["trackman_metric"] for r in cmap]
    units = [UNITS.get(c, "[deg]") for c in cols]

    def row(s: dict[str, str]) -> list[str]:
        out = []
        for c in cols:
            v = s[c]
            if c == "impact_toe_up_deg" and v != "":
                v = f"{STANDARD_LIE + float(v):.1f}"  # absolute, like real TrackMan
            out.append(v)
        return out

    for gid, name in PERSONAS.items():
        mine = [s for s in shots if s["golfer_id"] == gid]
        player = f"Simulated - {name}"
        for club, short in SHORT.items():
            rows = [s for s in mine if s["club"] == club]
            with (OUT / f"{gid}_{short}.csv").open("w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["Player", "Shot", *names])
                w.writerow(["", "", *units])
                for s in rows:
                    w.writerow([player, s["shot_no"], *row(s)])
        if gid == "DEMO-01":
            rows = [s for s in mine if s["club"] != "own_7i"]
            with (OUT / f"{gid}_test_clubs.csv").open("w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["Player", "Club", "Shot", *names])
                w.writerow(["", "", "", *units])
                for s in rows:
                    w.writerow([player, s["club"], s["shot_no"], *row(s)])


if __name__ == "__main__":
    main()
