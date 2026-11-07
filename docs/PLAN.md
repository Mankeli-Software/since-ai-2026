# Fix plan for IMPLEMENTATION_PLAN.md and VISION.md

> Sat 7 Nov 2026. Scope: the remaining gaps from the plan review and `docs/argon_issues.md`.
> Everything here is a **docs change** to `docs/IMPLEMENTATION_PLAN.md` (the plan) and `docs/VISION.md`, not app code.
> Each item was **verified against the current docs, the pack or GitHub** before it was listed. Nothing below has been implemented yet.

**Order of work:** (1) answer the decisions in §1; (2) apply the doc fixes in §2; (3) run the checks in §4; (4) commit and push both docs together.

## Status (Sat 7 Nov, 14:40)

**Decisions:**
- **D1:** mild language only.
- **D2:** no swing tips and no practice advice; VISION §6.9 changed.
- **D3:** a shared effort all the way through. Slides and write-up go to GitHub and the hackathon platform; the video goes to YouTube and the hackathon platform.
- **D4:** Saturday times shifted +1.5 h (skeleton 15:00–15:45); Sunday unchanged. The early-Sunday cut-offs are compressed: 00:30 → 01:30 and 02:00 → 02:30.
- **D5:** USDZ is assumed to be delivered by issue #3.
- **D6:** no GitHub issues yet. When they are created, make **smaller issues, per-lane style**, not one big issue per lane.
- **D7:** `argon_issues.md` is not committed. It is deleted after these fixes.

**Fixes:**
- **Applied:** F1 (desktop first, mobile last), F2, F3, F4, F5 (plus D4), F6, F7, F8, F10, F11, F12, F14, F15. The §4 checks all pass.
- **Not done:** F9 (brand). Juho is handling brand. The D1 language rule and the VISION brand-book pointer were applied, because they aren't styling.
- **F13:** applied (plan §11.2: Hannu and Anders are the "honest at a cost to the sale" moments).
- **Decisions D1–D6:** recorded in the plan as locked decisions **L18–L22**. D7 needed no plan change.
- **AGENTS.md:** brought in line with the plan, which is now the source of truth (its header says so). One difference was left on purpose: the plan's "small PRs, about 300 lines" rule (§10.6) stays out of AGENTS.md, because commit `59d8689` removed it deliberately. The team should decide which one is right.

---

## 0. Already resolved (verified in the current docs)

| # | Gap | Where it is fixed |
|---|---|---|
| R1 | Hannu had no way to enter his ball-line test | Plan §5.1 (`data_import` → `ball_line`, `POST /imports/ball-line`, G15), L8 |
| R2 | Lie evidence only from one club; Mikko's 3-club session | Plan §5.5 precision follow-up; §5.1 `Club` column grouping; own-7-iron fallback in §3.3 |
| R3 | Demo sessions used phone data the app can't collect | Plan §6.6 (no phone measurements in persona sessions) |
| R4 | Judges had nothing to import | Plan L16, §6.6 "Try as" picker |
| R5 | Mikko's 28° loft story orphaned by L11 | Plan §5.3 (one `explain.py` line) |
| R6 | Issue #4 described as empty (Q23) | Plan §14 Q23 (20-min static `product_videos.json`) |
| R7 | CI `fit-quality` job couldn't import `examples.baselines` | Removed with all tests (L17) |
| R8 | Dynamic Lie scale (absolute ~62° vs pack delta) | Plan §5.1: subtract 62° when values sit in 45–80°. Confirmed by issue #1's data dictionary: `dynamicLie` is the "angle of the lower portion of the shaft relative to the ground at impact" |

---

## 1. Decisions needed before the doc fixes

| # | Question | Verified context | Recommendation |
|---|---|---|---|
| D1 | **How much swearing may the assistant use?** | The brand book uses "BS", "s\*\*\*", "F\*\*\* that" and "give a shit" in its own copy (slides 4, 5, 7, 21, 22). The plan's system prompt (§4.6) says nothing. | Mild only: "BS" yes, starred words never, nothing stronger. One line in §4.6 principle 1. |
| D2 | **Swing tips: brand book or VISION?** | Plan §4.6 now says "no swing tips" (brand book slide 12: "They dont give you swing tips"). VISION §6.9 still allows "swing-improvement tips … framed as practice advice". | Follow the brand book. Change VISION §6.9 to "equipment limits and honest advice, such as booking a lesson". |
| D3 | **Who owns the slides, write-up and video (Q24), and where do we submit?** | The challenge brief §07 lists the deliverables (PoC, one-page write-up, repo with README) but not where or how to submit. | Name one person now, not at 22:00. Ask the organisers (contact in the brief) for the submission channel. |
| D4 | **Re-baseline the timeline?** | `argon_issues.md`: the 12:30 and 13:30 gates passed with no app code on main. §11.2 still shows the original times. | Shift every Saturday gate in §11.2 and §11.3 by the actual delay once the skeleton merges; keep the Sunday times (L4). Needs the real start time. |
| D5 | **iOS AR without a USDZ?** | Issue #3 lists `ar/<slug>.{glb,usdz}` as **optional**. Plan §6.3 step 3 assumes a USDZ exists. | Ask Matti whether USDZ is coming. If not: Android Scene Viewer (GLB) only, and iOS shows "AR on Android for now". |
| D6 | **Create the 8 per-lane GitHub issues `argon_issues.md` suggests?** | Only issues #1–#4 exist. | Optional. It's an external action, so only on a yes. |
| D7 | **Commit `docs/argon_issues.md`?** | It is untracked. Its findings are now folded into the plan (marked "(argon)"). | Commit it, so the "(argon)" marks have a source. |

---

## 2. Doc fixes (apply after §1)

### 2.1 Contradictions

| # | Fix | Verified location | Change |
|---|---|---|---|
| F1 | "mobile first" in the root `CLAUDE.md` rules | Plan §10.2, `/CLAUDE.md` row | → "desktop first (L3)" |
| F2 | Scripts for "the other story personas" | Plan §4.7 ("Then Hannu and Lars, then the other story personas") | → "Then Hannu, Lars and Anders (L8). No other personas." |
| F3 | Leftovers from the real TrackMan capture (L6) | Plan §5.2 "Real devices are looser … Re-tune S5, S10 and S12 on the raw TrackMan CSV export"; §5.4 option B "Verify the fetch at the 11–12 simulator session"; §5.4 `dynamicLie` row "Check the sign on the real capture"; §5.1 `trackman_report.py` row (still "W2, 60-min box"); §8.3 "Real people in the demo … CONSENT_FORM"; §10.1 tree `trackman/*.csv\|*.json (real capture + recorded report fixture)`; §13 rows for the TrackMan endpoint and real-person consent | Rewrite each as "no real capture (L6)": keep the loose real-device tolerances with no re-tuning; mark option B and `trackman_report.py` as cut (slide only); drop the consent bullet; tree → "synthetic fixtures (L6)"; mark the two risk rows "cut by L6". |
| F4 | Dynamic Lie sign | Plan §5.1 ("The sign still needs checking (§14)") and §5.4 `dynamicLie` row | Settled by the definition (R8): **`impact_toe_up_deg = dynamicLie − club_lie`** (shaft more upright than the club's lie = toe up). Use 62° + the built lie for Takomo test clubs, and 62° for an own club whose lie is unknown, with the own-club caveat from §3.3. Remove "needs checking". |
| F5 | Stale times | Status line "12:30 EET"; §0 Frontend row "decided by 12:30"; §6.1 "Decide by 12:30. After that it is React."; §12 step 0 "(FIT, by 12:30)"; §9.3 prod engine "scripted until the 20:00 checkpoint"; §10.6 "Freeze (Sun 10:00 or as derived …)" | Status → v3.1 and today's time; Frontend and §6.1 → "React (L1)", delete the SvelteKit fallback text; §12 → "13:30–14:00 (§11.2)"; §9.3 → "until the 21:00–22:00 checkpoint (§11.2)"; freeze → "Sun 06:00 (L4)". Apply D4's shift on top. |
| F6 | Rule G15 sits above G14 | Plan §5.2 golfer table | Move the G15 row below G14. |
| F7 | VISION is stale on the brand book and facts | VISION §4.6 "The brand book arrives later via Discord"; §11 "Brand book, coming via Discord" and "25 shafts" (the pack has 35 shaft builds); §11 "TrackMan session on Saturday … for real data" (L6: nothing captured); §12 brand-book open question | Point to `data/docs/2025-02_Takomo_Brand_Book_public_version_compressed.md`; "35 shaft builds"; "no real data was captured (synthetic only)"; drop the brand-book open question. Apply D2 to §6.9. |

### 2.2 Will fail when built

| # | Fix | Verified location | Change |
|---|---|---|---|
| F8 | Contract export can't import `app` or `takomo_fit` | Plan §9.2 frontend-checks step `uv run --project backend python -m app.core.export --out generated`; §10.4 `gen:` recipe (same command from the repo root). The justfile exports `PYTHONPATH=vendor` only; CI sets nothing. | Run it from `backend/` with the pack on the path: `cd backend && PYTHONPATH=../vendor uv run python -m app.core.export --out ../generated` in both places. Also fix the §10.3 diagram. |

### 2.3 Missing from the plan

| # | Fix | Verified context | Change |
|---|---|---|---|
| F9 | **Brand book** | No colour or font tokens anywhere in the plan; §13 still lists "Brand book arrives late". Measured contrast: Tiger Orange on Washed White **2.64:1 (fails AA)**, orange on Midnight Black 7.01:1, black on orange 7.01:1, black on white 18.53:1. | New §6.7 "Brand": tokens in CSS `@theme` (`--midnight-black #0B0B0B`, `--washed-white #F8F8F8`, `--tiger-orange #FF6E01`, never `#000`); 60/30/10 leaning dark; Barlow Condensed for headlines, Barlow for body; orange for accents, large text and buttons with black labels, never small text on white; the neutral main-site look, not the cartoon content style; the claim "Honestly better golf". Add the four tone rules and "the best random ever" to §4.6 principle 1, plus D1. Add the tokens to the `web/CLAUDE.md` row. Mark the §13 risk resolved. |
| F10 | **ElevenLabs key** | §9.3 `.env.example` list has no voice key; deploy passes only `ANTHROPIC_API_KEY`; the runtime SA can read "the one secret only". | Add `ELEVENLABS_API_KEY` to `.env.example`, Secret Manager, the deploy `secrets:` line and the runtime SA's access, **only if voice ships** (L11). The Web Speech fallback needs no key. |
| F11 | **USDZ** | Plan §6.3 step 3 "Keep an uncompressed GLB plus a USDZ for AR" | Use issue #3's `assets/clubs/ar/<slug>.{glb,usdz}`. Apply D5. |
| F12 | **UI with no home** | Driver teaser card appears only in L13, the Wave 2 row and Q13; social proof only in L14; the form fallback (#3) has endpoints (§3.8) and is "never cut" (§11.3) but no web component | Add to §4.4 and §6.2: `driver_teaser` (display, static, W2, WEB-APP); a `social_proof_id` prop on `recommendation_card`, resolved from `fixtures/social_proof.json`, always labelled "example" (L14); `features/form/FormFallback.tsx` (v1, WEB-APP) that walks `GET /next-question` and `PATCH /profile`, opened from the top bar. |
| F13 | **"Honest at a cost to the sale" moment** (VISION §10) | No demo moment is named; "don't buy yet" is a slide (L11). | Name it in §11.2 and the demo script: **Hannu**, where the studio says "don't buy until you've hit 5 test-club shots" (§5.5), and **Anders**, where it asks whether +1° is worth losing the 30-day return. |
| F14 | **Effort check and usability pass** (VISION §10) | No check that the no-import path is as light as today's form (12 questions). L17 rules out automated tests. | Add to the 05:00 bug bash (§11.2), as manual checks: the "Start my own fitting" path with no imports takes **12 inputs or fewer**; one person outside the team walks the Mikko run unaided. |
| F15 | **≤ 8 model calls vs one input per turn** | AGENT lane: "Live Mikko run with ≤ 8 model calls"; argon M6 | Note in the AGENT lane that `onboarding_card` (§4.4) plus the deterministic `next_question` is what makes ≤ 8 reachable, and that the count is checked by hand from the JSON call log (§4.2). |

---

## 3. What this plan does not change

- The locked decisions L1–L17, except where §1 asks.
- The (argon) and v3.1 additions already in the plan, which were verified when they were added.
- Any app code. There is none on main yet.

## 4. Checks after applying (manual, no test pipeline)

Run each from the repo root. Each line should print nothing:

```sh
grep -n "mobile first" docs/IMPLEMENTATION_PLAN.md
grep -n "other story personas" docs/IMPLEMENTATION_PLAN.md
grep -n -e "real capture" -e "Re-tune S5" -e "11–12 simulator session" -e "Real people in the demo" docs/IMPLEMENTATION_PLAN.md
grep -n -e "sign still needs checking" -e "Check the sign on the real capture" docs/IMPLEMENTATION_PLAN.md
grep -n -e "by 12:30" -e "Decide by 12:30" -e "20:00 checkpoint" -e "Sun 10:00 or as derived" docs/IMPLEMENTATION_PLAN.md
grep -n "uv run --project backend python -m app.core.export" docs/IMPLEMENTATION_PLAN.md
grep -n -e "arrives later" -e "coming via Discord" -e "25 shafts" -e "Swing-improvement tips" docs/VISION.md
```

And each of these should print at least one line:

```sh
grep -n "#FF6E01" docs/IMPLEMENTATION_PLAN.md
grep -n "ELEVENLABS_API_KEY" docs/IMPLEMENTATION_PLAN.md
grep -n -e "driver_teaser" -e "social_proof_id" -e "FormFallback" docs/IMPLEMENTATION_PLAN.md
grep -n "dynamicLie − club_lie" docs/IMPLEMENTATION_PLAN.md
```

Finally, read the changed sections once end to end for leftover contradictions, then commit both docs together.
