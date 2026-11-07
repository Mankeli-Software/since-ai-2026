@AGENTS.md

# CLAUDE.md (root)

Takomo Fitter Studio: an AI iron fitter that runs Takomo's own rules, shows how sure it is, and is honest
when the answer is a close call. Source of truth: `docs/IMPLEMENTATION_PLAN.md` (it wins over AGENTS.md).

- **Lanes and file ownership:** AGENTS.md §2 (plan §11.1). Stay inside your lane's globs.
- **Subfolder rules load on demand:** `backend/CLAUDE.md`, `backend/app/{pack,fitting,evidence,agent}/CLAUDE.md`,
  `web/CLAUDE.md`. Read the one for the folder you are editing.

## Commands (run from the repo or worktree root)

```sh
just setup            # uv sync --project backend, pnpm -C web install, just gen
just gen              # backend/app/schemas -> generated/*.json -> web/src/api/schema.gen.ts
just dev              # uvicorn --reload on API_PORT + vite on API_PORT+1 (port from scripts/port.sh, cached in .port)
just genkit           # backend under the Genkit Dev UI (localhost:4000)
just lint             # ruff check, ruff format --check, lint-imports, pnpm typecheck, pnpm lint
just check            # gen + lint: run before every PR
just gen-data         # demo fixtures, priors.json, thresholds.json
just score            # dev-split accuracy via takomo_fit.score (offline scoring, not a test)
just preds            # mankeli_takomo_test_predictions.csv
just record <persona> # scripted SSE run -> web/public/mock/<persona>.jsonl
just smoke [url]      # deploy health check
```

Verify by hand: `just check`, then `just dev` and open `studio.html?engine=scripted&demo=DEMO-01`
(or `dev.html` for blocks). Curl your route. There is no `just test` and there never will be.

## Invariants (break one and the PR is reverted)

1. **Never edit `data/`.** It is the organiser pack, read-only. `vendor/takomo_fit` is a symlink into it.
2. **Never reimplement Takomo's rules.** Call them through `backend/app/pack` only.
3. **Never import `takomo_fit.score` or `pandas` in `backend/app/`.** Never read `labels.csv` in `backend/app/`.
4. **Only `backend/app/agent/` imports `genkit` or `anthropic`.** The layer contract is enforced by `lint-imports`.
5. **Schemas are additive-only** after the skeleton PR: add optional fields, models, blocks, routes; never rename,
   remove or retype without the owning lane.
6. **Generated files are never committed** (`generated/`, `web/src/api/schema.gen.ts`, `web/public/mock/`). Run `just gen`.
7. **No tests (L17).** No `tests/`, `test_*.py`, `*.test.ts(x)`, `*.spec.ts`, pytest, Vitest or Playwright.
8. **The scripted engine works with zero API keys.** `LLM_MODE=mock` is the default; never require `ANTHROPIC_API_KEY` to boot.
9. **One file per route, tool, gen-UI component, parser alias or rule.** Never edit a central switch or map;
   registries autodiscover (sorted).
10. **Unfinished UI goes behind `?ff=<flag>`.** `main` is demo-ready at every commit.
11. **Never present synthetic data as real.** All TrackMan data is synthetic (L6); personas wear a "Simulated golfer" badge.
12. **Never name or disparage competitors.** Mild language only, no swing tips, no practice advice (L18).
13. **Desktop first, mobile last (L3).** Build and check at 1440×900 and 1280×800; no mobile-only code before the Final phase.
14. **Deterministic math, LLM phrasing.** Every number shown comes from a tool output, never from the model.
15. **Never hardcode dev ports.** Use `API_PORT` / `scripts/port.sh`.
16. **Deps and lockfiles are frozen** after the skeleton PR. Never hand-edit `uv.lock` or `pnpm-lock.yaml`.

## Definition of done

- `just check` passes; the change works in `just dev` (scripted engine, no keys).
- Only your lane's files changed; nothing generated is staged; no test files.
- Small PR from a worktree branch (`feat/<lane>-<topic>`) to `main`; never push to `main` directly.
