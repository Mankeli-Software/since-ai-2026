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

The model scores 86.19% on the dev split. It beats the organiser baselines across all categories:

| Model | Dev Accuracy | Head | Flex | Length | Lie | Grip |
|---|---|---|---|---|---|---|
| **Mankeli Fitter** | **86.19%** | 89.2% | 88.5% | 94.1% | 58.2% | 96.0% |
| Baseline B2 | 83.58% | 88.0% | 85.0% | 92.5% | 52.0% | 95.0% |
| Baseline B1 | 77.10% | 82.0% | 81.0% | 88.0% | 46.0% | 91.0% |

Lie is the weakest part at 58.2% because static questionnaires lack dynamic swing measurements.

Predictions file for competition scoring: `mankeli_takomo_test_predictions.csv` (5,000 buildable test rows).

## Known Limits

- **Memory session store:** The demo uses an in-memory session store. A server restart clears active sessions.
- **Desktop layout:** The current layout targets desktop viewports (1440x900 and 1280x800). Mobile layout is planned for the next release.

## Deliverables

- **Video walkthrough:** TODO(Matti): add link to YouTube walkthrough video
- **One-page write-up:** [docs/writeup/one-pager.md](docs/writeup/one-pager.md)
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
