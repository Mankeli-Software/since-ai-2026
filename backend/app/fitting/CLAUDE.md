# backend/app/fitting/CLAUDE.md

Pure layer: mapping, recommend, catalog, flight, trajectory, tinker, explain. **No I/O, no LLM**, no `genkit`,
`anthropic`, `httpx` or `takomo_fit` imports. Reach the pack only through `app.pack` (see `../pack/CLAUDE.md`
for the `Answers` Literals, `.trace` prefixes and gotchas; they all apply here).

## Modules (plan §3.2)

| Module | Job |
|---|---|
| `mapping.py` | `build_answers(intake, evidence) -> MappedAnswers` with provenance per field (plan §3.3). Shared by the app and `scripts/make_test_predictions.py`. |
| `recommend.py` | `recommend_fit(answers, top_n=2, lie_override_deg=None) -> FitResult`; `head_ranking(answers)` for all 5 heads |
| `catalog.py` | `check_buildable(spec)` without pandas (shaft on head, length/lie in options, grip in `GRIP_ORDER`, handedness, purchase via `purchase_for`); `list_products` merges `fixtures/product_videos.json` |
| `flight.py` / `trajectory.py` | batched `physics.shot` dispersion; RK4 copy of `physics.fly` that records points (carry within 0.1 yd) |
| `tinker.py` | deterministic spec diff, < 100 ms, no LLM; re-pick the shaft when switching MKII ↔ 301 |
| `explain.py` | why items from `.trace` + provenance; Mikko's one own-loft line (number from `physics.shot`) |

## Rules

- Every field carries provenance `{value, source, sd, flags[]}`; the why panel cites it.
- Lie evidence: **test-club Dynamic Lie overrides** the chart; own-7-iron Dynamic Lie and the ball-line test are
  **fused** with the chart, never override it. TrackMan Dynamic Lie is absolute: `toe_up = dynamicLie − club_lie` (62°).
- Swing bucket from shots: mean of non-rejected shots minus the per-session bias from `priors.json`.
  Carry-only: `speed_est = (carry − 15 + 63.3) / 2.536` → `swing_bucket_from_speed`. Never `swing_bucket_from_carry` on a corrected carry.
- Seed any RNG from `hashlib.sha256(f"{session_id}:{evidence_version}".encode())`, never `hash()`.
- Accuracy changes ("*exp*" flags) are kept only if `just score` on dev improves. Never tune on `test`.
- Don't claim our head matches the pack's reference for Mikko (201T MKII here, 201 MKII in the reference).
