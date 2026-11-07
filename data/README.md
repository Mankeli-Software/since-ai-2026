# data/ — inventory and where things are

Reference for agents and teammates working on **The Fitter in Your Pocket** (Takomo Golf challenge, Since AI Hackathon 2026, Turku, 6–8 Nov 2026). Read this before digging through the folders.

**Key facts**

- Everything here came from the organisers or Takomo. **No real customer data, and no video or images.** All golfers are synthetic.
- Total size is about 48 MB, nearly all of it CSV.
- `data/` is **tracked in git**. Treat it as read-only input: don't edit files in place. Put derived outputs somewhere else.
- Paths below are relative to `data/TakomoGolf_SinceAI2026_FINAL/`. The lab folder is abbreviated as `LAB/` = `TAKOMO_FITTING_LAB_2026/`.

```
data/
├── docs/
│   ├── 2025-02_Takomo_Brand_Book_public_version_compressed.pdf   Takomo brand book (public, 31 slides)
│   └── 2025-02_Takomo_Brand_Book_public_version_compressed.md    markdown copy of the brand book
└── TakomoGolf_SinceAI2026_FINAL/
    ├── Since_AI_Challenge_Brief_Takomo_Golf.docx   Takomo's challenge brief
    ├── Takomo_swing_analysis_data_assessment.md    our own analysis (6 Nov), not from organisers
    └── TAKOMO_FITTING_LAB_2026/                    organiser lab v1.1.0: synthetic data + code + docs  ← main thing
```

## 1. Top-level files

| File | What it is | When to use it |
|---|---|---|
| `Since_AI_Challenge_Brief_Takomo_Golf.docx` | The official brief: problem (the questionnaire isn't trusted), guiding question, suggested AI approaches, **judging criteria** (trust and usability 35 %, idea 25 %, accuracy 20 %, feasibility and business impact 20 %), what to submit (PoC demo, one-page write-up, repo with README). Contact: Jonas Koisti, jonas@takomogolf.com. | Framing, pitch, checking scope against what's being judged. Read it with `textutil -convert txt -stdout <file>` on macOS. |
| `Takomo_swing_analysis_data_assessment.md` | Our team's write-up: what the pack has, how accurate each evidence signal is, open datasets (CaddieSet, GolfDB…), proposed architecture (MediaPipe pose → features → fusion model), work plan, Saturday TrackMan plan. | Quick orientation and signal-quality numbers without recomputing them. |

## 2. `TAKOMO_FITTING_LAB_2026/` (the lab)

Entry points: `LAB/START_HERE.md` (or `.html`), then `LAB/docs/DATA_DICTIONARY.md`. `LAB/MANIFEST.csv` lists every file with its size and SHA-256.

### 2.1 Takomo product data: `LAB/takomo_official/`

These files belong to Takomo, are unchanged, and are licensed for hackathon use only (see `LAB/NOTICE`).

| File | Contents |
|---|---|
| `The_Fitter_in_Your_Pocket_Participant_Pack.pdf` | Takomo's guide to club fitting and the current online tool (the 12 questions and rules) |
| `heads.csv` (`;`-separated!) | 5 iron heads (101 MKII, 201 MKII, 201T MKII, 301 CB, 301 MB): 7-iron loft, offset, target score, distance/forgiveness/workability/feel ratings, stock shafts, default shaft |
| `shafts.csv` | 35 shaft builds by slug: model, maker, material, flex, weight, tempo profile, flight profile, compatible heads |
| `grips.csv` | 2 grips: Lamkin Standard and Midsize |
| `takomo_products.json` | The full product database in one file (also copied to `LAB/takomo_fit/data/`) |
| `SHA256SUMS` | Checksums for the files above |

### 2.2 Synthetic golfers: `LAB/data/{train,dev,test,demo}/`

28,016 golfers. `golfer_id` joins every table. Each split has the same files; `test` has **no labels**.

| Split | Golfers | Labels | Purpose |
|---|---|---|---|
| `train` | 20,000 | yes | fit models |
| `dev` | 3,000 | yes | score yourself here |
| `test` | 5,000 | **no** | optional submission, `<team>_takomo_test_predictions.csv`, scored by organisers |
| `demo` | 16 | yes | golfers with stories, for the demo and pitch |

| File | One row per | Rows (train / dev / test / demo) | Holds |
|---|---|---|---|
| `golfers.csv` | golfer | 20,000 / 3,000 / 5,000 / 16 | age, sex, handedness, rounds per year, own 7-iron loft |
| `questionnaire.csv` | golfer | same | the 12 self-reported answers, **mistakes included** (speed or carry, score bucket, flight, tempo, height, wrist-to-floor, glove…) |
| `phone_measurements.csv` | golfer | same | *simulated* phone output: height and wrist-to-floor from a photo, hand and finger length, video fps, backswing and downswing time, clubhead speed from video; blank when not captured |
| `home_tests.csv` | test shot (long format: `test, shot_no, value, unit`) | 39,805 / 6,090 / 9,860 / 50 | ball-line lie tilt, powder-spray strike location |
| `shots.csv` | launch-monitor shot | 148,538 / 22,680 / 38,812 / 260 | TrackMan-style sessions and home radar: club speed, attack angle, path, face, ball speed, spin, carry, side, apex, impact location… |
| `labels.csv` | golfer | 20,000 / 3,000 / – / 16 | **truth** (`true_*`: speed, height, hand, tempo, lie need…), **reference spec** (`ref_*`: head, runner-up head, shaft, flex, material, length, lie, grip, stock or custom, handedness), `close_call_*` flags, expected carry/side/apex per head (`exp_*_<head>`) |

Full column definitions: `LAB/docs/DATA_DICTIONARY.md`. Scorer prediction format: the end of the same file.

How much evidence each golfer has (train): body photo 70 %, hand photo 65 %, swing video 84 %, TrackMan 25 %, home radar 15 %, ball-line test 20 %. Any speed measurement 60 %, any lie measurement 40 %.

### 2.3 Code: `LAB/takomo_fit/` (Python package, `pip install numpy pandas`)

| Module | What it does |
|---|---|
| `baseline.py` | Today's Takomo fitting tool as code (5 Nov rules: speed-points table, over-92 cap, forgiveness penalty, midsize-as-stock). **This is the rules engine our recommender uses.** |
| `physics.py` | Calibrated 7-iron ball-flight model (carry, spin, apex) |
| `score.py` | Spec Agreement Score 0–100: `python -m takomo_fit.score --pred preds.csv --labels data/dev/labels.csv` |
| `products.py` | Loads the product database |
| `data/static_fit_chart.csv` | PING-style static chart: height + wrist-to-floor → length and lie |
| `data/takomo_products.json` | Copy of Takomo's product file |

Score weights: head 20, flex 20, material 10, shaft model 5, length 12, lie 15, grip 8, stock or custom 5, handedness 5.

Baselines (dev split): **B1** today's tool on self-reports, 77.1 (13.7 % of specs fully right). **B2** same rules with phone and launch-monitor evidence, 83.6 (25.3 %). Oracle, 100. Lie is the weakest component: B1 gets it right for 41 % of golfers.

### 2.4 Other lab folders

| Path | Contents |
|---|---|
| `LAB/camera/` | `measurement_sheet_A4.pdf` (printable ArUco scale sheet) and code: `measure.py` (height, wrist-to-floor, hand and finger length), `tempo.py` (backswing and downswing from pose), `ball_line.py` (lie from the ball-line photo), `sheet.py`, `make_sheet_pdf.py`. Needs `opencv-contrib-python`, `reportlab`. |
| `LAB/examples/` | `quickstart.py` (load data, run baseline, score, show one golfer) and `baselines.py --data data/dev` (B1 and B2) |
| `LAB/docs/` | `DATA_DICTIONARY.md`, `SIMULATOR.md` (how the data was generated, assumptions, limitations), `BASELINE_RULES_INTERPRETATION.md` (each rule and its source), `PHONE_CAMERA_PLAYBOOK.md` (what a phone can measure and how well), `PUBLIC_RESOURCES.md` (external datasets and their licences; GolfDB is non-commercial), `EVENT_SESSION_PROTOCOL.md` (Sat 7 Nov simulator visit), `figures/` (4 PNG charts) |
| `LAB/event_kit/` | Templates for recording real data: `CONSENT_FORM.md`, `capture_sheet.csv` (per person), `shot_log.csv` (per shot, with video file names and TrackMan numbers), `trackman_column_map.csv` (TrackMan export ↔ pack column names) |
| `LAB/tests/` | pytest suite (87 tests): `python -m pytest -q tests` from `LAB/` |
| `LAB/tools/` | Organiser scripts: `calibrate_physics.py`, `make_chart.py`, `make_html.py` |
| `LAB/pyproject.toml`, `LICENSE`, `NOTICE` | Package config; code MIT, synthetic data CC BY 4.0 (© Since AI ry); Takomo files are Takomo's |

## 3. Quick lookup: "where do I find…"

| Need | Go to |
|---|---|
| Product catalogue (heads, shafts, grips) | `LAB/takomo_official/takomo_products.json` or the CSVs next to it |
| Current fitting rules | `LAB/takomo_fit/baseline.py` + `LAB/docs/BASELINE_RULES_INTERPRETATION.md` |
| Length and lie from body measurements | `LAB/takomo_fit/data/static_fit_chart.csv` |
| Training data with ground truth | `LAB/data/train/*.csv` (join on `golfer_id`) |
| Evaluate a model | `LAB/data/dev/labels.csv` + `python -m takomo_fit.score` |
| Demo personas | `LAB/data/demo/` |
| Column meanings | `LAB/docs/DATA_DICTIONARY.md` |
| How far to trust the synthetic data | `LAB/docs/SIMULATOR.md` §6 |
| Phone measurement code | `LAB/camera/` |
| Templates for logging real TrackMan sessions | `LAB/event_kit/` |
| Judging criteria and deliverables | `Since_AI_Challenge_Brief_Takomo_Golf.docx` |
| Brand colours, fonts, tone of voice | `data/docs/2025-02_Takomo_Brand_Book_public_version_compressed.md` (quick-reference table at the top) |

## 4. Caveats

- **Synthetic only.** Simulated numbers must not be presented as real golfer data in the pitch. Only one club (the 7-iron) is modelled.
- **No video or images in the pack.** Any pose or vision model needs our own recordings (Saturday's simulator session) or external data.
- `heads.csv` is semicolon-separated; the other CSVs use commas. Multi-value fields use `|` (for example `KBS Tour|KBS Tour Lite`).
- Always use lab v1.1.0 (5 Nov). Its labels differ from v1.0.0.
- Real recordings from the 7 Nov simulator visit are **not in this folder yet**. If they're added, put them in a new subfolder and document them here.
