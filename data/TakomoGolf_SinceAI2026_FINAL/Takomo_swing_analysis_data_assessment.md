# Swing analysis for club recommendation: what data we have and what we can build

**Challenge:** The Fitter in Your Pocket (Takomo Golf, Since AI Hackathon 2026, Turku, 6–8 Nov)
**Question:** Can we train a model that recommends the best club from a golfer's swing video, using pose estimation or something similar?
**Written:** 6 November 2026

---

## TL;DR

- **The challenge pack has no video or images.** It's 49 MB of CSV files, code and docs. Every "video" value in it (tempo, swing speed from 240 fps video) is a *simulated output* of a phone pipeline, not footage.
- **So we can't train a pose model from the pack, and we don't need to.** We use a ready-made pose model (MediaPipe, Apache 2.0) to turn video into numbers. We train the part that combines those numbers into a fitting, and the pack has 23,016 labelled synthetic golfers for that.
- **No open dataset maps swing video to the right club.** Some cover parts of the problem. The best is **CaddieSet** (1,757 swing videos with pose and ball-flight data, MIT according to its GitHub page), but it has only 8 golfers.
- **Lie angle is the biggest gap and the biggest opportunity.** Today's tool gets it right for only 41% of golfers, no public video dataset has lie-at-impact labels, and Saturday's TrackMan session is our only chance to get any.
- **Saturday 7 Nov, 11.00–12.00 at Takomo's simulator matters most.** Film every shot from two angles at 240 fps and log the TrackMan numbers. That is our real-world test set.

---

## 1. What's in the challenge pack

Folder: `TakomoGolf_SinceAI2026_FINAL/`

| Item | Contents |
|---|---|
| `Since_AI_Challenge_Brief_Takomo_Golf.docx` | Takomo's brief: problem, judging criteria, what to submit |
| `TAKOMO_FITTING_LAB_2026/takomo_official/` | Takomo's participant pack (PDF) and product data: `heads.csv`, `shafts.csv`, `grips.csv`, `takomo_products.json` |
| `TAKOMO_FITTING_LAB_2026/data/` | 28,016 synthetic golfers in `train` (20,000), `dev` (3,000), `test` (5,000, no labels) and `demo` (16, with stories) |
| `TAKOMO_FITTING_LAB_2026/takomo_fit/` | Python package: today's fitting rules (`baseline.py`), a calibrated ball-flight model (`physics.py`), the scorer (`score.py`) |
| `TAKOMO_FITTING_LAB_2026/camera/` | Printable ArUco measurement sheet, plus geometry code for height, wrist-to-floor, hand length, tempo and the ball-line lie test |
| `TAKOMO_FITTING_LAB_2026/docs/` | Data dictionary, simulator assumptions, rules interpretation, phone-camera playbook, public resources, plan for the simulator visit |
| `TAKOMO_FITTING_LAB_2026/event_kit/` | Consent form, shot log template, TrackMan column map |

**File types:** 34 CSV, 19 Python, 9 Markdown, 3 PDF, 4 PNG figures. **No .mp4, .mov or image data.**

### Tables per golfer (`golfer_id` links them all)

| File | One row per | What it holds |
|---|---|---|
| `golfers.csv` | golfer | Age, sex, handedness, rounds per year, loft of own 7-iron (when known) |
| `questionnaire.csv` | golfer | The 12 answers to today's tool, **including realistic mistakes** |
| `phone_measurements.csv` | golfer | *Simulated* phone pipeline output: height and wrist-to-floor from a photo, hand and finger length, backswing and downswing time from video, clubhead speed from 240 fps video |
| `home_tests.csv` | test shot | Ball-line tilt (lie) and powder-spray strike location |
| `shots.csv` | shot | Launch-monitor shots: TrackMan fitting sessions (own 7-iron plus two Takomo test clubs) and consumer home radar |
| `labels.csv` | golfer | Truth (real speed, body measurements, lie need, tempo) and the **reference spec**: head, shaft, flex, length, lie, grip, stock or custom |

### How much of each kind of evidence (train split, 20,000 golfers)

| Evidence | Share of golfers |
|---|---|
| Body photo | 70% |
| Hand photo | 65% |
| Any swing video | 84% (50% at 30 fps, 34% at 240 fps) |
| TrackMan fitting session | 25% |
| Home radar | 15% |
| Ball-line lie test | 20% |
| **Any speed measurement** (240 fps video, TrackMan or radar) | **60%** |
| **Any lie measurement** (TrackMan or ball-line test) | **40%** |

### How scoring works

The Spec Agreement Score runs from 0 to 100. Points per component: head 20, flex 20, shaft material 10, shaft model 5, length 12, lie 15, grip 8, stock or custom 5, handedness 5.

| Baseline (dev split) | Score | Whole spec right |
|---|---|---|
| B1: today's tool on the golfer's own answers | 77.1 | 13.7% |
| B2: same rules, answers replaced by phone and launch-monitor evidence where it exists | 83.6 | 25.3% |
| Oracle: rules on true values | 100 | 100% |

The score is only part of judging. Takomo's criteria are trust and usability 35%, idea 25%, accuracy 20%, feasibility and business impact 20%.

---

## 2. Quick analysis: how good is each signal?

I computed these on the train split by comparing each evidence source against the true values in `labels.csv`.

| Signal | Accuracy | What it decides |
|---|---|---|
| Speed: golfer's own answer | off by 3.6 mph on average | Flex and material (30 points) |
| Speed: 240 fps video (simulated) | off by 2.8 mph on average | Flex and material |
| Speed: TrackMan or home radar | off by about 0.9 mph on average | Flex and material |
| Lie: static PING-style chart (height and wrist-to-floor) | correlation 0.63 with true need; **exactly right for only 37%** | Lie (15 points) |
| Lie: ball-line test | correlation 0.84 with true need, relative to the golfer's own club | Lie |
| Lie: TrackMan impact on a Takomo test club | correlation 0.99 | Lie |
| Tempo: video (any frame rate) | correlation 0.995 for backswing time | Shaft profile (tie-breaker) |

**What this means:**

1. **Lie is where the most points can be won.** Body measurements alone only get it right about 4 times in 10, and 60% of golfers have no lie evidence apart from the chart.
2. **Speed is the next lever.** Video beats self-report, but only a launch monitor is really precise. Every mph matters near the flex lines at 60, 70, 80 and 90 mph.
3. **Tempo from video is essentially solved.** Any pose model plus `camera/tempo.py` does it.

### A hypothesis worth testing: lie from pose video

The simulator models a golfer's lie need as the **static chart value plus a personal delivery offset**: whether the hands sit higher or lower at impact than at address. A down-the-line pose video can measure that directly (hand height at impact vs address, or shaft angle at impact if we can track the club).

That would mean every golfer with a phone gets lie evidence, not just the 40% with TrackMan or a ball-line test. **But no data in the pack or online has this feature with a true lie label.** We can only validate it on real swings, which is why Saturday matters.

---

## 3. Open-source data we could add

No public dataset links swing video to a fitted club spec, so nothing lets us train video → club end to end. These cover parts of the problem:

| Dataset or tool | What it has | Licence | Use for | Caveats |
|---|---|---|---|---|
| **CaddieSet** (CVPR workshop 2025) · [paper](https://arxiv.org/html/2508.20491v1) · [GitHub](https://github.com/damilab/CaddieSet) | 1,757 swing videos (924 face-on, 833 down-the-line) from 8 golfers. Each has 17 body keypoints per frame, 40 swing features over 8 swing phases, and launch-monitor ball data: ball speed, carry, distance, direction, spin axis. Clubs: 613 driver, 23 3-wood, 288 irons (4–9) | MIT according to the GitHub page (**check the LICENSE file before relying on it**) | **The only public set linking pose to ball flight.** Train pose features → ball speed or carry, then convert to clubhead speed with `takomo_fit.physics` | Only 8 golfers, mostly driver. Club speed, launch and spin rate aren't listed. A model trained on it learns those 8 people, so report leave-one-golfer-out error |
| **GolfDB** (CVPR workshop 2019) · [paper](https://arxiv.org/pdf/1903.06528) · github.com/wmcnally/golfdb | 1,400 YouTube swing videos labelled with 8 swing events (address → finish), view, club type, sex. SwingNet event detector (76% event accuracy) | **CC BY-NC 4.0 (non-commercial)** | Detecting address, top and impact for tempo; pre-training an event detector | Fine for the prototype, **not for Takomo's product**. No speed or ball data. Mostly tour pros |
| **GolfPose** (ICPR 2024) · [paper](https://minghanlee.github.io/papers/ICPR_2024_GolfPose.pdf) · github.com/MingHanLee/GolfPose | About 17,700 frames from 6 golfers with motion-capture 3D ground truth, **17 body keypoints plus 5 club keypoints** (shaft, hosel, heel, toe down, toe up) | Not stated. The paper links code; the data release is unclear | Club tracking: shaft angle at impact (lie) and clubhead position (speed) | Small; ask the authors whether the data is available |
| **OpenLaunch** · [GitHub](https://github.com/renzotherazor/openlaunch) | **Code, no data.** iPhone slow-motion video → ball and club speed, launch, carry, spin estimate, tempo. Uses Hough circles for the ball, background subtraction plus a Kalman filter for the club, MediaPipe for pose | MIT | A head start on the 240 fps speed pipeline | Its claimed accuracy (club speed ±3–5%) isn't independently checked |
| **MediaPipe Pose / Hand Landmarker** (Google) | Pretrained models: 33 body landmarks and 21 hand landmarks; run on phones and in the browser | Apache 2.0 | All pose extraction: wrist track for tempo, hands at address vs impact, body measurements | The wrist landmark is the joint centre, not the wrist crease: calibrate against a tape measure |
| **ANSUR II** (US Army anthropometric survey) · openlab.psu.edu/ansur2 | About 6,000 people with measured height, wrist height and hand length | Public release | Realistic priors; checking photo-based body measurements | Military sample; keep men and women separate |

Also known but not usable: a paper on reconstructing golf swings from a smartwatch (arXiv 2506.17505) built a 1,046-swing set from GolfDB and YouTube but doesn't say it releases the data.

---

## 4. Proposed architecture

```
 Phone video (face-on + down-the-line, 240 fps if possible)
 Photos (body against wall + hand on the printed sheet)
 Optional: ball-line test photo, launch-monitor CSV
              │
              ▼
 ┌─────────────────────────────────────────────┐
 │ 1. Measurement (pretrained, no training)    │
 │   MediaPipe Pose/Hand + ArUco sheet          │
 │   → tempo, hands at address vs impact,       │
 │     clubhead speed (OpenLaunch-style),       │
 │     height, wrist-to-floor, hand length      │
 │   Output uses the same columns as            │
 │   phone_measurements.csv                     │
 └─────────────────────────────────────────────┘
              │
              ▼
 ┌─────────────────────────────────────────────┐
 │ 2. Evidence model (trained on synthetic)    │
 │   Inputs: questionnaire + phone + home       │
 │   tests + shots                              │
 │   Estimates true speed, lie need, height,    │
 │   wrist-to-floor, hand length, tempo,        │
 │   EACH WITH AN UNCERTAINTY                   │
 │   (gradient boosting with quantiles, or      │
 │    a Bayesian combination of sources)        │
 │   Optional: CaddieSet pose→speed regressor   │
 └─────────────────────────────────────────────┘
              │
              ▼
 ┌─────────────────────────────────────────────┐
 │ 3. Takomo's rules (takomo_fit.baseline)     │
 │   head, shaft, flex, length, lie, grip,      │
 │   stock or custom                            │
 │   + "close call" flag when the uncertainty   │
 │     crosses a flex, length or lie line       │
 └─────────────────────────────────────────────┘
              │
              ▼
 ┌─────────────────────────────────────────────┐
 │ 4. Explanation and confidence (trust, 35%)  │
 │   "We measured 74 ± 3 mph → Regular flex.    │
 │    Your hands are 2 cm higher at impact than │
 │    at address → +1° upright."                │
 │   Expected carry and spread per head, from   │
 │   physics.py. Stock vs custom advice with    │
 │   the 30-day return in mind                  │
 └─────────────────────────────────────────────┘
```

**Why this split:**

- **Explainable.** Each choice comes from a measured value and a known rule, which suits the trust criterion.
- **Honest about uncertainty.** Confidence intervals show directly when a choice is a close call, and when custom is worth the risk versus stock with returns.
- **Trainable now.** Step 2 has 23,016 labelled golfers. Step 1 needs no training, only validation.
- **Feasible for takomogolf.com.** MediaPipe runs in the browser and on phones, so video can stay on the device (good for privacy).

---

## 5. Work plan for the hackathon

| # | Task | Data | Output | Priority |
|---|---|---|---|---|
| 1 | Evidence model: estimate true speed, lie need and body measurements with uncertainty, then run the rules | Pack: train → dev | Beat B2 (83.6) on dev; per-measurement error | **Must** |
| 2 | Close-call detection and the stock-vs-custom explanation | Pack | Confidence shown in the user interface | **Must** |
| 3 | Video pipeline: MediaPipe → wrist track → `camera/tempo.py` | Our own phone videos, GolfDB for testing | Tempo from real video | **Must** |
| 4 | Pose → speed: train on CaddieSet joint features → ball speed → club speed | CaddieSet | Leave-one-golfer-out error in mph | Should |
| 5 | Lie from down-the-line pose (hand height at impact vs address, or shaft angle) | **Saturday's recordings only** | Correlation with TrackMan lie at impact | Should (high value if it works) |
| 6 | 240 fps clubhead speed from video (OpenLaunch as a reference) | Saturday's recordings | Error against TrackMan in mph | Could |
| 7 | Test-set predictions | `data/test` | `<team>_takomo_test_predictions.csv` | Should |

---

## 6. Saturday's TrackMan session (7 Nov, 11.00–12.00)

This is our **only real video with real numbers**. Maximise it:

1. **Bring:** phones that film 240 fps slow motion, tripods (or a steady friend), the printed measurement sheet (`camera/measurement_sheet_A4.pdf`, printed at 100%), signed consent forms (`event_kit/CONSENT_FORM.md`).
2. **Film two angles for every shot:**
   - *Face-on:* camera level with the hands, square to the target line.
   - *Down-the-line:* behind the hands, along the target line.
   - Keep the whole club in frame and don't zoom.
3. **Log every shot** in `event_kit/shot_log.csv`: hitter, club, intent, and TrackMan club speed, ball speed, launch, spin, carry, face, path, attack angle and **lie at impact**. Photograph the TrackMan screen if there's no export.
4. **Ask for deliberately different swings:**
   - normal swings (baseline)
   - **toe-up and toe-down deliveries, or flat and upright clubs** → tests the lie-from-pose idea
   - toe and heel strikes → strike-pattern evidence
   - slow, medium and fast swings → covers the flex lines
5. **Ask the fitters:** What do they look at first? Which questionnaire answers do they distrust most? A fitter's quote is strong material for the pitch.
6. **If there's time:** ask for a ball-line test demonstration and photograph the face.
7. **Share:** put videos and logs in the shared folder the organisers announce on Discord (mapped to `shots.csv` columns through `event_kit/trackman_column_map.csv`).

---

## 7. Risks, licences and honesty

- **Synthetic is not real.** The pack's golfers, self-report errors and phone-measurement errors are *assumptions*. Never present simulated numbers as real golfer data in the pitch. Say which evidence is synthetic and which is from Saturday.
- **Licences:**
  - GolfDB: non-commercial (prototype only, not Takomo's product).
  - CaddieSet: MIT according to GitHub (check the file).
  - GolfPose: unclear.
  - MediaPipe, OpenLaunch, OpenCV: permissive.
  - Pack: code MIT, synthetic data CC BY 4.0; Takomo's files belong to Takomo.
- **Small real samples.** CaddieSet has 8 golfers and Saturday will give maybe a few dozen shots. Report errors with confidence intervals and say what would be needed to validate at scale (for example, paired phone and TrackMan recordings in Takomo's own fittings).
- **Privacy.** Swing videos are personal data. Process on the device where possible, ask for consent before any upload, and state how long anything is kept.
- **Prior art.** Judges may ask "why not just buy a launch monitor?" Answer: most Takomo customers don't own one, and a fitting needs body, hand and lie evidence that a launch monitor doesn't collect.

---

## 8. Next steps

1. Run the baselines: `pip install numpy pandas pytest`, then `python examples/baselines.py --data data/dev`.
2. Build the evidence model (task 1) and score it on dev.
3. Clone CaddieSet, check its data format and licence, and try pose → ball speed.
4. Prepare the Saturday kit (phones, tripods, printed sheet, consent forms, shot log).
5. Start the explanation UI early. Trust and usability is 35% of the judging.

---

## Sources

- Challenge pack: `START_HERE.md`, `docs/DATA_DICTIONARY.md`, `docs/SIMULATOR.md`, `docs/PHONE_CAMERA_PLAYBOOK.md`, `docs/PUBLIC_RESOURCES.md`, `docs/EVENT_SESSION_PROTOCOL.md`, `Since_AI_Challenge_Brief_Takomo_Golf.docx`
- [CaddieSet: A Golf Swing Dataset with Human Joint Features and Ball Information (arXiv)](https://arxiv.org/html/2508.20491v1)
- [CaddieSet, CVPR 2025 Workshops](https://openaccess.thecvf.com/content/CVPR2025W/CVSPORTS/html/Jung_CaddieSet_A_Golf_Swing_Dataset_with_Human_Joint_Features_and_CVPRW_2025_paper.html)
- [CaddieSet on GitHub](https://github.com/damilab/CaddieSet)
- [GolfDB: A Video Database for Golf Swing Sequencing](https://arxiv.org/pdf/1903.06528)
- [GolfPose (ICPR 2024)](https://minghanlee.github.io/papers/ICPR_2024_GolfPose.pdf)
- [OpenLaunch](https://github.com/renzotherazor/openlaunch)
- [Learning golf swing signatures from a single wrist-worn inertial sensor (arXiv 2506.17505)](https://arxiv.org/html/2506.17505v1)
