# AGENTS.md — Takomo Fitter Studio

> **Read this entire file before touching any code.**
> This file governs every AI coding agent and human working in `since-ai-2026` during the **Since AI Hackathon 2026** ("The Fitter in Your Pocket" — Takomo Golf challenge, Team **Mankeli**).
> Full specs live in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) and [`docs/VISION.md`](docs/VISION.md). **Where `docs/IMPLEMENTATION_PLAN.md` (or any subdirectory `CLAUDE.md`) conflicts with this file — especially regarding tests — `AGENTS.md` wins.**

---

## 1. Hackathon Operating Mode (CRITICAL)

### 1.1 Hard Deadlines & Priorities
- **Code freeze:** Sunday 8 Nov **06:00 EET**.
- **Deliverables ready (video, slides, 1-page write-up, README, CSV):** Sunday **08:00 EET** (hard submission cutoff **10:00 EET**).
- **Judging weights:** Trust & UX **35%** · Idea **25%** · Accuracy **20%** · Feasibility **20%**.
- **Optimize for shipping visible, working demo value fast.** Do not gold-plate abstractions, build unrequested infrastructure, or work on Wave 2 / Final-phase items before the Mikko demo spine works end-to-end.
- **Unfinished UI or Wave 2 work MUST sit behind `?ff=<flag>`** so `main` stays demo-ready at every commit.

### 1.2 ABSOLUTELY NO TESTS (Overrides `IMPLEMENTATION_PLAN.md` §10.6)
- **DO NOT write unit tests, integration tests, parity tests, golden tests, injection tests, component tests, Vitest suites, pytest suites, Playwright tests, or any other automated tests.**
- **DO NOT** create `backend/tests/`, `test_*.py`, `*.test.ts`, `*.test.tsx`, or `*.spec.ts` files.
- **DO NOT** spend time configuring or running `pytest`, `vitest`, or `playwright`, and do not include test jobs in CI. Ignore every test requirement mentioned in `docs/IMPLEMENTATION_PLAN.md`.
- **How to verify your changes instead:**
  1. Static & build checks: `ruff check`, `ruff format --check`, `lint-imports` (backend); `pnpm -C web gen && pnpm -C web typecheck && pnpm -C web build` (frontend).
  2. Direct execution: start `just dev` (or call your Python function / curl your FastAPI route / open `studio.html?engine=scripted&demo=DEMO-01` or `dev.html`) and confirm it works.
- *(Note: Running `scripts/score_dev.py` / `takomo_fit.score` to generate the competition submission `mankeli_takomo_test_predictions.csv` is offline dataset scoring for the accuracy deliverable, **not** software testing — keep that script working.)*

### 1.3 4 Developers Working Simultaneously (Concurrency Rules)
**4 teammates (and 6–8 AI agents) are developing in parallel right now.** Merge conflicts and broken `main` are our biggest velocity killers. Follow these rules strictly:

1. **Always use an isolated git worktree + branch.**
   - Create worktrees under `.worktrees/<branch-slug>` on a short-lived branch (`feat/<lane>-<topic>`, `fix/<topic>`, `docs/<topic>`) branched from `origin/main`.
   - **Never commit or push directly to `main`.** Never `git push --force` on shared branches.
2. **Stay strictly inside your assigned lane's file globs (§2).**
   - Do **not** drive-by edit files owned by another lane.
   - If you need an endpoint, tool, or component from another lane that hasn't merged yet, code against `backend/app/schemas/` + static JSON in `fixtures/` and keep moving.
3. **Add new files — never contend on shared registries.**
   - **API routes:** `backend/app/api/routes/<lane>_<topic>.py` (one `APIRouter` per file, sorted autodiscovery in `main.py`).
   - **Agent domain tools:** `backend/app/agent/tools/<name>.py` (one `@fitter_tool` per file, sorted autodiscovery).
   - **Gen-UI components:** Adding a component touches **only 3 new files** — `backend/app/schemas/ui/<name>.py` (auto-registers `ui_<name>` tool + `UIBlock` union), `web/src/features/genui/blocks/<name>.tsx` (collected via `import.meta.glob`), and `fixtures/ui/<name>.json`. Never build a central switch/map file.
   - **CSV header aliases:** `backend/app/evidence/parsers/aliases/<vendor>.json` (one file per launch monitor).
   - **Settings:** `backend/app/config.py` holds *only* global settings (`LLM_MODE`, `STORE`, `ALLOWED_FRAME_ANCESTORS`, `PORT`). Put lane env vars in `<package>/settings.py` (`EVIDENCE_`, `AGENT_`, etc.).
   - **Session state:** `backend/app/schemas/state/` is split across `fit.py` (FIT), `evidence.py` (EVIDENCE), and `confidence.py` (FIT), composed into frozen `FittingState` in `__init__.py`.
4. **Never commit generated files.**
   - `generated/` (`openapi.json`, `schemas/*.json`), `web/src/api/schema.gen.ts`, and `web/public/mock/*.jsonl` are **gitignored**. Run `just gen` locally (and inside Docker/CI builds).
5. **Schemas are additive-only after `L0 SKELETON` merges.**
   - Add optional fields, new models, new UI blocks, or new routes freely. Never rename, remove, or change types of existing fields in `backend/app/schemas/` without coordinating with the owning teammate.
6. **Dependencies & lockfiles are frozen after `L0 SKELETON`.**
   - Do not add or upgrade packages in `backend/pyproject.toml` or `web/package.json` without checking with the lead. Never hand-edit `uv.lock` or `pnpm-lock.yaml` (resolve conflicts only with `uv lock` or `pnpm install`).
7. **Never hardcode dev ports.**
   - Multiple worktrees run side-by-side on one machine. Use `API_PORT` / `scripts/port.sh` (`.port` per worktree; web runs on `API_PORT + 1`).
8. **Scripted mode must always work with zero API keys.**
   - Default local/CI mode is `LLM_MODE=mock` (`?engine=scripted`). Never make `ANTHROPIC_API_KEY` required to boot the backend or click through the UI.

---

## 2. Parallel Lanes & Ownership Map

Check which lane your task belongs to and **only touch its owned paths**:

| Lane | Owned Paths (Globs) | Core Scope |
|---|---|---|
| **L0 SKELETON** | Root config, `justfile`, `vendor/`, `backend/app/{main.py,config.py,core/**,schemas/** (v0),persistence/{store,memory}.py}`, `backend/app/api/routes/session_*.py`, `web/` scaffold + `studio.html` shell + `src/host/standalone.ts`, `scripts/{gen_fixtures,port}.*` | App bootstrap, schemas v0, SSE stub, 16 demo fixtures (`DEMO-01..16.json`), pre-locked deps. |
| **INFRA** | `infra/**`, `.github/**`, `scripts/smoke.sh`, `.dockerignore`, import-linter config, `.claude/**` | Dockerfile, Cloud Run (`europe-north1`, tagged `--no-traffic` → smoke → shift traffic), `lint-imports` guardrails. |
| **FIT** | `backend/app/{pack,fitting,confidence}/**`, `backend/app/api/routes/fit_*.py`, `backend/app/schemas/{fit,confidence,tinker}.py`, `backend/app/schemas/state/{fit,confidence}.py`, `scripts/{gen_priors,score_dev,make_test_predictions}.py`, `mankeli_takomo_test_predictions.csv` | `takomo_fit` wrappers, input mapping + provenance, Monte Carlo confidence, close calls, `next_question`, flight/dispersion, tinker (<100 ms, no LLM), `.trace` explanations, test-split CSV. |
| **EVIDENCE** | `backend/app/evidence/**`, `backend/app/api/routes/evidence_*.py`, `backend/app/api/adapters/trackman_fetch.py`, `backend/app/schemas/evidence.py`, `backend/app/schemas/state/evidence.py`, `scripts/gen_thresholds.py`, `fixtures/trackman/**` | Pure parsers (TrackMan CSV, manual, round stats), deterministic plausibility/outlier flags (`S*`, `G*`, `V*`), inverse-variance fusion, synthetic TrackMan CSV fixture. |
| **AGENT** | `backend/app/agent/**`, `backend/app/api/routes/chat_*.py`, `backend/app/schemas/chat.py`, `backend/app/agent/mock/scripts/**` | Genkit + Claude 5.5 setup (or Anthropic SDK fallback), `@fitter_tool` domain tools, interrupt-based turn loop + atomic commit + lock, vision `extract.py`, persona scripts (`Mikko`, `Hannu`, `Lars`, `Anders`). |
| **WEB-APP** | `web/src/{features/{landing,studio-shell,chat,genui,result,mascot,ar},api,store,host}/**`, `web/{index,studio,dev,ar}.html`, `backend/app/schemas/ui/**`, `fixtures/ui/**`, `fixtures/{product_videos,forge_topics,simulators}.json` | Landing copy, desktop studio layout + TopBar (confidence, best-rec, missing-N, Save), SSE stream client, zustand stores, Gen-UI block components, result panels, SVG mascot. |
| **WEB-3D** | `web/src/features/{stage3d,flight,tinker}/**`, `web/public/models/**` | `FlightSvg.tsx` (2D side + top dispersion — ship first!), R3F 3D club stage (`PlaceholderHead` → GLB swap), camera focus/highlights, ghost club compare, debounced `TinkerPanel`. |
| **3D ASSETS** *(Issue #3, Matti)* | `assets/clubs/**`, Blender generation scripts | Parametric Blender GLBs (`manifest.json`, `heads/<slug>.glb`, `parts/{shaft,ferrule,grip}.glb`) matching the `L7` contract. |
| **FLOATER** *(post-spine, time-boxed)* | `backend/app/persistence/firestore.py`, `VoiceButton`, Rive mascot, `ar/` | Strict time-boxes only after spine works: Firestore (60m), ElevenLabs/Web Speech voice (90m), Rive mascot (90m), AR QR + Quick Look/Scene Viewer (90m). |
| **FINAL** *(post-Sun 04:00 gate only)* | `web/embed/**`, `web/src/host/{bridge,shopify,generic,mock-shopify-host}.ts`, `shopify/**`, mobile CSS | Runs **only** if every core item works on prod by Sun 04:00: (1) mobile stacked layout, (2) `embed.js` + mock cart drawer, (3) 90m Shopify Dawn dev store. |

---

## 3. Locked Decisions (`L1`–`L15`) — Do Not Reopen

1. **L1 — 3D Stack:** `three@0.187.0` via React Three Fiber (`@react-three/fiber@9.8.2`) + `@react-three/drei@10.7.9`. Build `FlightSvg.tsx` (2D SVG flight + dispersion) **first** as the default view, then the 3D club stage.
2. **L2 — Shopify Last:** Zero Shopify work (`embed.js`, iframe overlay, `postMessage` bridge, mock cart, dev store, App Proxy) until the **Final phase** (Sun 04:00 gate). Use `StandaloneAdapter` stub until then.
3. **L3 — Desktop First, Mobile Last:** Design and verify at **`1440×900` and `1280×800` only**. Desktop layout = 3D/flight stage on the left, chat + gen-UI on the right (shrinking to side panel on reveal). Use clean flex/grid CSS without fixed pixel widths, but add zero mobile-specific layouts/touch paths before Final phase.
4. **L4 / L5 — Delivery Format:** Pitch is slides + recorded walkthrough video + hosted Cloud Run URL (no live stage demo). Code freeze Sun 06:00; done Sun 08:00.
5. **L6 — 100% Synthetic Data:** No real TrackMan shots were captured. Generate TrackMan CSV fixtures from `shots.csv` with `event_kit/trackman_column_map.csv` headers/units and **label them synthetic**. The shared-report-link importer is **cut to a slide**. Never claim synthetic golfer data is real customer data.
6. **L7 — 3D Asset Contract (Issue #3):**
   - Paths: `assets/clubs/manifest.json`, `heads/<slug>.glb`, `parts/{shaft,ferrule,grip}.glb`.
   - Coordinate frame: metres; origin at sole ground-contact point at standard 7-iron address (62° lie); `+Y` up, `+Z` target line, `+X` toe; named `HoselSocket` node at top of hosel bore (`+Y` along shaft). Left-handed = `scale.x = -1`.
   - `PlaceholderHead` uses the exact same origin, axes, and `HoselSocket` so swapping real GLBs is a file drop. Read camera presets from `manifest.json`.
7. **L8 — 4 Demo Personas Only:**
   - **Mikko (`DEMO-01`, the core spine):** Claims 160 yd carry; 10 TrackMan `own_7i` shots average 124.7 yd → `G11` carry flag fires → measured 72 mph = bucket 3 (regular flex, not stiff) → confidence rises → flight + lie tinker + stock-vs-custom + Save.
   - **Hannu (`DEMO-09`):** Static chart vs dynamic lie evidence (ball-line tilt / labelled demo TrackMan fixture).
   - **Lars (`DEMO-04`):** Close call between `301-cb` and `301-mb` shown honestly with trade-offs.
   - **Anders:** Stock (30-day return) vs Custom (non-returnable) decision on a +1° lie change.
8. **L9–L14 — Scope Guards:**
   - Mascot: ship SVG placeholder first; Rive is a 90m FLOATER task (avoid cartoonish Forge style).
   - Confidence 30–50%: show result with `gate="provisional"` and `strength="low"` ("add data to firm this up").
   - Current-bag check (#16) and "don't buy yet" ending are **cut to slides**.
   - **Irons only**, plus a static *"Driver fitting is next"* teaser card in the result.
   - Embed Takomo product videos via `fixtures/product_videos.json` (approved). Label all social-proof stats as `"example"`.
9. **L15 — Accounts & Deliverable:** Anthropic Claude API + GCP Cloud Run owned by Jesse. Accuracy CSV filename: `mankeli_takomo_test_predictions.csv` at repo root (5,000 rows, every row passing `check_buildable`).

---

## 4. Non-Negotiable Architecture & Domain Invariants

### 4.1 Data & Participant Pack Rules
- **`data/` is strictly READ-ONLY.** Never edit, reformat, or write output files inside `data/`.
- **Never rewrite Takomo's fitting rules.** Call the organiser pack (`vendor/takomo_fit` symlink, `PYTHONPATH=vendor`) **exclusively** via typed wrappers in `backend/app/pack/__init__.py`: `baseline.recommend()`, `score_heads()`, `purchase_for()`, `physics.shot()`/`fly()`, `products.load()`.
- **Never import `takomo_fit.score` or `pandas` anywhere in `backend/app/`.** Runtime/Docker does **not** install `pandas` (`score.py` imports `pandas` at top level). Copy `WEIGHTS` (`head: 20, flex: 20, material: 10, shaft_model: 5, length: 12, lie: 15, grip: 8, purchase: 5, handedness: 5`) into `app/pack` and implement `check_buildable` without pandas using `purchase_for` (**never** use `takomo_products.json`'s `stock_set_requires`, which disagrees with `STOCK_GRIPS`).
- **Never touch `labels.csv` in `backend/app/`.** Ground truth is off-limits at runtime (only offline scripts `scripts/gen_priors.py` on `train` and `scripts/score_dev.py` on `dev` may read `labels.csv`; never tune on `test`).
- **Pack gotchas to remember:**
  - Validate `Answers` fields with Pydantic `Literal`s before calling the pack (`KeyError` on bad glove/tempo; unknown characteristics/flight silently ignored; only `characteristics[:3]` count).
  - Convert all numpy outputs (`float(np.ravel(x)[0])`, `.tolist()`) and deep-copy `products.load()` records (never mutate the cached dict; strip `_heads`/`_shafts`).
  - **Never pass bias-corrected carry into `swing_bucket_from_carry`** (ego bias and the pack's carry table cancel out). For carry-only golfers, estimate `speed_est = (carry - 15 + 63.3) / 2.536` → `swing_bucket_from_speed(speed_est)`.
  - With `lie_override_deg`: `lie_deg = int(np.clip(round(x), -3, 3))` (Python uses banker's rounding), re-call `purchase_for`, and append `"lie: evidence {x:+.1f} -> {n:+d}"` to `.trace`.
  - Batch `physics.shot` calls (scalar = ~20 ms; 1000 vectorised = ~67 ms) and run via `run_in_threadpool`. `POST /api/tinker` is deterministic (no LLM, <100 ms budget).
  - Seed Monte Carlo RNG deterministically via `hashlib.sha256(f"{session_id}:{evidence_version}".encode())`, **never** Python's salted `hash()`.

### 4.2 Backend Import Hierarchy (`import-linter` enforced)
Each layer may import **only** from layers below it:

```text
api          HTTP routes & adapters (only HTTP/network I/O layer)
agent        LLM orchestration, @fitter_tool wrappers, vision extract.py (ONLY importer of genkit / anthropic)
confidence   Monte Carlo, close_calls, gate, next_question (pure — no I/O, no LLM)
fitting      mapping, recommend, catalog, flight, trajectory, tinker, explain (pure — no I/O, no LLM)
evidence     parsers, plausibility rules, inverse-variance fuse (pure — no I/O, no LLM)
pack         ONLY importer of vendor/takomo_fit (RulesEngine boundary)
schemas      Hand-written Pydantic models & Protocol ports (imports nothing from app)
```
- `core/` imports only `schemas/`. `persistence/` imports only `schemas/` and `core/`.

### 4.3 Trust, Safety & LLM Boundaries
- **Deterministic math, LLM phrasing:** The LLM **never** invents specs, numbers, carry distances, confidence scores, or outlier judgments. Every number comes from a tool output (`run_fit`, `explain_part`, `compare_specs`, `simulate_flight`, `get_import_report`).
- **No LLM-supplied URLs or HTML:** Media/link props in UI schemas use enum IDs resolved from `fixtures/*.json`. Chat messages render plain text (bold + line breaks only). Cap CSV/vision strings to `^[\w %./°-]{0,32}$` and **never** pass raw free text from uploads into chat history (send numeric shot summaries + `FlagCode` enums only).
- **Brand & privacy rules:** Radical Finnish honesty (surface close calls, ego carry, and custom non-returnability even if it costs a sale). Never name or disparage competitors. Never say "fix your swing instead of getting fitted". Never gate results behind email (`GET /api/sessions/{id}` never returns `email`). Never store raw uploaded CSVs/screenshots or collect third-party credentials.

---

## 5. Tech Stack, Exact Pins & Critical Gotchas

### 5.1 Backend & AI (`backend/`, Python 3.12, `uv 0.13.x`)
- **Pinned AI packages (DO NOT UPGRADE):**
  - `genkit==0.13.0`, `genkit-anthropic==0.13.0`, `genkit-fastapi==0.13.0`, **`anthropic==0.112.0`** (Genkit's tested lock — newer `anthropic` 2.x breaks it; never install deprecated `genkit-plugin-*`).
  - **Fallback trigger:** If Genkit fails the 15:00 spike or costs >45 min on a bug, switch to `LLM_ENGINE=anthropic` (`AsyncAnthropic().beta.messages.tool_runner` behind the same engine interface).
- **Claude 5.5 Model Rules (`backend/app/agent/ai.py`):**
  - Register `claude-sonnet-5-5` and `claude-haiku-5-5` in `genkit_anthropic._model_info.SUPPORTED_ANTHROPIC_MODELS` by cloning the newest Constrained-Output base entry of the same family.
  - **Chat & Vision (`claude-sonnet-5-5`):** `thinking="adaptive"`, `thinking_display="summarized"` (keeps thinking blocks non-empty so Genkit sends them back on tool turns!), `effort="low"`, `cache_control={"type": "ephemeral"}`. **Never** pass `thinking="disabled"` or `tool_choice="required"` on Sonnet/Opus 5.5 (causes HTTP 400). Filter reasoning chunks out of SSE `text` events.
  - **Fast one-off tasks (`claude-haiku-5-5`):** `thinking="disabled"`, `effort="low"`.
  - **Vision structured output (`ExtractedSession`):** Keep the schema flat (`cells: list[Cell]`, all fields required) to stay well within structured-output grammar limits.
  - **Tool serialization:** Wrap every tool return in `genkit_engine.py` with `.model_dump_json()` (Genkit defaults to `str(output)` Python repr). Return `.text` or `.output`, never `ModelResponse`. Keep system prompt + sorted tool list byte-stable; inject per-turn state digest in the user message.

### 5.2 Turn Loop, State & SSE Streaming (`FastAPI >= 0.135`)
- `POST /api/sessions/{id}/turn` uses `fastapi.sse.EventSourceResponse` (15s keep-alive pings built in; **never** attach GZip middleware to SSE).
- **8 frozen SSE event types** (each with monotonic `seq`): `turn_start`, `text`, `ui`, `stage`, `state`, `mascot`, `done`, `error`.
- **Interrupt rule:** Input `ui_*` tools (`kind="ui_input"`) interrupt the turn immediately. **At most ONE interactive input component per turn** (any second input tool in the same response gets `"ignored: one input component per turn"`). The user's reply posts `{kind: "ui_response", component_id, value, display_text}`, which resumes that exact `tool_use` with a `tool_result` so message history is always valid.
- **Concurrency & atomicity:** Acquire per-session lock (`409` if busy), run the turn in a background task so disconnects don't corrupt history, and commit messages + `FittingState` atomically on completion.
- **State ownership:** Backend owns `FittingState.version`. Frontend `session` store keeps whichever `FittingState` has the highest `version` across SSE `state` events and REST responses.
- **Persistence:** `STORE=memory` (`InMemorySessionStore`) on single-instance Cloud Run (`--min-instances=1 --max-instances=1 --timeout=3600`). Round-trip every write through `encode_for_firestore()` (serialize nested arrays like `[[x,y,z,t]]` trajectories as JSON strings; cap docs < 900 KB).

### 5.3 Frontend (`web/`, Node 22, `pnpm@12.14.0`)
- **Pinned packages (DO NOT UPGRADE):**
  - `react@~19.3`, `react-dom@~19.3` (R3F 9.8 requires `<19.4`).
  - **`typescript@~5.9.3` — NEVER use TypeScript 7** (breaks `openapi-typescript` and `typescript-eslint`).
  - `three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`.
  - Tailwind v4 via `@tailwindcss/vite` (design tokens in CSS `@theme`, **no** `tailwind.config.js`), `shadcn/ui` (add to `src/components/ui/` via CLI only), `zustand`, `openapi-fetch`, `eventsource-parser`.
- **Multi-page Vite app (no router library):** `index.html` (landing copy → links to studio), `studio.html` (`?engine=scripted|live`, `?demo=DEMO-01`, `?ff=<flag>`), `dev.html` (UI block & stage preset gallery), `ar.html`.
- **R3F 60fps performance rules:**
  1. `<Canvas frameloop="demand" dpr={[1, 2]}>` loaded via `React.lazy` so chat renders immediately.
  2. **While dragging tinker sliders, mutate three.js refs directly** (`shaftRef.current.scale.y = ...`) and call `invalidate()`. **Never call React `setState` / zustand update on pointer-move ticks.** Commit store state when the debounced (150 ms) `POST /api/tinker` response returns.
  3. Reuse geometries/materials outside render; compress GLBs with meshopt (`@gltf-transform/cli optimize`).

---

## 6. Everyday Commands & Cut Order

### 6.1 Key Commands (Run from repo/worktree root)
```sh
just setup              # uv sync --project backend && pnpm -C web install && just gen
just gen                # Export OpenAPI + JSON schemas -> generate web/src/api/schema.gen.ts
just dev                # Run backend (uvicorn --reload) + frontend (vite) on worktree-local ports
just genkit             # Run backend with Genkit Dev UI at localhost:4000
just lint               # ruff check + ruff format --check + lint-imports + pnpm typecheck + pnpm lint
just gen-data           # Generate demo fixtures (never from labels), priors.json, thresholds.json
just score              # Evaluate mapping + recommend_fit on data/dev via takomo_fit.score
just preds              # Generate mankeli_takomo_test_predictions.csv (5,000 rows on data/test)
just record <persona>   # Record scripted SSE run to web/public/mock/<persona>.jsonl
```
*(Remember §1.2: Do **not** run or add `just test` / `pytest` / `pnpm test`.)*

### 6.2 Feature Priority: What Never Gets Cut vs. What Cuts First
- **NEVER CUT (The Core Spine):**
  1. Conversational intake (`choice_chips`, `slider`, `body_measure`) + deterministic `next_question` + form fallback
  2. Synthetic TrackMan CSV import (`data_import`) + v1 outlier flags (`S1, S3, S7, S8, S10, S14, G1, G2, G3, G11-carry, V6`) + `outlier_review`
  3. `recommend()` (`recommendation_card`) + provenance-backed `why_panel`
  4. Monte Carlo confidence meter + gate in `TopBar` (visibly rising after Mikko's TrackMan import)
  5. 2D `FlightSvg` with carry/apex + dispersion ellipses
  6. Deterministic tinker mode (`POST /api/tinker`, 3D club stage + flight diff)
  7. `stock_vs_custom` honesty (30-day return vs non-returnable custom) + confidence-gated honest ending
  8. Save / resume fitting + `mankeli_takomo_test_predictions.csv` (beating B2 `83.58` on `dev`)
- **CUT FIRST IF BEHIND SCHEDULE (in order):**
  1. Shopify embed + mobile layout (Final phase) → keep on slides
  2. AR (#20), Rive mascot (keep SVG), Voice (#18)
  3. Round-stats & launch-monitor screenshot vision imports (#15) → keep CSV import
  4. 3D ball-flight view (`FlightView3D` — `FlightSvg` is already the default) & 5-head 3D club row
  5. Wave 2 Gen-UI components & Wave 2 outlier rules (hide unfinished items behind `?ff=`)
