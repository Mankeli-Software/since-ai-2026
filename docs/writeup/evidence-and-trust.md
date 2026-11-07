# Evidence and trust (write-up section draft, #53)

> All golfer data in this PoC is **synthetic** (the organiser pack's simulated golfers). No real
> TrackMan shots were captured. Every number below was measured on that synthetic data.

## Measured data replaces guesses, and the meter shows it

A golfer starts from questionnaire answers. When they import launch-monitor shots, the fit is
re-run on the measured numbers and the confidence meter (a Monte Carlo agreement estimate over
"possible truths") moves with it. Scripted demo run of Mikko (DEMO-01), own 7-iron TrackMan CSV:

| | Confidence | Gate | Flex | Lie |
|---|---|---|---|---|
| Questionnaire only | 0.65 | provisional | stiff | +2 (chart) |
| + 10 own-7-iron shots | **0.86** | **confident** | **regular** | +3 (shots fused with chart) |

Anders (DEMO-13) after 8 test-club shots: 0.78 → **0.95**, which settles his one open question,
a +1° lie.

## We check the evidence before we use it

Deterministic rules (no model judges plausibility) run on every import and every answer. The
assistant only phrases their codes and numbers:

- **Shot rules:** hard bounds, smash-factor checksum, club-speed spikes, mishits (kept for lie, left
  out of good-shot carry), carry recorded in metres, too few shots. On the clean demo data, none
  of the personas' shots are rejected.
- **Golfer rules:** unit mix-ups ("71" for height → "Did you mean 180 cm?"), impossible and rare
  values, and the **ego-carry check**: Mikko says his 7-iron goes **160 yd**, and his 10 measured
  shots average **124.7 yd** (z = 2.8). The studio shows both numbers and lets him choose, rather
  than quietly overriding him.
- **Calibrated, not guessed:** the "carry looks like metres" rule first used a speed-only carry
  line and would have questioned **16.7%** of clean sessions. Predicting carry from ball speed,
  launch and spin (fitted on the train split) brought that to **1.3%**, while still catching
  **98.4%** of the same sessions recorded in metres.
- **TrackMan detail that matters:** real TrackMan reports Dynamic Lie as an absolute angle (about
  62°), while the rules engine expects change from standard. The importer converts it
  (`dynamic lie − club lie`), or every real shot would fail the bounds.

Every answer is the golfer's: keep their number, use the measured one, or leave it out. Once
answered, a flag is never asked again.

## Honest at a cost to the sale

- **Hannu** (DEMO-09) types five ball-line readings. Fused with the sizing chart, his lie stays
  standard and uncertain, so the studio says the at-home test is rough and recommends a simulator
  session before he buys a non-returnable custom set.
- **Lars** (DEMO-04) gets a shown close call between the 301 CB and 301 MB, with trade-offs,
  instead of a confident winner.
- **Anders** (DEMO-13) is one bend (+1° lie) away from a stock set. The studio puts stock (30-day
  return) and custom (non-returnable) side by side and lets him decide.

## Privacy

Uploaded files are parsed and dropped; only the shot numbers are kept with the fitting. Strings
read from files are capped and never reach the chat. No third-party logins are collected.
