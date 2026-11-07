# backend/app/pack/CLAUDE.md

`app/pack/__init__.py` is the **only** module that imports `takomo_fit` (vendor symlink, `PYTHONPATH=vendor`).
Everything above talks to a small `RulesEngine` Protocol (`recommend`, `score_heads`, `purchase_for`, `catalog`)
so Takomo's next rules version is a one-file swap. Never reimplement a rule; wrap it. Never edit `data/`.

## Hard rules

- **Never import `takomo_fit.score`** (it imports `pandas`, which the image doesn't install). `WEIGHTS` is a copy:
  `head 20, flex 20, material 10, shaft_model 5, length 12, lie 15, grip 8, purchase 5, handedness 5`.
- Never read `labels.csv` here or anywhere in `app/`.
- Everything returned is plain JSON: `float(np.ravel(x)[0])`, `.tolist()`. No numpy scalars leave this package.
- `products.load()` is cached: **deep-copy** records, strip `_heads` / `_shafts`, never mutate the dict.
- Buildability uses `purchase_for`, **never** `takomo_products.json`'s `stock_set_requires` (it disagrees with
  `STOCK_GRIPS = ("standard", "midsize")`).

## `baseline.Answers` (validate with Pydantic `Literal`s before calling the pack)

| Field | Values |
|---|---|
| `age` | int |
| `sex` | `"male"` \| `"female"` |
| `score_bucket` | 1..5 (Under 71, 71-77, 78-84, 85-92, Over 92) |
| `swing_bucket` | 1..5 |
| `characteristics` | up to 3 of `forgiveness, distance, forged feel, distance control, workability, less offset, more offset` |
| `flight` | `low` \| `mid` \| `high` |
| `tempo` | `smooth` \| `moderate` \| `quick` |
| `height_cm`, `wrist_to_floor_cm` | float |
| `glove` | `XS S M M/L L XL` (`GLOVE_ORDER`) |
| `handedness` | `right` \| `left` |

The pack raises `KeyError` on a bad glove or tempo, **silently ignores** an unknown characteristic or flight,
and only `characteristics[:3]` count. That is why the Literals come first.

Other constants: `HEAD_ORDER = 101-mkii, 201-mkii, 201t-mkii, 301-cb, 301-mb`; `GRIP_ORDER = standard, midsize, oversize`.

## `.trace` prefixes (what `explain.py` parses)

`head: <slug> total N = skill + speed ...` · `shaft: ...` · `length: ...` · `lie: PING-style static chart ...` ·
`grip: <size> from glove <g>` · `purchase: stock|custom`. With an evidence lie override we append
`lie: evidence {x:+.1f} -> {n:+d}` (the pack trace only covers the static chart).

## Gotchas

- **Lie override:** `lie_deg = int(np.clip(round(x), -3, 3))`. Python `round` is banker's rounding (`round(2.5) == 2`).
  Then **call `purchase_for` again**, because lie ≠ 0 makes the club custom.
- **Glove from a hand photo:** `GLOVE_ORDER[int(np.digitize(cm, GLOVE_EDGES_CM))]`. An edge value lands in the
  **upper** size.
- **Never pass a bias-corrected carry into `swing_bucket_from_carry`** (the ego bias and the pack's carry table
  cancel out). Carry-only: `speed_est = (carry - 15 + 63.3) / 2.536` → `swing_bucket_from_speed(speed_est)`.
- **MKII vs 301 heads use different shaft slugs:** re-run `pick_shaft(new_head, answers)` when the family changes.
- **Physics is slow per call:** scalar `physics.shot` ≈ 20 ms, 1000 vectorised ≈ 67 ms. Batch heads × samples
  into one call, cache by input hash, run via `run_in_threadpool`. `recommend(top_n=5)` ≈ 31 µs.
- **Left-handers:** face, path and side are already in the target frame; only `impact_offset_mm` and the sign of
  `lie_face_effect_deg()` flip.
