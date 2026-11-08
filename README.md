# Takomo Fitter Studio

Takomo Fitter Studio is an AI golf iron fitter. It applies official Takomo fitting rules, calculates fit confidence, and explains trade-offs honestly.

Team **Mankeli** created this project for the **Since AI Hackathon 2026** (Takomo Golf Challenge: *The Fitter in Your Pocket*).

> **Note on data:** All golfer profiles and shot data in this demo are synthetic.

- **Hosted Application:** [https://fitteri.mankelisolutions.fi](https://fitteri.mankelisolutions.fi)
- **Instant Scripted Walkthrough:** [studio.html?engine=scripted&demo=DEMO-01](https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01)

---

## Try the Studio

Start a new session from scratch:

- [Start My Own Fitting (Scripted Intake)](https://fitteri.mankelisolutions.fi/studio.html?engine=scripted): Answer conversational intake questions with your own numbers.

Or test with four simulated golfer personas:

- [Mikko (DEMO-01)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-01): Experienced golfer. Claims 160 yd carry. Imports TrackMan CSV data. Shows candid ego-carry detection, rising fit confidence, precision follow-up, and 201T MKII recommendation.
- [Hannu (DEMO-09)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-09): Submits home ball-line test data. Shows rough lie evidence fusion and an honest simulator recommendation before ordering.
- [Lars (DEMO-04)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-04): Compares high-skill irons. Shows clear trade-offs between 301 CB (forgiveness) and 301 MB (workability).
- [Anders (DEMO-13)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-13): Evaluates a +1° lie recommendation. Compares a stock set (30-day return policy) against a custom build (non-returnable).

---

## 60-Second Tour

Run the studio with the scripted engine for an instant walkthrough:
[https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01](https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01)

The scripted tour replays turns without API calls. It shows the conversation, data import, confidence updates, and 3D club inspection.

---

## Key Features

1. **Shows its working:** Every specification includes a plain-language reason and clear provenance (questionnaire, body measurements, or launch monitor shots).
2. **Radical honesty:** The fitter recommends stock sets when close to protect 30-day return rights. It detects ego-carry claims and recommends simulator verification instead of guessing lie angles.
3. **Deterministic math, LLM phrasing:** Deterministic tools compute all club specifications, ball flight physics, and confidence scores. The language model only formats conversational responses.
4. **Generative UI:** The chat interface embeds interactive cards (sentence intake, carry slider, TrackMan import, 3D clubs, and trajectory graphs).
5. **Zero-key offline mode:** A fully functional scripted engine runs locally and in production without API keys or token usage.

---

## Zero-Key Local Run

Run the entire application locally without API keys:

```sh
just setup
just dev
```

Open `http://localhost:8889/studio.html?engine=scripted&demo=DEMO-01` in your browser.

- **Backend API:** `http://localhost:8888`
- **Frontend App:** `http://localhost:8889`
- **Health check:** `curl http://localhost:8888/api/health`

---

## Accuracy Validation

The Mankeli Fitter scores **86.19** on the competition dev split (3,000 golfers). It exceeds both organiser baselines: B1 (77.10) and B2 (83.58).

Spec agreement uses the organiser's weighted scoring formula from `takomo_fit.score`. The table below lists per-part match rates:

| Part (weight) | Mankeli Fitter | Baseline B2 | Baseline B1 |
|---|---|---|---|
| **Spec agreement score** | **86.19** | 83.58 | 77.10 |
| Full spec exact match | 32.9% | 25.3% | 13.7% |
| Head (20) | 92.4% | 92.5% | 91.8% |
| Flex (20) | 89.4% | 85.0% | 71.6% |
| Material (10) | 96.6% | 94.3% | 88.3% |
| Shaft model (5) | 77.7% | 71.4% | 61.6% |
| Length (12) | 92.9% | 86.5% | 87.4% |
| Lie (15) | 58.0% | 55.5% | 41.3% |
| Grip (8) | 86.5% | 85.5% | 80.5% |
| Purchase (5) | 90.2% | 90.6% | 87.6% |
| Handedness (5) | 100.0% | 100.0% | 100.0% |

The largest improvements occur in flex (+4.4%), length (+6.4%), and lie (+2.5%). Lie remains the most difficult variable at 58.0%. The studio requests measured shots to confirm lie decisions.

### Reproduce Dev Score (Offline)

```sh
# Run Mankeli Fitter scoring on the dev split
just score

# Run organiser baselines for comparison
PYTHONPATH=vendor:data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026 uv run --project backend \
  python data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/examples/baselines.py \
  --data data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/data/dev
```

Official competition predictions file: [`mankeli_takomo_test_predictions.csv`](mankeli_takomo_test_predictions.csv) (5,000 buildable test rows).

---

## Verification & QA Harness

The project includes an automated verification harness in `scripts/qa/`. It tests the application against organiser data, API schemas, persona flows, and trust constraints with zero API keys:

```sh
just qa                   # Run all QA layers
just qa --layer data      # Run data and pack checks
just qa --layer api       # Run API contract checks
just qa --layer personas  # Run persona end-to-end checks
just qa --layer trust     # Run safety and trust checks
```

| Layer | Verification Scope |
|---|---|
| **Data** | Fixture schemas, TrackMan CSV parsing, ball-line parsing, buildable specifications, dev score validation, and determinism. |
| **API** | HTTP route contracts, status codes, payload structures, and error handling. |
| **Personas** | End-to-end flows for Mikko, Hannu, Lars, and Anders; SSE event sequences; and confidence gate transitions. |
| **Trust** | Privacy guarantees (no email leaks), safe message content (no raw HTML or URLs), no raw CSV storage, and layer import boundaries. |

Current harness status: **38 of 39 checks pass**. The single failure tracks `POST /api/tinker` warm latency (~146 ms vs 100 ms target). It remains active until optimized.

See [`scripts/qa/README.md`](scripts/qa/README.md) for full details and the manual browser checklist.

---

## Architecture & Code Boundaries

The backend enforces strict unidirectional layer dependencies via `import-linter`:

```text
api          HTTP routes and adapters (network I/O layer)
agent        LLM orchestration, tool wrappers, vision extraction
confidence   Monte Carlo simulation, close call detection, gates, precision follow-up (pure)
fitting      Spec mapping, recommendations, flight physics, tinker logic (pure)
evidence     TrackMan/ball-line parsers, plausibility checks, fusion (pure)
pack         Official vendor rules wrapper (boundary to vendor/takomo_fit)
schemas      Pydantic data models and interfaces (no internal dependencies)
```

- `backend/app/pack/` is the sole importer of `vendor/takomo_fit`.
- `backend/app/agent/` is the sole importer of LLM libraries (`genkit` / `anthropic`).

---

## Deliverables & Documentation

- **Video Walkthrough:** TODO(Matti): add link to YouTube walkthrough video
- **Video Walkthrough Script:** [`docs/video_script.md`](docs/video_script.md)
- **One-Page Write-Up:** [`docs/writeup/mankeli-one-pager.pdf`](docs/writeup/mankeli-one-pager.pdf)
- **Test Predictions CSV:** [`mankeli_takomo_test_predictions.csv`](mankeli_takomo_test_predictions.csv)
- **Implementation Plan:** [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- **Product Vision:** [`docs/VISION.md`](docs/VISION.md)
- **QA Harness Guide:** [`scripts/qa/README.md`](scripts/qa/README.md)

---

## Known Limits

- **In-memory session store:** Active sessions persist in server memory. A server restart clears active sessions.
- **Desktop-first design:** The studio layout is optimized for 1440x900 and 1280x800 desktop displays. A responsive mobile view is functional.
- **Irons focus:** Fitting scope focuses on irons. A teaser card indicates upcoming driver fitting.

---

## Challenge Summary

```text
Buying golf clubs online should not mean choosing blindly. In a fitting studio, a skilled professional asks the
right questions, interprets a player's swing and explains why a particular setup makes sense. Online, that
experience can disappear into a questionnaire and a recommendation that feels like a black box. Takomo Golf
challenges you to make expert-level fitting guidance feel personal, understandable and accessible wherever a
golfer happens to be. Could an intelligent digital fitter interpret a player's needs, explain trade-offs between
equipment choices and give confidence without pretending every answer is certain? This is a chance to combine
recommendation systems, conversational AI, explainability, sporting data and genuinely thoughtful consumer
experience design. The opportunity is global: help golfers navigate complex equipment decisions without requiring
a physical showroom in every country. If you love building products where AI meets human intuition,
personalisation and a passionate community, this challenge lets you turn technical intelligence into an experience
people can trust.
```
