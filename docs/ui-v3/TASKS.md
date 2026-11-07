# UI v3: implementation task list (local)

Goal of this pass: the **Flow v3** design runs in `just dev` and you can click through it from start to
finish as Mikko (`studio.html?engine=scripted&demo=DEMO-01&ff=v3`) with **no API keys**. Fidelity
polishing comes after.

- **Design (source):** https://claude.ai/artifact/5TcKkEWqDkC7vSxmj5Veg9, page "Flow v3"
- **Spec (read first):** `docs/ui-v3/design-spec.md`. It has exact tokens, shells, screens and the component catalog.
- **Mockups (HTML):** `docs/ui-v3/design/*.dc.html`. Open them in a browser for pixel reference.
  Ignore `support.js`, `<x-dc>` and `{{ }}`; the inline styles are the reference.
- **Club images:** use `assets/clubs/images/<slug>/hero.webp` (served at `/assets/clubs/images/...`),
  not the `/_blob/...` ids in the mockups.
- **Rules:** CLAUDE.md, AGENTS.md and web/CLAUDE.md. In particular:
  - no tests
  - one file per block
  - additive schemas
  - no new deps
  - new UI behind `?ff=v3` until T9 flips it
  - desktop (1440×900 and 1280×800) only

## What changes vs today

| Today (main @ 17137d9) | v3 design |
|---|---|
| A 2-column studio: 3D stage on the left, chat column on the right, every block stacked as a card in the timeline | **Chat phase**:<br>- one centered column on the dark "bay"<br>- a "You told me" row of recap chips<br>- the fitter's latest line<br>- **one** light input card<br>- a dark composer pinned to the bottom<br>- the club ghost image fades in as data arrives |
| A TopBar with confidence, best fit, missing count, Add data and Save | Header:<br>- logo<br>- "Step N of 4"<br>- 10 confidence segments<br>- a "Save to myTakomo" button |
| A 3fr/1fr layout on reveal | **Results phase**:<br>- R1 summary page<br>- tabs R2 Why / R3 Compare and fly / R4 AR<br>- a **buy bar that is always visible**<br>- a 380px "Your fitter" side panel with chips and a composer |
| The scripted Mikko run emits **one** handedness chip | The scripted Mikko run walks C2 → C3b → C4a–c → C5 → C6a–c → R1 |

## Decisions taken in this list (flag if you disagree)

1. **Keep the SSE and gen-UI architecture.** v3 is a new *presentation* of the same `ui` / `text` / `state`
   events. The chat shell shows the latest interactive block as "the card", not a timeline.
2. **The "Try as" persona picker stays (L16, never cut).** It goes on the C1 welcome screen under the main CTA.
3. **The TrackMan share-link paste (C4c) is cut by L6.** The guided-import card keeps the 3-step visual, but the
   action is a CSV upload plus one-tap persona **sample imports**, labelled "Simulated". The link field is
   shown disabled with the text "coming soon".
4. **Results data comes from what already exists:**
   - `state.best` / `runner_up`
   - `recommendation_card`, `why_panel`, `club_compare`
   - `fixtures/*.json`

   Flight uses the existing `FlightSvg` fixtures until FIT #26 lands. Price "€679" and stock status come from a
   fixture; they are **labelled example**.
5. **New blocks the design needs** (each follows the 3-file rule): `sentence_builder`, `yes_no_fork`,
   `source_picker`, `heard_summary`, `confidence_update`, `close_call`, `flex_band`.
   - **Glove** = a new `body_measure` field value `glove`. This is additive: a new Literal member.
   - Everything else in the catalog is post-session (see "Later").

---

## Wave 0: contracts and foundation (2 agents, parallel, ~30–45 min). Everything else waits on these.

### T0a · Design tokens and primitives (WEB-APP)
- **Files:**
  - `web/src/styles/theme.css` (extend only; keep the existing names working)
  - new `web/src/components/studio/*.tsx`
- **Tokens to add:**
  - colours from spec §1.2: `#C24F00`, `#FFE6D3`, `#FF8A33`, `#FFB078`, `#1A140F`, the dark greys `#0E0E0E` to `#5F5F5F`, the light greys, and the status colours `#3FB950` / `#E3B341`
  - radii 4/6/8/10/12/14/16/18/20
  - a `.bg-bay` utility for the stage grid background
  - the 240 ms ease-out motion
- **Primitives (one file each):**
  - `Button`, with variants `primary` (orange), `dark`, `outline`, `light-on-dark`, `ghost-on-dark` and sizes `sm` / `md` / `lg` / `xl`
  - `Eyebrow`
  - `Kbd`
  - `OptTile`: `.opt` plus kbd, with a selected state
  - `ProvenancePill`: measured / guess / chart
  - `ConfidenceSegments`: 10 segs plus %, with an aria-label
  - `StepBars`
  - `LogoMark` and `Wordmark`
  - `FitterAvatar`: 28/36/44
  - `ClubImage`: slug → hero.webp, with a fallback
  - `StatTile`: light / dark / compare
  - `CloseCallBar`
  - `SpecPartIcon`: head / shaft / length / lie / grip
  - `RecapChip`
- **Done when:**
  - `dev.html?ff=primitives` shows every primitive
  - `just check` passes

### T0b · Block contracts and fixtures (WEB-APP owns `schemas/ui`)
- **Files:**
  - `backend/app/schemas/ui/{sentence_builder,yes_no_fork,source_picker,heard_summary,confidence_update,close_call,flex_band}.py`
  - the matching `fixtures/ui/*.json`
  - `body_measure.py`: add `"glove"` to `field` and an optional `options: list[{id,label,sub}]` for the size tiles
- **Shapes** (keep them small, and use the design copy for the fixtures):

  | Block | Kind | Fields |
  |---|---|---|
  | `sentence_builder` | input | `prompt`, `tokens[{id, placeholder, options[{id,label}], value?}]`, `template` (a string with `{token_id}` slots). Resume value: `{token_id: option_id}` |
  | `yes_no_fork` | input | `prompt`, `options[2] {id, title, body, illustration: Literal["sim_data","by_hand"]}` |
  | `source_picker` | input | `prompt`, `options[{id, name, hint}]`, `fallback?{id, title, body}`, `preview_stats?[{value,label}]` |
  | `heard_summary` | input | `facts[{label, source: typed\|measured}]`, `missing?{field, prompt, unit}`, `skipped_count`. Resume value: `{missing_value?}` |
  | `confidence_update` | display | `before`, `after`, `changes[]`, `left_count?` |
  | `close_call` | display | `part`, `a{label,share}`, `b{label,share}`, `tradeoff`, `next_step?` |
  | `flex_band` | display | `measured_mph`, `band`, `ghost_mph?`, `ghost_label?` |
- **Done when:**
  - `just gen` passes
  - `dev.html` lists the 7 new types as "missing block", which is expected until T3b lands
  - `just check` passes
- **Merge this first:** T3b and T5 code against it.

---

## Wave 1: parallel (5 agents). Each one is its own worktree and branch, with no shared files.

### T1 · Chat-phase shell (WEB-APP: `features/studio-shell/`, `features/landing/`, `features/personas/`)
- `Studio.tsx` picks the shell. With `?ff=v3`:
  - `ChatShell` when there is no result
  - `ResultsShell` (T2) once `state.best` is set and a `recommendation_card` has arrived
  - without the flag, the old layout is unchanged
- **New `ChatShell.tsx`** (spec §2.1):
  - header with logo, "Step N of 4", `ConfidenceSegments` from `state.confidence`, and the Save button
  - the column with max-width 960
  - `RecapRow` from the last 3 answered blocks' `display_text`, each chip titled with its block prompt; measured values get a dot
  - `FitterLine`: the latest assistant message, avatar plus 24px text, with `**bold**`
  - `ConversationCard`: renders the latest interactive `ui` item through `GenUiBlock` on a light card
  - display-only blocks that arrive in the same turn (`confidence_update`) render *inside* the card area, above the input
  - `Composer`: the dark composer that calls `say()`. "Say it" stays disabled unless `?ff=voice`
  - the hero ghost `ClubImage`: opacity 0.22 → 0.65, driven by confidence
  - "Thinking…" state, and a back-scroll "Show conversation" disclosure for history (no timeline by default)
- **Step mapping:** derive it from the active block (see the table in spec §2.1):
  - 1 = about you / scoring
  - 2 = evidence
  - 3 = body
  - put the mapping in one small `stepFor(block)` helper
- **C1 Welcome:** `StudioStart` restyled to the C1 mockup (hero, CTA "I'm ready. Let's start", 4 steps) plus the "Try as" persona row (smaller, under the CTA). `index.html` landing: CTA styling only.
- **Number keys 1–9** pick options in the active card (a listener scoped to the card, not global).
- **Design refs:** V3-C1, C2, C3b, C4a, C5, C6.
- **Done when:**
  - the Mikko scripted run (even the current 1-step script) renders in the new shell
  - it looks right at 1440×900 and 1280×800
  - `just check` passes

### T2 · Results shell and R1 summary (WEB-APP: `features/result/`)
- **New files:** `ResultsShell.tsx`, `BuyBar.tsx`, `FitterAside.tsx`, `DetailNav.tsx`, `R1Summary.tsx`, and `web/src/features/result/fixtures/commerce.ts` (price and stock, labelled example).
- **Layout** (spec §2.2):
  - header variant ("Your fit", no steps)
  - left column: nav + main + buy bar
  - right: the 380px aside
  - tab state is local (`summary | why | compare | ar`) and mirrored to `?view=` for deep links
- **`FitterAside`:**
  - the latest assistant message
  - suggested chips: from the design for now, typed into `say()`
  - an embedded slot for `close_call` / `product_video` / `simulator_map` blocks
  - a composer
- **`BuyBar`:**
  - spec line built from `state.best`
  - status dot (stock: green; custom: amber)
  - €679 (example)
  - "Add to cart" → `host.addToCart`
  - an optional "Next:" link
- **`R1Summary`:**
  - hero (stage panel + head name + why sentence + 3 ticks)
  - the "two best heads" cards from best / runner_up (scores from `club_compare` or `per_part`)
  - 3 drill-down cards
  - a "See it hit" 4-video strip from `fixtures/product_videos.json`
- **R1b variant:** when `state.gate !== 'confident'` or there are no measured shots, the aside shows the "Confirm it with real shots" section (map + list + projected-confidence bar), reusing `SimulatorMapView`.
- `R2` / `R3` / `R4` render placeholder panels that T4a/T4b replace. The buy bar takes a `next` prop so R2 can chain parts (separate files, so there is no conflict).
- **Design refs:** V3-R1, R1b.
- **Done when:**
  - `studio.html?ff=v3,reveal&demo=DEMO-01` with fixture data shows R1 correctly
  - the buy bar is always visible
  - `just check` passes

### T3a · Restyle the existing input blocks to v3 (WEB-APP: `features/genui/blocks/`)
For each block below, change only the block file and its `result/*` view, and use the T0a primitives.

| Block | v3 look | Mockup |
|---|---|---|
| `choice_chips` | `.opt` grid with kbd numbers; "Not sure" always present | C2 options |
| `slider` | `slider_guess` look: big number, provenance pill, guess/measured segmented control, Not sure / That's it | C3b |
| `body_measure` | 2-column card: illustration panel + big number or boxed input + unit switch + Not sure / Next. Three variants: height (C6a), wrist (C6b, numbered steps), glove (C6, size tiles) | C6a–c |
| `data_import` | guided 3-step card | C4c |
| `outlier_review` | orange-tint callout, Keep it / Drop it, "N other shots stay in" | C5, K4 |
| `stock_vs_custom` | radio cards with mini strike maps and returns/delivery footers | R5 |

`data_import` details:
- the TrackMan steps
- the link field disabled ("coming soon", L6)
- CSV upload and persona sample buttons as the working actions
- `club_hint`

- **Done when:**
  - each block looks like its mockup in `dev.html`
  - `respond()` payloads are **unchanged**
  - `just check` passes

### T3b · New input/display blocks (WEB-APP: `features/genui/blocks/`, after T0b merges)
- `sentence_builder.tsx` (C2): token pills (active = black, unfilled = grey) + an option grid for the active token. It auto-advances to the next token and submits when all tokens are filled.
- `yes_no_fork.tsx` (C4a): two illustrated tiles (inline SVG from the mockup).
- `source_picker.tsx` (C3a, C4b): tile grid, dashed fallback tile, optional preview-stats strip.
- `heard_summary.tsx` (C2b): fact chips (check vs dot), missing-field callout with an input, skipped-count line, "Show my fit →".
- `confidence_update.tsx` (C5, K5): "34 → 68%" + segments + change chips.
- `close_call.tsx` (R3 aside, K5): split bar + trade-off + optional button. Light card.
- `flex_band.tsx` (R2, K5): SVG bands L/R/S/X, measured marker, ghost marker.
- **Done when:**
  - every type renders its fixture in `dev.html` with no "missing" warnings
  - `just check` passes

### T5 · Scripted Mikko v3 run (AGENT: `backend/app/agent/mock/scripts/`, issue #17; after T0b merges)
- Rewrite `mikko.yaml` to walk the v3 path with the design's copy (spec §3). Each input `ui` step ends a turn.

  | Step | Block | Design copy |
  |---|---|---|
  | C2 | `sentence_builder` | the "how long / how often / hand / sex / age" sentence |
  | C3a | `source_picker` (round trackers) | the user picks "I'll just tell you" |
  | C3b | `slider` (7-iron carry, guess toggle) | 165 m, a guess |
  | C4a | `yes_no_fork` | |
  | C4b | `source_picker` (simulators) | |
  | C4c | `data_import` (csv + sample) | |
  | C5 | `confidence_update` + `outlier_review` | text "Got 24 shots. You carry it **142 m**, not 165…" |
  | C6a / C6b / C6 | `body_measure` height / wrist / glove | |
  | → | `tool_call run_fit` (real tool) → `recommendation_card` + `why_panel` + `club_compare` (display) | |

- Keep it working **regardless of the user's answers**: the script does not branch, so off-script answers just continue.
- If a tool the script needs is a stub (`simulate_flight`, `compare_specs`), emit fixture-shaped display blocks instead and leave a `# TODO(#26)` comment.
- `scripted_engine.py` changes only if a step type is missing; keep them additive.
- **Done when:**
  - `curl` through all the turns gives a valid SSE stream
  - the UI (T1 + T3a/b) clicks through to R1
  - it still works with zero keys

---

## Wave 2: after T2 merges (2 agents, parallel)

### T4a · R2 "Why each part": five per-part screens (WEB-APP `features/result/why/`)
- Design: `V3-R2-Head`, `V3-R2-Why` (shaft), `V3-R2-Length`, `V3-R2-Lie`, `V3-R2-Grip`. **Spec §6** has the full table.
- **`R2Why.tsx`** holds the shared layout:
  - the part list (left)
  - the centre column template: eyebrow, H1, reason, chart slot, stat tiles, callout, actions, Forge link
  - the 3D focus panel (right): lazy `ClubStage` with `focus` / `highlight`; fallback is a dimmed `ClubImage`
- The selected part lives in `?part=head|shaft|length|lie|grip` (default `head`).
- **One file per part's chart** in `features/result/why/charts/`:
  - `HeadRangeScale`
  - `FlexBand` (reuse the T3b `flex_band` view)
  - `LengthScale`
  - `LieSoleDiagrams`
  - `GloveGripMap`
- **One file per part's content** in `features/result/why/parts/<part>.ts`. Each one maps the `why_panel` item, `per_part` and evidence to copy and stats, with the design copy as the fixture fallback.
- **Per-part wiring:**
  - the buy bar's "Next:" chain is Head → Shaft → Length → Lie → Grip → Compare heads
  - the aside gets a message and suggestion chips for each part
  - the lie "Do the ball-line test" button sends a chat turn
- **Done when:**
  - all 5 parts match their mockups at 1440×900 and 1280×800
  - each part works from fixtures and from the Mikko run
  - `just check` passes

### T4b · R3 / R4 / R5 (WEB-APP `features/result/` + WEB-3D `features/stage3d`, `flight`)
- **`R3Compare.tsx`:**
  - stage panel with the faint second head
  - side-view flight compare (reuse the `FlightSvg` side view, or a small `FlightCompare` SVG per the mockup)
  - 4 compare tiles
  - head selector toggle (best vs runner-up) that swaps the highlighted flight
  - "Show all five heads" → `ClubRow`
  - `close_call` in the aside
- **`R4AR.tsx`:** QR placeholder (a static SVG; QR generation is a later task) + phone mock + a link to `ar.html`.
- **`R5Stock.tsx`:** shown only when a `stock_vs_custom` block arrives (Anders); the radio drives `BuyBar`'s custom state.
- **Done when:**
  - the tabs work from fixtures and from the Mikko run
  - the buy bar's "Next:" links step through
  - `just check` passes

### T9 · Integration and flip (lead / me)
- Merge order: T0a, T0b → T3b, T5 → T1, T2, T3a → T4a, T4b.
- Run Mikko end to end at 1440×900 and 1280×800 and file a punch list.
- Then make v3 the default: `ff=legacy` keeps the old studio for one day.
- `just check`, `just dev`, then check `index.html` → studio → R1 → tabs.

---

## Later (not this session; record only)
- **#40:**
  - `save_fitting` card from the header Save button, plus resume via `resume_token` and `?resume=`
  - this needs the `/save` route (backend)
  - the form fallback
- **#47:** tinker panel. It needs FIT #27 `/api/tinker`.
- **FIT #26:** real flight API → replace the flight fixtures in R3.
- Remaining catalog components:
  - `multi_pick`, `flight_picker`, `pain_check`, `bag_check`, `extraction_review`
  - `explainer`, `numbers_table`, `social_proof`, `landing_rings`, `strike_map`, `lie_test`, `set_gapping`
  - `availability`, `dont_buy_yet`
- **Type/talk answer modes (K2):** inline confirm chips after 2 typed answers, live transcript (#51 voice).
- The C2b skip-ahead path needs live-engine free-text parsing (AGENT); scripted can fake it later.
- Hannu, Lars and Anders scripts (#49); R5 only shows with Anders.
- Mobile (L3, Final phase).

## Agent assignment cheat sheet

| Task | Lane | Depends on | Size |
|---|---|---|---|
| T0a tokens + primitives | WEB-APP | – | S |
| T0b block contracts | WEB-APP (schemas/ui) | – | S |
| T1 chat shell + welcome | WEB-APP | T0a | L |
| T2 results shell + R1 | WEB-APP | T0a | L |
| T3a restyle input blocks | WEB-APP | T0a | M |
| T3b new blocks | WEB-APP | T0a, T0b | M |
| T5 scripted Mikko v3 | AGENT | T0b | M |
| T4a R2 why ×5 parts | WEB-APP | T2, T3b | L |
| T4b R3/R4/R5 | WEB-APP + WEB-3D | T2, T3b | M |
| T9 integrate + flip | lead | all | M |

## Not in this session: Takomo-style demo landing (T6)
- **Mockup:** `docs/ui-v3/design/01b-Landing-current-site.dc.html` (primary) and `01-Landing.dc.html` (alternative).
- **Scope:** `features/landing/TakomoHome.tsx` + `features/landing/home/*`, behind `?ff=v3`.
- **Links:** every "Find my fit" / "Start fitting" → `/studio.html?ff=v3`. Add the "Try as" persona row (L16).
- **Honesty:**
  - Label the reviews, ratings and press quote as example content, and reduce reviewer names to initials.
  - Products we have no image for (putters, wedges, driver) get a grey placeholder.
- The user will run it in a separate session.

## Status (2026-11-07, evening)
- T0a–T5, T4a, T4b and T9 are done, on branch `feat/web-ui-v3`. v3 is the default studio; `?ff=legacy` shows the old one.
- **Scripts:**
  - `own.yaml` = the v3 walkthrough. It runs for an own fitting with no demo golfer: Welcome → "I'm ready".
  - `mikko.yaml` = the team spine from main (#17). DEMO-01 uses it.
  - Hannu, Lars and Anders come from main (#49). Anders shows R5 stock vs custom.
- **Open:**
  - T6 Takomo-style landing (separate session)
  - the "Later" list above
