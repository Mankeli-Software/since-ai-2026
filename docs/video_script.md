# Demo video script: 90 seconds

**Title:** Takomo Fitter Studio: the fitter in your pocket
**Length:** 1:30 (limit 3:00). Screen walkthrough with voice-over, about 2.3 words per second.
**Wording** matches the one-page write-up (trust gap, "shows its working", honest at a cost to the sale).

## Who is in it, and why

None of the four personas is a newcomer. Mikko, Hannu, Lars and Anders all have years of golf behind
them (score buckets 2–4, 10–50+ rounds a year), and on the scripted engine each persona goes straight
to its own story without the intake questions. So:

- **Newcomer: "Start my own fitting", answered as a beginner** (scripted engine, `own.yaml`).
  It is the only scripted path with the conversational intake: tap a sentence, guess a carry, body last,
  then a stock fit with an honest "confirm it with real shots" next step. Taps are listed in shots N1–N4.
- **Experienced player: Mikko (`DEMO-01`).** Score bucket 3, 31–50 rounds a year, claims 160 yd. He has
  the most trust moments in one run: synthetic TrackMan import, the ego-carry flag he decides on,
  confidence rising, the precision follow-up, a measured lie, two close heads on the same shaft, the
  flight compare and custom (not returnable) vs stock (30 days).

## Recording setup

- **Site:** <https://fitteri.mankelisolutions.fi/>, desktop window **1440×900**, browser zoom 100%.
- **Always the scripted engine** (same flow every take, no model cost, no daily cap):
  - Newcomer: `https://fitteri.mankelisolutions.fi/studio.html?engine=scripted` → **START FITTING**
    (the link keeps `engine=scripted`; verified).
  - Mikko: `https://fitteri.mankelisolutions.fi/studio.html?engine=scripted&demo=DEMO-01`
  - Never click a link that drops `engine=scripted` mid-take: the store page's **FIND YOUR FIT** and a
    bare `studio.html` start the **live** engine (model wording changes every take).
- **Units:** yards. Before the first take, in DevTools: `localStorage.setItem('takomo_units','imperial')`.
- **Fresh tab per persona.** Sessions live in memory: a deploy wipes them (an HTTP 404 mid-take means
  restart that segment). **No merges to `main` while recording.**
- Screenshots from the verification run (local only, not committed):
  `/tmp/claude-1000/qa-browser/video-mikko*.png` and `/tmp/claude-1000/qa-browser/video-own*.png`.

## Shot table

Times are the final cut. "Cut" means edit it out (the action still has to happen on screen).

| # | Time | On screen: exact screen, clicks, typing | Voice-over | Sells |
|---|---|---|---|---|
| H1 | 0:00–0:04 | Store page `https://fitteri.mankelisolutions.fi/` (a demo copy of the Takomo home page) with the black **Fitter Studio** banner. Hold, don't click. | "Online fitting has a trust gap." | The problem (write-up §01) |
| H2 | 0:04–0:08 | Hard cut to the studio welcome (`studio.html?engine=scripted`): "LET'S FIND YOUR FIT. HONESTLY." with **START FITTING** and the "Or try as a simulated golfer" row. | "Fitter Studio is a fitter that shows its working." | Idea in one line |
| N1 | 0:08–0:15 | Click **START FITTING**. Sentence card: tap **Just started**, **just starting**, **right-handed**, **men's**, **35–44**, then **THAT'S ME**. | "New to golf? Tap a sentence. No form, no jargon." | Easy start, tap or type |
| N2 | 0:15–0:21 | Next card (round trackers): tap **I'll just tell you** straight away (don't hold on the preview numbers). Carry slider: drag down to about **130 yd**, tap **It's a guess**, then **THAT'S IT**. The recap chip reads "… yd (guess)". | "Don't know your carry? Guess. It's marked as a guess, never as fact." | Measured vs guessed is visible |
| N3 | 0:21–0:26 | **Cut** the next four cards (see Known issues): **I'll answer myself** → type `Never been in one` in the bottom composer + Enter → **SKIP FOR NOW** → **KEEP MY NUMBER**. Show only: height card **NEXT**, wrist-to-floor card **NEXT**, glove card tap **L**, **NEXT**. | "Height, wrist to floor, glove size. Nothing you can't do at home." | Body last, nothing hard to measure |
| N4 | 0:26–0:33 | Results R1. Hold on: the head name, the ticks **"Stock build fits you · Ships in 2–3 days · 30-day returns"**, the header **Fit confidence**, and the aside card **"Confirm it with real shots"** (simulator list, confidence now → after). | "A stock set fits, so you keep the thirty-day return. And it says how sure it is, and how to firm it up." | Stock lean (L25), honest confidence |
| N5 | 0:33–0:38 | Click **SEE THE REASONS →** (R2 "Why each part"). Click **LIE** in the left list: its source label should read *From your answers* or *Estimated*, not *Measured* (not verified in browser; the HEAD row read "Estimated from your answers"). Don't open the head row's aside (see Known issues). | "Every part has a plain reason, and says where it came from." | Plain-language why with sources |
| E1 | 0:38–0:42 | New tab `studio.html?engine=scripted&demo=DEMO-01`. Orange **SIMULATED GOLFER** badge, header **Fit confidence 72%**, "Terve Mikko… this fit is a working estimate." | "Mikko is a simulated golfer. He says his 7-iron goes 160." | Badge (L6), provisional start |
| E2 | 0:42–0:49 | Click **UPLOAD TRACKMAN CSV** → dialog "Pick a sample session. These are simulated sessions." → **Own 7-iron TrackMan CSV**. Confidence jumps to about **86%**. Review card: **CARRY YD MEAN 124.7**, **CLUB SPEED MPH MEDIAN 72.1**, "Your shots carry 160 yd. Expected measured 124.7 yd…". | "He brings ten synthetic TrackMan shots. The fit firms up, and the check is candid: 124.7, not 160." | Bring proof, ego-carry flag (G11), confidence rises |
| E3 | 0:49–0:52 | Tap **USE 124.7 YD**. | "He decides which number counts." | Golfer decides |
| E4 | 0:52–0:58 | Fitter: "Measured speed locked down your flex. Your lie still comes from a static chart…" → **UPLOAD TRACKMAN CSV** → **Takomo 201 MKII test-club CSV**. Results open. | "Want more precision? Test-club shots measure his lie instead of a chart." | Precision follow-up |
| E5 | 0:58–1:04 | R1: **201T MKII**, "YOUR TWO BEST HEADS, SAME SHAFT", fit scores **16** and **14**. Click the **201 MKII** card: hero, 3D and buy bar switch. Click **201T MKII** to switch back. Don't hold on the hero paragraph (Known issues). | "Two heads are close, on the same shaft. Tap one and everything follows." | Close call shown honestly, head switch (L24) |
| E6 | 1:04–1:07 | **SEE THE REASONS →** → click **LIE**: "3° UPRIGHT · Measured: test-club Dynamic Lie over 8 shots · chart +2° → evidence +3°". | "His lie is measured now, not read off a chart." | Measured lie |
| E7 | 1:07–1:10 | Tab **2 Compare heads, see it fly**: two side-view arcs, "Estimated by Takomo's physics model", carry/apex/landing tiles. | "Both heads fly for his swing, labelled as an estimate." | Flight compare, honesty about estimates |
| E8 | 1:10–1:16 | **← Your fit** → **COMPARE BUILDS →** (R5): "Only shown when custom is earned". Stock, 0°: **Returns 30 days** vs Custom +3°: **Not returnable**. Click **What if I stay stock?**: "start line shifts about 3.6 yards to the right", buy bar flips to stock. Click it again to switch back. Don't tap the aside chips. | "Custom is earned here, but it can't be returned. Stock keeps thirty days. His call." | Honest at a cost to the sale |
| R1 | 1:16–1:27 | Title cards over a dimmed studio frame, each line labelled **NEXT**: inside the Takomo store (product page, cart, myTakomo) · driver and fairway fitting · measure with your camera · screenshot and round-stats imports, TrackMan share links · shadow fittings with Takomo's fitters. | "Next: inside the Takomo store, driver fitting, your phone camera as the tape measure, screenshots and TrackMan links as proof, and shadow fittings with Takomo's own fitters." | Roadmap, clearly not built yet |
| C1 | 1:27–1:30 | Studio welcome screen, or the logo with the URL `fitteri.mankelisolutions.fi`. | "Takomo Fitter Studio. Honestly better golf." | Close |

On-screen numbers in the voice-over: 160, 124.7 and thirty days are all on screen in that shot. Don't
add a number to a line unless it is on screen at that moment. Confidence varies by a point or two per
take (Monte Carlo seed per session), so the voice-over never says a percentage.

## Known issues the recorder needs to know

Checked on prod (scripted engine) on Sun 8 Nov ~03:40–04:20 EET, unless marked otherwise.

- **Mikko's starting confidence is 72%**, not the 0.65 in the write-up; it reads ~86% after the own
  7-iron import and 88–89% after the test-club import. The write-up's 0.86 matches. Say no percentages.
- **Head paragraph scores reversed** (#231): R1/R2 hero text says "close behind (14 pts vs 16 pts)".
  The cards themselves (16 / 14) are right. Don't hold on or read the paragraph.
- **R5 aside chip "What if I buy stock?"** answers the stock/custom card and skips ahead. Use the
  **What if I stay stock?** toggle in the page instead. Don't tap any R5 chip.
- **Own fitting (newcomer), scripted:** `own.yaml` is the design walkthrough, so a few screens carry
  design copy, not tool output. Keep them off camera:
  - The round-tracker card shows placeholder stats ("86 avg score", "31% greens hit"). Tap
    **I'll just tell you** at once.
  - After **I'll answer myself**, the simulator picker has no "never been in one" option; typing it in
    the composer moves on, but the reply is "Good. Export your 7-iron shots as a CSV…". Then an empty
    shot review with **KEEP MY NUMBER**. Cut both (N3).
  - The carry slider starts at 180 yd. Leave it there and a beginner gets **stiff** flex; drag it to
    about 130 yd. *The result after 130 yd is not verified in the browser* (the 180 yd run gave
    201T MKII, KBS Tour Lite Stiff, stock, 72%, runner-up 301 CB). The voice-over names no spec, so it
    holds whatever the fit is.
  - The R2/R3 aside for the head close call is a fixed line ("The 201 gives you +3 yd…"), and in the
    verified run the real runner-up was the 301 CB. Don't show the aside on R2 Head or R3 for the newcomer.
- **Live engine** (the default when `engine=scripted` is missing): wording changes each take, and
  tapping "Not sure" twice on carry stalls the fitter. Stay on scripted.
- **The store page** is a demo copy of the takomogolf.com home page; every button leads to the studio.
  Don't say the studio is live on takomogolf.com.

## Don't

- Don't hide the **SIMULATED GOLFER** badge in Mikko's shots; say "simulated" or "synthetic" at least
  once (E1, E2). All TrackMan data is synthetic (L6). Never imply real customer data.
- No competitor names. No swing tips or practice advice (L18). Mild language only.
- No number in the voice-over that isn't on screen from the app at that moment (invariant 14). The
  example price and stock badges say **EXAMPLE**: don't read the price.
- Don't click into cut or flagged features: no `?ff=` URLs, no **Send the link to my phone** or camera
  measurement (both say "coming soon"), no TrackMan share-link field, no **Add to cart** (it is an
  example), no aside chips on R5.
- Don't present roadmap items as working. The R1 shot is title cards only.

## Roadmap: what is and isn't built (checked in the code on `main`)

| Item | Status | In the video |
|---|---|---|
| Inside the Takomo store (Shopify embed, cart, myTakomo saves) | Not built: no `web/embed/`, no `shopify/`; Add to cart and price are examples; Save gives a resume link, not a myTakomo account | Roadmap |
| Driver and fairway fitting | Not built: only the "Driver fitting is coming next" teaser on R1 | Roadmap |
| Camera measurements | Not built: "Measure with my camera instead · coming soon" on the wrist card | Roadmap |
| Screenshot / photo-of-screen import | Backend route exists, the import card says "Photo of the screen: coming soon" | Roadmap |
| Round-stats import (GameBook etc.) | Not built: the tracker picker exists, no import behind it | Roadmap |
| TrackMan share-link import | Cut (L6): the field is disabled, "coming soon" | Roadmap |
| Shadow fittings with Takomo's fitters | Validation plan (write-up §03, §05) | Roadmap |
| Voice ("Say it") | **Built** (browser speech; ElevenLabs when a key is set) | Not promised; the button is visible |
| AR on your carpet (R4 QR link) | **Built** | Not promised; optional extra shot |
| Phone layout | **Ships** (below 768 px, less polish; README) | Not promised |
| "Your clubs are fine" | Backend verdict only (`current_clubs_verdict`), no UI card in the scripted flows | Neither shown nor promised |

## Pre-recording checklist

- [ ] Code freeze is on and nobody is merging (a deploy wipes sessions).
- [ ] Browser at 1440×900, zoom 100%, no extensions or bookmarks bar in frame.
- [ ] `localStorage.setItem('takomo_units','imperial')` on `fitteri.mankelisolutions.fi`, then reload.
- [ ] `https://fitteri.mankelisolutions.fi/api/health` answers `"ok":true`.
- [ ] Take order: (1) store page hold (H1), (2) welcome + newcomer (H2, N1–N5) from
      `studio.html?engine=scripted`, (3) Mikko in a fresh tab (E1–E8) from
      `studio.html?engine=scripted&demo=DEMO-01`, (4) welcome screen for the close (C1).
      Record each as its own take; re-take a segment from a fresh tab if anything stalls.
- [ ] Wait for each card to finish streaming before the next tap (a tap mid-turn can be lost).
- [ ] Voice-over recorded separately against the shot table; title cards (R1) made in the editor.
