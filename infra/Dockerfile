# syntax=docker/dockerfile:1.7
# Takomo Fitter Studio: one image, FastAPI serving the API and the built web app (plan §9.1).
# Build context is the repo root:  docker build -f infra/Dockerfile .
# The runtime has NO pandas (pandas is in the `dev` group only; takomo_fit.score is never imported in app/).

# ---------------------------------------------------------------------------------------------
# py: one Python stage that feeds both the contract export and the runtime.
# ---------------------------------------------------------------------------------------------
FROM python:3.12-slim-trixie AS py
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never PYTHONPATH=/app/vendor LLM_MODE=mock STORE=memory
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=backend/uv.lock,target=uv.lock \
    --mount=type=bind,source=backend/pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev
# The organiser pack, at the same import path as the repo's vendor/takomo_fit symlink.
COPY data/TakomoGolf_SinceAI2026_FINAL/TAKOMO_FITTING_LAB_2026/takomo_fit /app/vendor/takomo_fit
COPY backend/ /app
# `fixture[s]` is a glob so the build does not fail before the L0 skeleton adds fixtures/
# (an unmatched glob copies nothing). Can become `COPY fixtures /app/fixtures` once it exists on main.
COPY fixture[s] /app/fixtures/

# ---------------------------------------------------------------------------------------------
# contracts: openapi.json + schemas/*.json for the web codegen (plan §10.3). Nothing is committed.
# ---------------------------------------------------------------------------------------------
FROM py AS contracts
RUN /app/.venv/bin/python -m app.core.export --out /out

# ---------------------------------------------------------------------------------------------
# web: Vite multi-page build -> /repo/web/dist
#
# TEMPORARY: web/ (issue #35) is not on main yet, but the image must build, run and pass the
# health check today. So every web/ COPY below is a glob (`we[b]`) that copies nothing while
# web/ is missing, and pnpm only runs when web/package.json exists; otherwise a placeholder
# index.html is emitted. Once #35 lands, simplify this stage back to plan §9.1:
#   COPY web/package.json web/pnpm-lock.yaml ./
#   RUN pnpm install --frozen-lockfile
#   COPY web/ ./
#   ...
#   RUN pnpm gen && pnpm build
# ---------------------------------------------------------------------------------------------
FROM node:22-slim AS web
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /repo/web
RUN corepack enable                                               # uses web/package.json "packageManager"
COPY we[b]/package.jso[n] we[b]/pnpm-lock.yam[l] ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    if [ -f package.json ]; then pnpm install --frozen-lockfile --store-dir /pnpm/store; fi
COPY we[b] ./
COPY fixture[s] /repo/fixtures/
# Issue #3 GLBs, AR files and photo cutouts. Without this Cloud Run 404s on every model.
# (assets/clubs/qa/ is excluded in .dockerignore.)
COPY assets/clubs /repo/web/public/assets/clubs
COPY --from=contracts /out /repo/generated
RUN if [ -f package.json ]; then \
      pnpm gen && pnpm build; \
    else \
      echo "web/package.json not found: emitting placeholder dist (remove once #35 lands)"; \
      mkdir -p dist && cp -a public/. dist/ && \
      printf '%s\n' \
        '<!doctype html>' \
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' \
        '<title>Takomo Fitter Studio</title></head>' \
        '<body style="font-family:system-ui,sans-serif;margin:3rem">' \
        '<h1>Takomo Fitter Studio</h1><p>The API is up. The web app is not built yet (issue #35).</p>' \
        '<p><a href="/api/health">/api/health</a></p></body></html>' \
        > dist/index.html; \
    fi

# ---------------------------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------------------------
FROM py
COPY --from=web /repo/web/dist /app/static
EXPOSE 8080
CMD ["/app/.venv/bin/uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--proxy-headers","--forwarded-allow-ips=*"]
