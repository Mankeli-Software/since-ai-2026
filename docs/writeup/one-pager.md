# Takomo Fitter Studio — One-Page Write-Up

Team Mankeli | Since AI Hackathon 2026

## Idea

Online club fitting is broken. Today golfers answer static questionnaires and receive black-box recommendations. Many golfers do not trust the result. They drive to physical fitters or abandon purchase.

Takomo Fitter Studio brings an expert fitter to the browser. The studio pairs a conversational AI fitter with generative UI components and a 3D club stage. The assistant asks focused questions, checks evidence from launch monitors or home tests, and shows ball-flight estimates. It explains trade-offs with radical Finnish honesty.

## What the Proof of Concept Proves

The proof of concept demonstrates four core capabilities:

1. **Conversational fitting with dynamic UI:** The assistant drives the session through interactive components. It shows choice chips, sliders, TrackMan CSV uploaders, and 3D club stages.
2. **Deterministic fitting rules:** Takomo's official fitting rules run inside a strict boundary. The LLM never invents specs or numbers.
3. **Evidence-based confidence:** Monte Carlo simulation estimates fit confidence. The meter rises as the golfer provides measured shots.
4. **Radical brand honesty:** The fitter highlights close calls, points out ego-carry gaps, and compares returnable stock sets with non-returnable custom builds.

Cost per fitting: TODO(Matti): add LLM and infrastructure cost per fitting.

## Accuracy Validation

We evaluate our fitting engine on the organiser's synthetic dataset:

- **Accuracy score:** 86.19% on the dev dataset, beating baseline B2 (83.58%) and baseline B1 (77.10%).
- **Competition submission:** 5,000 buildable test predictions in `mankeli_takomo_test_predictions.csv`.
- **Lie angle insight:** Lie prediction is the hardest dimension (58.2% accuracy) from static data alone. Dynamic shot data significantly improves lie precision.
- **Flight simulation note:** Ball flight is estimated; physics is not validated by Takomo.

Validation plan for production:
- Shadow fittings: Run parallel sessions alongside Takomo professional fitters to compare recommendations.
- TrackMan validation: Test real golfer sessions across indoor simulators to verify trajectory and lie recommendations.

## How Trust Was Designed In

- **Show the work:** Every part of the recommendation features a plain-language explanation backed by rule traces.
- **Radical Finnish honesty:** The assistant shows close calls honestly. If a golfer is one degree off stock, it explains the return policy difference.
- **Plausibility rules:** Deterministic checks flag unrealistic carry numbers and unit errors. The studio asks golfers to verify their numbers rather than correcting them silently.
- **Privacy by design:** Uploaded CSV files are parsed in memory and discarded. No raw files or external credentials are stored.
- **Transparent synthetic data:** All demo personas clearly display a "Simulated golfer" badge.

## Next Steps

1. **Mobile responsive layout:** Build dedicated touch layouts for mobile browsers (65% of Takomo traffic).
2. **Shopify Dawn integration:** Embed the studio directly into the product page via app proxy and headless bridge.
3. **Camera body measurements:** Add computer vision capture for wrist-to-floor and hand measurements.
4. **Driver fitting:** Expand the studio catalog beyond irons to drivers and fairway woods.
