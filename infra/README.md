# infra

One Cloud Run service, `fitter`, in `europe-north1`, built from [`infra/Dockerfile`](Dockerfile) and deployed by
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (plan §9). This file holds the one-time GCP setup for
issue #11, to run **by hand** (Jesse). CI never creates cloud resources.

## How CI deploys (plan §9.2)

- **Every PR and every push to `main`:** `backend-checks` (ruff, `lint-imports`), `frontend-checks` (contract export,
  `pnpm gen/typecheck/lint/build`), `build-image` (Docker build, run the container, `scripts/smoke.sh`). No test jobs (L17).
  Each job skips cleanly while `backend/` or `web/` are not on `main` yet.
- **Push to `main` only:** `build-image` pushes `europe-north1-docker.pkg.dev/takomo-fitter/app/fitter:<sha>`, then `deploy`
  creates a revision tagged `sha-<7>` with `--no-traffic`, runs `scripts/smoke.sh` on the tag URL, and only then moves
  traffic to it. A revision that fails the smoke gets no traffic; prod stays on the last good one.
- **Gates:** the push and the deploy run only when the GitHub Variables below are set, so CI is green before #11 is done.
  `DEPLOY_ENABLED=false` freezes deploys (§10.6). The very first deploy creates the service, and Cloud Run does not allow
  `--no-traffic` on create, so that one revision takes traffic directly (nothing to protect yet).

Build and smoke locally (needs `backend/` on the branch):

```sh
docker build -f infra/Dockerfile -t fitter:local .
docker run --rm -d --name fitter -p 8080:8080 fitter:local
scripts/smoke.sh http://localhost:8080
docker rm -f fitter
```

## Team access (Juho, Matti)

Project `takomo-fitter` (region `europe-north1`). Jesse is Owner; Juho Torkkeli and Matti Mäki-Kihniä have the
**Admin** role (`roles/admin`, full control, including access management and project deletion). Deploys happen through
GitHub Actions on every push to `main`, so changing things by hand is rarely needed.

### Web UI

Sign in with your private Gmail (check the account switcher, top right).

- Dashboard: <https://console.cloud.google.com/home/dashboard?project=takomo-fitter>
- Cloud Run service `fitter` (URL, versions, traffic, logs):
  <https://console.cloud.google.com/run/detail/europe-north1/fitter?project=takomo-fitter>
- Logs: <https://console.cloud.google.com/logs/query?project=takomo-fitter>
- Secret `anthropic-api-key`:
  <https://console.cloud.google.com/security/secret-manager/secret/anthropic-api-key/versions?project=takomo-fitter>
- Docker images: <https://console.cloud.google.com/artifacts/docker/takomo-fitter/europe-north1/app?project=takomo-fitter>
- Live app: <https://fitteri.mankelisolutions.fi> (custom domain, see below) or
  <https://fitter-n3x3h3wroq-lz.a.run.app> (Cloud Run URL). Health check: `/api/health`.

### CLI

Install the gcloud CLI (<https://cloud.google.com/sdk/docs/install>), then:

```sh
gcloud auth login your.name@gmail.com
gcloud config set project takomo-fitter
gcloud config set run/region europe-north1
```

Common commands:

```sh
gcloud run services describe fitter --format='value(status.url)'   # live URL
gcloud run revisions list --service fitter                          # deployed versions
gcloud run services logs read fitter --limit 50                      # recent logs
gcloud beta run services logs tail fitter                            # live logs
just smoke https://fitter-n3x3h3wroq-lz.a.run.app                    # health check from the repo
```

### Adding the Claude key (Juho)

Never paste the key into GitHub, Discord or a commit.

```sh
printf %s "$ANTHROPIC_KEY" | gcloud secrets versions add anthropic-api-key --data-file=-
gcloud run services update fitter --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest
```

The second command makes the running service pick up the new key; the next deploy also picks it up.

### Rules

- **Deploy only by merging to `main`.** CI health-checks every new version before it gets traffic. Avoid
  `gcloud run deploy` by hand.
- **Don't change billing, access (IAM) or delete the project**, even though Admin allows it.
- **Costs:** a €10 budget alert on the project emails Jesse (billing-account budgets aren't visible to project Admins).
  Cloud Run is capped at 1 instance, and the image registry keeps only the newest 5 images.
- **Freeze at Sun 06:00:** set the GitHub variable `DEPLOY_ENABLED` to `false` (see "Freeze" below).

## Custom domain: `fitteri.mankelisolutions.fi`

The whole app (studio, API and SSE) is served at <https://fitteri.mankelisolutions.fi> through a **Cloud Run domain
mapping** to the `fitter` service. It is free and uses a Google-managed certificate. The `*.run.app` URL keeps working,
and every deploy updates both.

| Where | What |
|---|---|
| Cloud Run | Domain mapping `fitteri.mankelisolutions.fi` → service `fitter`, region `europe-north1` (created Sat 7 Nov) |
| Cloudflare (`mankelisolutions.fi` zone) | `CNAME fitteri → ghs.googlehosted.com`, **DNS only (grey cloud)** |
| Google Search Console | `mankelisolutions.fi` is verified; `jesse.m.lappalainen@gmail.com` was added as an Owner so it can create mappings |

Keep the Cloudflare record **DNS only**. With the proxy on, Google can't renew the certificate and Cloudflare may
buffer SSE. The mapping is a Cloud Run **preview** feature: fine for the demo, but Google recommends a load balancer for
production (about €18 a month, so not used here).

```sh
gcloud beta run domain-mappings describe --domain fitteri.mankelisolutions.fi --region europe-north1   # status, cert
just smoke https://fitteri.mankelisolutions.fi
```

To recreate it, as an account that is a verified owner of `mankelisolutions.fi` in Search Console:

```sh
gcloud beta run domain-mappings create --service fitter --domain fitteri.mankelisolutions.fi --region europe-north1
```

The certificate usually takes about 15 minutes after DNS is in place (up to 24 hours).

## One-time GCP setup (issue #11)

> **Done on Sat 7 Nov.** Everything below has been run for `takomo-fitter`. It stays here as the record and for
> rebuilding the setup.

Run these from a shell logged in as the project owner (`gcloud auth login`). Replace every `<…>` placeholder.

```sh
export PROJECT_ID=takomo-fitter              # project number 266978168041
export BILLING_ACCOUNT=<BILLING_ACCOUNT_ID> # from: gcloud billing accounts list
export REGION=europe-north1
export GH_REPO=Mankeli-Software/since-ai-2026
```

### 1. Project, billing, APIs

```sh
# gcloud projects create "$PROJECT_ID" --name="Takomo Fitter Studio"   # already done: takomo-fitter exists
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
gcloud config set project "$PROJECT_ID"

# iam.googleapis.com is needed to create the service accounts and the WIF pool.
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iam.googleapis.com

export PROJECT_NUMBER=266978168041         # = gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)"
```

### 2. Artifact Registry repo `app`

```sh
gcloud artifacts repositories create app \
  --repository-format=docker --location="$REGION" \
  --description="Takomo Fitter Studio images"
```

### 3. Secret `anthropic-api-key` (empty) and access for Juho

Create the secret **before Jesse leaves**, and let Juho Torkkeli add the capped key as a version without wider GCP access.

```sh
gcloud secrets create anthropic-api-key --replication-policy=automatic

gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="user:<JUHO_GOOGLE_EMAIL>" \
  --role=roles/secretmanager.secretVersionAdder
```

Juho then adds the key (never paste it into an issue, PR or commit; share it only by password manager or DM):

```sh
printf %s "$ANTHROPIC_KEY" | gcloud secrets versions add anthropic-api-key --data-file=- --project=takomo-fitter
```

> **The deploy needs at least one version.** It mounts `anthropic-api-key:latest`, and Cloud Run refuses a revision whose
> secret has no versions. If the real key is not ready for the first deploy, add a placeholder (prod runs
> `LLM_MODE=mock` until the integration checkpoint, so the key is not used):
> `printf placeholder | gcloud secrets versions add anthropic-api-key --data-file=-`.
> `:latest` is resolved when a revision starts, so after Juho adds the real key, the next deploy (or
> `gcloud run services update fitter --region europe-north1 --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest`)
> picks it up.

### 4. Service accounts (least privilege, §9.3)

```sh
gcloud iam service-accounts create deployer --display-name="GitHub Actions deployer"
gcloud iam service-accounts create fitter-runtime --display-name="fitter Cloud Run runtime"
export DEPLOY_SA="deployer@${PROJECT_ID}.iam.gserviceaccount.com"
export RUNTIME_SA="fitter-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# deployer@: run.admin, artifactregistry.writer (on the `app` repo), iam.serviceAccountUser (on the runtime SA only)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/run.admin --condition=None
gcloud artifacts repositories add-iam-policy-binding app --location="$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser

# fitter-runtime@: secretAccessor on the Anthropic secret only, plus logWriter.
# (Add elevenlabs-api-key only if voice ships; add roles/datastore.user only if Firestore is enabled.)
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:$RUNTIME_SA" --role=roles/secretmanager.secretAccessor
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" --role=roles/logging.logWriter --condition=None
```

### 5. Workload Identity Federation for GitHub Actions (20-minute time box)

The provider only accepts tokens from this repository.

```sh
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc since-ai-2026 \
  --location=global --workload-identity-pool=github \
  --display-name="since-ai-2026" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='Mankeli-Software/since-ai-2026'"

# Let workflows from this repo impersonate deployer@
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GH_REPO}"

export WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe since-ai-2026 \
  --location=global --workload-identity-pool=github --format='value(name)')
echo "$WIF_PROVIDER"   # projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/since-ai-2026
```

**If WIF is not working after 20 minutes (§9.3):** create a JSON key for `deployer@` in a throwaway project, store it as
the GitHub **secret** `GCP_SA_KEY`, and in both `google-github-actions/auth@v3` steps of `ci.yml` replace
`workload_identity_provider` + `service_account` with `credentials_json: ${{ secrets.GCP_SA_KEY }}` (and drop the
`GCP_WIF_PROVIDER` checks from the `if:` gates). Delete the key on Monday. **If billing or project setup stalls past the
deadline:** Railway (GitHub connect + the same Dockerfile).

### 6. GitHub Variables (not secrets: none of these are sensitive)

```sh
gh variable set GCP_PROJECT_ID   --repo "$GH_REPO" --body "$PROJECT_ID"
gh variable set GCP_WIF_PROVIDER --repo "$GH_REPO" --body "$WIF_PROVIDER"
gh variable set GCP_DEPLOY_SA    --repo "$GH_REPO" --body "$DEPLOY_SA"
gh variable set GCP_RUNTIME_SA   --repo "$GH_REPO" --body "$RUNTIME_SA"
gh variable set PROD_LLM_MODE    --repo "$GH_REPO" --body "mock"     # -> "live" after the 22:30-23:30 checkpoint
gh variable set ALLOWED_FRAME_ANCESTORS --repo "$GH_REPO" \
  --body "'self' https://takomogolf.com https://www.takomogolf.com https://admin.shopify.com https://*.shopifypreview.com"
gh variable set DEPLOY_ENABLED   --repo "$GH_REPO" --body "true"     # "false" = freeze (Sun 06:00)
```

`ALLOWED_FRAME_ANCESTORS` is space-separated, never comma-separated (`env_vars` splits on commas). Add the one dev-store
host (`https://<dev-store>.myshopify.com`) only in the Final phase (§6.5).

### 7. First deploy and Day-1 checks

1. Merge anything to `main` (or re-run the latest `main` workflow). The first run creates the `fitter` service.
2. Find the URL: `gcloud run services describe fitter --region europe-north1 --format='value(status.url)'`
3. Smoke it by hand: `scripts/smoke.sh <URL>`
4. **SSE through Cloud Run (§9.3, Day-1):** hold a `/turn` stream open for 5+ minutes with `curl -N` and confirm the
   `: ping` keep-alives arrive every ~15 s and nothing is buffered (needs a turn that stays open, e.g. a live-engine turn):
   ```sh
   SID=$(curl -fsS -X POST "$URL/api/sessions" -H 'content-type: application/json' -d '{"engine":"live"}' | jq -r .session_id)
   curl -N -X POST "$URL/api/sessions/$SID/turn" -H 'content-type: application/json' \
     -d '{"message":{"kind":"text","text":"hi"}}'
   ```
5. **Cold start:** `gcloud run services update fitter --region europe-north1 --min-instances=0`, wait for the
   instance to go away, `time curl -fsS "$URL/api/health"`, then set `--min-instances=1` back.

### Firestore session store (issue #20, optional)

`STORE=memory` (the default) loses sessions on every redeploy. `STORE=firestore` keeps them in Firestore Native
(`backend/app/persistence/firestore.py`), so saved fittings survive a redeploy. **Not switched on yet.** Do it in this
order:

1. **Dependency (lead's call, deps are frozen):** add `google-cloud-firestore` to `backend/pyproject.toml` and run
   `uv lock` (never hand-edit `uv.lock`). Without it, a `STORE=firestore` boot fails with a clear error, so the smoke
   check keeps the old revision on traffic.
2. **Create the database and grant the runtime SA** (as the project owner):
   ```sh
   export PROJECT_ID=takomo-fitter
   export RUNTIME_SA="fitter-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
   gcloud services enable firestore.googleapis.com --project "$PROJECT_ID"
   gcloud firestore databases create --project "$PROJECT_ID" \
     --database='(default)' --location=europe-north1 --type=firestore-native
   gcloud projects add-iam-policy-binding "$PROJECT_ID" \
     --member="serviceAccount:$RUNTIME_SA" --role=roles/datastore.user --condition=None
   ```
3. **Set `STORE=firestore` on the service.** `ci.yml` passes `STORE=memory` in `env_vars` on every deploy, so a
   `gcloud run services update --update-env-vars` is undone by the next merge. Change that one value in `ci.yml`
   (INFRA lane), for example to `STORE=${{ vars.PROD_STORE || 'memory' }}`, then
   `gh variable set PROD_STORE --repo "$GH_REPO" --body firestore`. On Cloud Run the client finds the project and
   credentials itself; no key file. Optional env: `FIRESTORE_DATABASE` (default `(default)`), `FIRESTORE_COLLECTION`
   (default `sessions`), `FIRESTORE_PROJECT`.
4. **Check:** `just smoke <URL>`, `/api/health` shows `"store":"firestore"`, then create a session, run a turn,
   redeploy, and `GET /api/sessions/<id>` still returns it.

**Keep `--max-instances=1`.** The plan allows 3 with Firestore, but the cost guard (#18, `backend/app/agent/guard.py`)
keeps its rate limits and daily model-call cap in memory, so more instances would split those counters. Raise it only
after the guard counters move to Firestore too.

Layout: `sessions/{id}` (session + turn lock lease), `sessions/{id}/messages/{seq}`, `sessions/{id}/imports/{id}`
(parsed numbers only, never the raw upload). The turn lock is a lease taken in a transaction, so a crashed turn frees
itself after its TTL. To try it locally against the emulator (no GCP, no credentials):

```sh
docker run -d --rm --name fs-emu -p 127.0.0.1:8085:8085 gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators \
  gcloud emulators firestore start --host-port=0.0.0.0:8085
STORE=firestore FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=demo-fitter just dev
```

(Until step 1 lands, run the backend with `uv run --frozen --project backend --with google-cloud-firestore uvicorn ...`;
`--with` does not touch the lockfile.)

### Freeze (Sun 06:00, §10.6)

```sh
gh variable set DEPLOY_ENABLED --repo "$GH_REPO" --body "false"
gcloud run services update-traffic fitter --region europe-north1 --update-tags demo-final=<REVISION>
# present from the demo-final tag URL
```

A manual PR preview, if needed: `gcloud run deploy fitter --region europe-north1 --image <IMAGE> --tag pr-<N> --no-traffic`.
