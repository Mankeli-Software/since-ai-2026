# Synthetic TrackMan CSV samples (L6)

**All data here is synthetic.** No real TrackMan shots were captured. Each file is generated from the
organiser pack's `data/demo/shots.csv` by `generate.py`, in the shape of a TrackMan CSV export:
TrackMan headers (`event_kit/trackman_column_map.csv`), a units row, and **absolute** Dynamic Lie
(62° + the pack's toe-up), as real TrackMan reports it. The `Player` column says "Simulated".

| File | Club | Shots |
|---|---|---|
| `DEMO-01_own_7i.csv` (Mikko) | `own_7i` | 10 (124.7 yd mean carry, 72 mph) |
| `DEMO-01_test_101.csv` / `_test_201.csv` | 101 MKII / 201 MKII test clubs | 6 / 8 |
| `DEMO-01_test_clubs.csv` | both test clubs, grouped by its `Club` column | 14 |
| `DEMO-04_*` (Lars), `DEMO-13_*` (Anders) | own 7-iron + both test clubs | 10 / 6 / 8 |

Per-club files have no `Club` column: pick the club in `data_import` (sent as the `club` form field).
