# Takomo Fitter Studio

Takomo Fitter Studio is an AI golf iron fitter. It runs Takomo's own rules, shows fit confidence, and explains trade-offs honestly.

All golfer data in the demo is synthetic.

Hosted application: [https://fitteri.mankelisolutions.fi](https://fitteri.mankelisolutions.fi)

## Try as Personas

You can try the live demo with four simulated golfer personas:

- [Mikko (DEMO-01)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-01): 160 yd carry claim, TrackMan import, ego-carry check, precision follow-up.
- [Hannu (DEMO-09)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-09): Home ball-line test, rough evidence, simulator recommendation.
- [Lars (DEMO-04)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-04): Close call between 301 CB and 301 MB with trade-offs.
- [Anders (DEMO-13)](https://fitteri.mankelisolutions.fi/studio.html?demo=DEMO-13): Stock set with 30-day return versus custom non-returnable build.

## 60-Second Tour

Run the studio with the scripted engine for an instant walkthrough:
[https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01](https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01)

The scripted tour replays turns with zero API calls. It shows the conversation, data import, confidence updates, and the 3D club reveal.

## Zero-Key Local Run

You can run the full project locally without API keys:

```sh
just setup
just dev
```

Open `http://localhost:8889/studio.html?engine=scripted&demo=DEMO-01` in your browser.

## Architecture

- **Pack boundary:** The backend wraps Takomo's official rules engine (`takomo_fit`) in `backend/app/pack`. The core logic never rewrites fitting rules.
- **Deterministic math, LLM phrasing:** Deterministic tools compute every spec, distance, trajectory, and confidence score. The language model only phrases explanations and converses with the user.
- **Layer contract:** The system enforces strict architectural layers: API routes -> agent -> confidence -> fitting -> evidence -> pack -> schemas.
- **Generated UI:** Interactive Gen-UI blocks pause the turn loop and resume cleanly when the user responds.

## Accuracy Validation

The fitter scores **86.19** on the dev split (3,000 golfers), against the organiser baselines B1 (77.10) and B2 (83.58).
Spec agreement is the organiser's weighted score from `takomo_fit.score`; the rows below are per-part match rates.

| Part (weight) | Mankeli Fitter | Baseline B2 | Baseline B1 |
|---|---|---|---|
| **Spec agreement score** | **86.19** | 83.58 | 77.10 |
| Full spec exactly right | 32.9% | 25.3% | 13.7% |
| Head (20) | 92.4% | 92.5% | 91.8% |
| Flex (20) | 89.4% | 85.0% | 71.6% |
| Material (10) | 96.6% | 94.3% | 88.3% |
| Shaft model (5) | 77.7% | 71.4% | 61.6% |
| Length (12) | 92.9% | 86.5% | 87.4% |
| Lie (15) | 58.0% | 55.5% | 41.3% |
| Grip (8) | 86.5% | 85.5% | 80.5% |
| Purchase (5) | 90.2% | 90.6% | 87.6% |
| Handedness (5) | 100.0% | 100.0% | 100.0% |

Most of the gain is in flex, length and lie. Head and purchase are level with B2 (within 0.4 points).
Lie is still the weakest part at 58.0%: questionnaire and phone answers say little about how the club meets the ground,
which is why the studio asks for measured shots.

Reproduce (dev split, offline scoring, not a test):

```sh
just score    # Mankeli Fitter: scripts/score_dev.py -> takomo_fit.score
# Baselines: the organiser's examples/baselines.py
PYTHONPATH=vendor:data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026 uv run --project backend \
  python data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/examples/baselines.py \
  --data data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/data/dev
```

Predictions file for competition scoring: `mankeli_takomo_test_predictions.csv` (5,000 buildable test rows).

## Verification Against the Data

`scripts/qa/` is a manual check harness. It runs the app against the organiser's data and the 16 synthetic demo golfers. It needs no API keys.

```sh
just qa                   # all layers
just qa --layer data      # or: api, personas, trust
```

| Layer | What it checks |
|---|---|
| Data | Demo fixtures and TrackMan CSVs parse. Every spec is buildable. Dev score beats baseline B2. The predictions CSV has 5,000 buildable rows. Results are repeatable. |
| API | Every route returns the expected shape. Bad input gives a clear error. |
| Personas | Mikko, Hannu, Lars and Anders run end to end. For Mikko, the TrackMan import raises confidence and the best head is the 201T MKII. |
| Trust | No email in sessions, no URLs or HTML in chat, raw CSVs are not stored, no forbidden imports. |

Last run on `main`: **38 of 39 checks pass.** The one failure is real. `POST /api/tinker` takes about 150 ms on a warm request. The target is 100 ms. The check stays in the harness until this is fixed.

You can also run it from GitHub: Actions tab, workflow **qa**, **Run workflow**. This workflow is manual only. It does not run on pull requests or merges. See [`scripts/qa/README.md`](scripts/qa/README.md) for details and the manual browser checklist.

## Known Limits

- **Memory session store:** The demo uses an in-memory session store. A server restart clears active sessions.
- **Desktop first:** The studio is designed and checked at 1440x900 and 1280x800. A phone layout (below 768px) ships too, with less polish than desktop.

## Deliverables

- **Video walkthrough:** TODO(Matti): add link to YouTube walkthrough video
- **One-page write-up:** [docs/writeup/mankeli-one-pager.pdf](docs/writeup/mankeli-one-pager.pdf)
- **Test predictions:** [`mankeli_takomo_test_predictions.csv`](mankeli_takomo_test_predictions.csv)

---

## Challenge Summary

```
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
