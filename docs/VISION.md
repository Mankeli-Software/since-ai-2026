# Takomo Fitter Studio: Product Vision

> Since AI Hackathon 2026 (Turku, 6–8 Nov). Challenge: **"The Fitter in Your Pocket"** by Takomo Golf.
> This is the product vision. The technical plan is derived from it.
> Sources: [issue #1](https://github.com/Mankeli-Software/since-ai-2026/issues/1) and all of its comments (briefing notes, Q&A transcripts, participant pack, integration research). The core vision is [this comment](https://github.com/Mankeli-Software/since-ai-2026/issues/1#issuecomment-6704708786).

---

## 1. One-liner

**A personal AI fitter studio on takomogolf.com.** An AI fitter talks with you and builds the interface around your answers (AI2UI). It shows your recommended club in 3D next to how it would fly for *you*, and explains every choice honestly. By the end, you trust the result at least as much as an hour with a professional fitter.

## 2. The problem we are solving

- **The gap is trust, not accuracy.** "Even if the correct result is given, the customer doesn't know that." The current tool "asks the right questions. What it can't do yet is show its working."
- The proof case: one customer ran the online fitting **14 times**, got the same answer each time, then drove to a physical fitter to confirm it, and only then ordered.
- Today's output reads like *"here's product one, here's product two… trust us, bro."* There's no evidence, no conversation and no "why".
- Takomo's main business problem this year is **conversion**. Traffic is up but conversion is down. They have reached the edge of the audience willing to buy online. The next audience is "see-and-feel" golfers who need more convincing.
- Self-reported data is shaky. Golfers overstate swing speed ("in every golfer's head their swing is Tiger Woods"), guess their glove size, and don't know their 7-iron's loft. A "7-iron" ranges from 29° to 34°, which is about 12 m of carry.
- Drop-off is spread evenly across every step of today's form, so **every extra question costs users**.

**Client steer (Q&A):** *"More important to concentrate on the trust-building in the fitting process than the accuracy of the outcome. The output we can take care of."*

## 3. What a great fitter does, and what we recreate

| Fitter behaviour | How the studio recreates it |
|---|---|
| **Listens.** Asks how you play, what you like and dislike, what you want to fix. | The assistant opens with a conversation, not a form: your current clubs, how your shots go, what you want. |
| **Watches** your swing and stance. | Optional data imports (simulator, launch monitor, round history). Camera capture is a stretch feature. |
| **Measures** real ball flight. | An evidence ladder: questionnaire → imported data → simulator session. Each step replaces a guess. |
| **Explains** why each part was chosen. | Every spec has a visible "why" taken from the rule trace, shown in 3D and in ball-flight visuals. |
| **Is honest** about close calls, and even says "don't buy yet". | A confidence meter, close-call flags, a stock-vs-custom warning, and a "your clubs are fine, come back in a year" outcome. |

> "By the end, you trust the result, because you saw how they got there."

## 4. Brand principles we design by

Takomo's values: **quality + simplicity, honesty, accessibility.**

1. **Radical Finnish honesty.** Recommend the club that's right *for you*, not the most popular or the easiest to sell. Takomo is *"prepared to sacrifice some conversion"* for honesty: *"If somebody should be playing a 201… I'd rather have them at the 201."* Say uncomfortable truths: ego carry, a custom build being non-returnable, "now isn't a good time to change".
2. **Quality + simplicity.** "Stupid-level clarity" that never patronises. Users are analytical and know their gear. One clear recommendation, with depth available on demand.
3. **Accessible to new players.** Most buyers are beginners and mid-to-high handicappers (about 70% game-improvement). They need direction and validation, not spec sheets. Better players want numbers that confirm what they already believe. **The depth of explanation adapts to the player.**
4. **Tone: "a conversation with a good golfer."** Technical and point-blank like a fitter. It may lean audacious, with bolder UI choices for a young, digital-savvy audience. The look matches the neutral main site, **not** the cartoonish Forge style.
5. **Never:** disparage or name competitors, use dark patterns (forced sign-up at the end, email gates), or tell someone to "fix your swing instead of getting fitted". Our clubs won't fix your swing, and we say so.
6. The brand book is in `data/docs/2025-02_Takomo_Brand_Book_public_version_compressed.md`. Visual styling from it is being handled separately.

## 5. Who it's for

- **Core:** men aged 18–35, digital-native, reached through social media and YouTube golf, with an average household income of about $150k. Takomo is actively expanding to women in the same age range. The US is about 65% of sales, and most users are on mobile.
- **Beginner / high handicap ("point me in the right direction").** Often a first real set. Wants direction and social proof ("most golfers like you play the 101"). Doesn't care about lie angle.
- **Better player ("validate me").** Numbers-driven. Wants evidence for the spec they suspect ("two degrees upright") and will question the result.
- **"See and feel" sceptic.** Today drives 45 minutes to a fitter. This is the growth audience we must convert.

## 6. The experience: end-to-end flow

Assumption: anyone who enters the studio already wants to get fitted.

### 6.1 Entry
- The demo is a copy of the takomogolf.com front page with a clear banner (or hero section) leading to the **Fitter Studio**. In the hackathon demo, *every* button leads to the studio, so everyone lands there.
- The feel is like walking into a golf shop or simulator bay: *you've arrived at a professional.*
- **"Try as" picker.** Judges and visitors have no simulator data of their own, so the landing page and the studio start screen offer **Try as Mikko / Hannu / Lars / Anders** and **Start my own fitting**. A persona starts from that golfer's old-form answers, and their simulated TrackMan files or ball-line readings are one-tap imports. Everything is labelled "simulated golfer".

### 6.2 Onboarding: only what can't be derived
- Ask only the things nothing else can tell us, the same things a fitter sees when you walk in: **age, sex, handedness**, and roughly how often you play. The pattern follows AMRight's doctor onboarding.
- Hand size, height and wrist-to-floor come **later**, once the user is invested.
- **Save to myTakomo is always available**, so the user can continue later. There is no scary email gate, and saving is never required to see a result.

### 6.3 The studio layout
- **Left: 3D stage.** Takomo club models, ball flight and dispersion.
- **Right: assistant chat**, by text or voice. It drives the flow through **generated UI components** (AI2UI), not static form pages.
- **Always visible:** a *"current best recommendation"* button, a **confidence meter**, and an "x pieces of information missing" note.

### 6.4 Conversation: "how's your game?"
The assistant greets you, explains how the fitting works, then starts the fitter's first 10 minutes:
- What clubs do you play now? What do you like and dislike? How do your shots go? What do you want to achieve?
- This also catches what the form misses: **joint pain**, whether the glove size was a guess, the loft of your current 7-iron, and whether your swing speed is a guess or measured.

### 6.5 Connect your data, with an easy fallback
1. **Simulator / launch monitor:** "Have you hit in a simulator? Which one? How do you want to bring the data in?" The options are a TrackMan shared-report link, a CSV, or a **photo of the screen** read by a vision model.
2. **Game data:** "How do you track your rounds?" Options are a GHIN number, Arccos/Garmin, or a **screenshot** of GameBook or 18Birdies stats read by a vision model. This gives a real average score instead of last week's best round.
3. **Home tests:** the **ball-line test** (a line on the ball, a few shots, read the tilt of the mark on the face), typed in by the golfer. It shows which way the lie should lean, but it is rough evidence, so the studio says so.
4. **Fallback:** a short conversational version of today's questionnaire. The loop must stay **as light as the current form** for users who don't want to import anything.
5. **"Want more precision?"** After every import, the assistant names the least certain part of the spec and offers the next piece of evidence for it: more shots, more ball-line readings, a re-measurement, or a simulator session. "I'm happy with this" is always an option, and an **Add data** button stays available, so a golfer who wants more certainty can always add more.

### 6.6 Body measurements, asked late
- Height, wrist-to-floor and hand or glove size are asked now, after the user is invested.
- Camera measurement can replace these later (stretch).

### 6.7 The recommendation reveal
- The assistant shrinks to a side panel, and the studio takes over.
- **3D model** of the recommended club, plus a **swing and ball-flight estimate** of carry, apex and dispersion for *you*. Showing dispersion and flight windows is what recreates *"I just hit this at the range and I trust it."*
- **Club row.** The heads sit side by side in size order, with **the best fit in the centre and highlighted**. The differences between them are clearly visualised, and each one has a "read more" link.
- **Why panel.** For each spec (head, shaft, length, lie, grip) there's a one-line plain-language reason, expandable to the numbers. The depth adapts: direction plus social proof for beginners, numbers for better players.
- **Close calls shown honestly.** For example: "The 301 CB and 301 MB are almost tied for you. Here's the trade-off."
- **Product video.** The recommended club's video from takomogolf.com (influencer or product videos) sits right in the result, next to the 3D model. It shows the real club being hit by real golfers, which adds the "see and feel" the 3D model alone can't give. When the user switches to another head in the club row or in tinker mode, the video follows.
- **Social proof** where it's true, e.g. "the most-fitted head for golfers like you" or "a tour player plays this".
- **Trade-offs spelled out.** For example, "+20 m, but you give up height and stopping power."

### 6.8 "Play with it": the tinker mode

> **v3.2 (plan L24, L25):** narrowed after the client demo. The shipped studio swaps only the head between the 1st and 2nd choice (same shaft) and offers one "What if I stay stock?" toggle. Free configuration of every spec, as described below, is not built.

- The user can change any spec (head, shaft, flex, length, lie, grip) and **see the effect immediately** in 3D and in ball flight. The change is always compared with the recommendation.
- **Live 3D change.** The 3D club updates as a spec changes. We probably won't have a separate model for every variant, so we use **one base club model and change it in code**:
  - **Length:** stretch the shaft.
  - **Lie:** rotate the head against the shaft, shown at address relative to the ground.
  - **Grip size:** scale the grip's thickness.
  - **Shaft or flex:** swap the shaft's colour or label, and show its bend profile.
  - **Head:** swap the head model, which we do have for each head.
- **Emphasise the part being edited.** The camera moves to that part, it's highlighted (with an outline, glow, or by dimming the rest of the club), and the change against the recommendation is labelled, e.g. "+1° upright" or "+0.5 in".
- This proves the recommendation by letting users see for themselves that the alternative is worse for them. It is the core trust moment.
- Switching club type or model is easy, by tapping or by asking the assistant.
- **Stock vs custom advisor.** Any change that forces a custom build (lie, length, oversize grip, graphite) shows: *"This makes it a custom build, which can't be returned. Stock has a 30-day return. Is +1° lie worth it for you?"*

### 6.9 The assistant stays available
- Golf and product questions ("compare the 201 and the 201T"), backed by Takomo's product data.
- "How would *this* club work for me?" It re-runs the fit and the visuals.
- **No swing tips and no practice advice** (brand book: the character "doesn't give you swing tips"). Erratic delivery is described only as what the clubs can and can't do.

### 6.10 Honest endings
- **Confidence gate:**
  - Below about 30%, no result is shown. The user is asked for the minimum missing data.
  - From about 50% to 70%, a result is shown, but more questions are suggested.
  - Above that, the result is shown with full confidence.
- **"How to get a more accurate result":** connect the data mentioned above, or visit a simulator. A **map of the nearest simulators** is shown here: static in the PoC, real data as a stretch.
- **"Don't buy yet":** if the current clubs already fit, or the right product isn't out yet, say so: *"Your clubs are fine. Come back in a year."* Offer to leave an email for upcoming launches, plus a "continue fitting anyway" button.
- **Save the fitting** to myTakomo at every result.

## 7. Feature list, prioritised

The rule for prioritising: **trust and the experience first** (35% of the judging), then idea (25%), accuracy (20%), and feasibility (20%).

### Must have (the demo story)
1. **Fitter Studio shell.** A copy of the Takomo landing page plus entry, then the 3D-left / chat-right layout. Mobile-friendly.
2. **AI2UI assistant.** A conversational fitter that drives the flow by generating UI components (choice chips, sliders, cards, comparisons) instead of a fixed form.
3. **Light conversational intake** that covers everything the current questionnaire asks, plus the fitter-only questions. The fallback is always available.
4. **TrackMan / simulator data import.** Measured data is part of the core demo, not an add-on, but no real data was captured, so the demo uses synthetic TrackMan files (plan L6). Import is a CSV; the shared-report URL is a slide. It replaces guesses with measured speed, carry and dynamic lie, and the user sees confidence rise.
   - **Includes "find a simulator near you" as a static PoC:** a mocked map and list of nearby simulators, shown in the flow and in the "get a more accurate result" ending.
5. **Recommendation engine.** We don't write our own fitting rules. Our Python backend runs the participant pack's `baseline.py` (today's Takomo tool as code) and `physics.py`. This is pack code running on our side, not a Takomo API. The AI agent calls them as tools:
   - `recommend(...)` returns a ranked head, shaft, length, lie, grip and stock/custom, plus a `.trace` that explains why. `score_heads`, `lie_for`, `flex_for` and the other functions can be called separately.
   - `physics.py` gives the ball flight and dispersion for each head.
   - The product data lookups guarantee a **buildable** spec.

   **Our own code is the glue around it:**
   - **Input mapping.** Turn the conversation and imported data into the answers format the baseline expects. Measured TrackMan values replace guesses, which alone takes the baseline from 77.1 to 83.6.
   - **Confidence and close calls.** Computed from which inputs are measured versus guessed, how close a value is to a cutoff, and the gap between head scores.
   - **Explanations.** Turn the `.trace` into plain-language "why" text at the right depth for the player.
   - **Tinker mode.** Re-run the recommendation and physics with the changed spec and compare against the recommendation.

   The pack's **scorer** (Spec Agreement Score) is only for validation: the test-predictions CSV and the B1/B2 comparison. The app never calls it.
6. **3D club stage** using Takomo's club models (we have access): the recommended head plus the comparison row.
7. **Ball-flight and dispersion visual** for each head, driven by the pack's `physics.py`.
8. **Why panel** for each spec, with close-call flags and adaptive depth.
9. **Tinker mode.** Change specs and see the effect compared with the recommendation. One base 3D model is changed in code (length, lie, grip size, shaft), and the edited part is emphasised with a camera move, a highlight and a label showing the change.
10. **Confidence meter**, missing-info indicator and confidence gating.
11. **Stock vs custom honesty** (30-day return vs non-returnable).
12. **Save / continue** fitting (a simple myTakomo mock).
13. **Product video in the result.** The recommended club model's video from takomogolf.com is shown in the result view, and it changes when the head changes.
14. **Forge "go deeper" CTA (PoC).** The result and the why panel have calls to action like "watch the clinic videos" or "learn more about this shaft" that point to Forge content. In the PoC these are static CTAs.

### Should have
15. **Screenshot import**, read by a vision LLM into structured JSON, for simulator screens and GameBook or 18Birdies stats.
16. **Current-bag check.** Translate the user's own 7-iron (its loft) into Takomo terms. Includes the "don't buy yet" ending.
17. **Honest humour for outlier inputs.** For example: *"You're in the 0.003%. Your arms must be very long."*
18. **Voice input and output** for the assistant.
19. **Mascot.** For example, a bird in a golf cap, built with Rive. Its expressions react while the AI generates the next component, and it greets the user and launches the flow. The client said "door wide open".
20. **See it in AR.** We already have the 3D club models, so the result offers a simple "see it in your hands" flow. On desktop, the user scans a QR code with their phone and opens the club in AR in the real world: Apple AR Quick Look on iOS, using a USDZ file, and Scene Viewer on Android, using a glTF/GLB file.

### Stretch (only if time allows)
21. **Camera capture:** photo body measurements using the ArUco A4 sheet, tempo from a swing video, the ball-line lie test. This is one feature of the personalised experience, not the core.
22. **Real nearest-simulators map**, replacing the static PoC in #4 with real location data.
23. **Real Forge integration.** The CTAs from #14 open the Forge login page and the actual clinic content.
24. GHIN / Arccos / Garmin connectors.
25. Full bag beyond irons (driver next).

### Explicitly not now
- Building camera/CV capture before the trust experience works.
- A native app. Takomo prefers web that integrates easily into takomogolf.com.
- Rewriting Takomo's recommendation logic. *"Leave the recommendation process to the experts."* We run the pack's `baseline.py` as it is, then wrap it, explain it and feed it better evidence.

## 8. Trust design: the mechanisms in one list

1. **Show the working.** Every spec has a reason, drawn from the real rule trace.
2. **Let them see it.** 3D club, personal ball flight, dispersion and flight windows.
3. **Let them test it.** Tinker mode proves the recommendation by comparison.
4. **Admit uncertainty.** A confidence meter, close calls, and boundary warnings, e.g. "you're 1 mm from the next length, so measure again".
5. **Replace guesses with evidence.** The evidence ladder, and the user sees confidence rise as data is added. Measurement alone took the baseline from 77.1 to 83.6.
6. **Be honest when it costs a sale.** "Don't buy yet", the 201 over the 101, and custom being non-returnable.
7. **Validate, matched to the player.** Popularity, players like you, tour usage, or your own numbers.
8. **Respect the user.** No dark patterns, save any time, and results never sit behind an email gate.

## 9. The demo story (Sunday)

- Use the pack's **16 demo golfers**, each a story of a way online fitting fails, as scripted runs. The best ones for trust:
  - **Mikko:** an ego carry plus a jacked 7-iron loft wrongly puts him in stiff; the data corrects it.
  - **Hannu:** a static chart says standard lie, but his ball-line test leans flat. The studio says honestly that the test is rough, so his lie is a close call, and it offers a simulator session with a Takomo test club to get the number. (His true need is −2°, which only that session would find.)
  - **Lars:** a close call between the 301 CB and the 301 MB, shown as a trade-off.
  - **Anders:** is +1° lie worth giving up the return?
  - **Kaisa:** a guessed glove size.
  - **Pekka:** joint pain the form never asks about.
  - **Aino:** a beginner with no data, who gets a gentle path.
- The flow: landing page → studio → conversation → data import → reveal → compare heads → stock vs custom → honest ending → save (plan L23–L25).
- **Deliverables:**
  - A working PoC (live link or recording).
  - A one-page write-up covering the idea, what the PoC proves, the accuracy validation plan, the trust design and next steps.
  - A repo with a README.
  - The `<team>_takomo_test_predictions.csv` run through the scorer, beating B1 at 77.1 and ideally B2 at 83.6.

## 10. How we'll know it works

- A golfer can explain *why* they got their club, in their own words, after the flow.
- Completing the flow takes no more effort than today's form if nothing is imported.
- Confidence visibly rises as evidence is added.
- At least one demo moment where the studio is honest at a cost to the sale.
- The Spec Agreement Score on dev is at least the baseline.

## 11. Assets & inputs we have

- **Takomo product data:** heads (101 MkII, 201 MkII, 201T MkII, 301 CB, 301 MB), 35 shaft builds and grips, as JSON and CSV, with buildable combinations.
- **Participant pack:**
  - the baseline rules in Python, with 87 tests documenting them
  - a physics ball-flight model
  - the scorer
  - 28,016 synthetic golfers
  - 16 demo golfers
  - a camera kit
- **Takomo 3D club models:** CAD (XT), or meshes downloaded from the website, converted to glTF or FBX.
- **TrackMan session** on Saturday 11:00–12:00 at Takomo's office. **No real data was captured** (plan L6), so all evidence in the demo is synthetic.
- **Brand book:** `data/docs/2025-02_Takomo_Brand_Book_public_version_compressed.md`.
- **Unofficial APIs are OK for the PoC** (client approved). Production would need partnerships.

## 12. Open questions

- **Mascot or no mascot.** It's personal and fun, but it must not feel like the Forge cartoon style.
- **Skill inference.** Can we reliably tell beginners from better players to adapt explanation depth? The recommended head (101 vs 201/301) is one signal.
- **Social-proof numbers.** We need real figures from Takomo, or must label them clearly as examples in the demo.
- **Confidence model.** How confidence is calculated: from data sources, self-report flags and close-call margins.
- **Fitting videos.** Mine the YouTube fitting sessions Takomo shares for questions the assistant should ask or be able to answer.
- **Product videos.** Collect the video URLs for each head model from takomogolf.com, and confirm with Takomo that we may embed them.
- **Scope.** Irons only, or every head model? Driver is the next fitting priority.
