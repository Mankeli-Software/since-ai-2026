# Takomo Fitter Studio QA Harness

The QA harness verifies that the application provides valid recommendations, adheres to API contracts, respects safety and privacy rules, and executes persona flows end-to-end.

## How to Run

Run all checks locally with zero API keys:
```bash
just qa
```

Run a specific layer:
```bash
just qa --layer data
just qa --layer api
just qa --layer personas
just qa --layer trust
```

Run checks against a live running server:
```bash
just qa --url http://localhost:8080
```

## How to Read the Output

Each check prints its status, layer, name, and duration:
- `PASS [layer] name (12.3ms)`: Check passed successfully.
- `FAIL [layer] name (45.1ms): Error`: Check failed with reason.
- `SKIP [layer] name: Reason`: Check skipped (e.g. optional offline dataset missing).

At the end of the run, a summary table shows results per layer and overall counts.

## Layers

- **Layer 1: Data and Pack (`check_data.py`)**:
  Verifies demo fixture schemas, TrackMan CSV and ball-line parsing, `check_buildable` constraints, dev-split prediction accuracy (>= B2 baseline 83.58), determinism, and flight physics edge cases.
- **Layer 2: API Contract (`check_api.py`)**:
  Verifies status codes, JSON schemas, and error responses for all endpoints. Tests tinker performance budget (< 100 ms).
- **Layer 3: Persona End-to-End (`check_personas.py`)**:
  Drives complete persona flows (Mikko spine, Hannu ball-line, Lars close call, Anders custom vs stock), validates SSE event contracts, confidence gate thresholds, and beginner skip defaults.
- **Layer 4: Trust and Safety (`check_trust.py`)**:
  Validates privacy invariants (no email returned), clean text (no URLs, no HTML tags, no profanity or competitor names), deterministic numbers from tools, safe storage without raw CSVs, and architectural import boundaries.
- **Layer 5: Manual Browser Checklist**:
  Manual UI verification items (see below).

## Layer 5: Manual Browser Checklist

For checks that require visual inspection in a browser:
1. **3D Club Stage**: Open `/studio.html?engine=scripted&demo=DEMO-01`. Confirm the club head model loads, rotates smoothly, and matches the recommended spec.
2. **Flight & Dispersion SVG**: Verify top-down and side dispersion plots render clearly at `1440x900` and `1280x800` viewport resolutions.
3. **Simulated Golfer Badge**: Confirm the "Simulated golfer" badge appears prominently when browsing demo personas.
4. **Save and Resume Flow**: Click Save, enter an email, copy the resume link, and verify opening the URL restores state.

## Run in GitHub

You can trigger the QA harness manually via GitHub Actions:
1. Navigate to the **Actions** tab in GitHub.
2. Select the **qa** workflow.
3. Click **Run workflow**, choose the branch and layer (`all`, `data`, `api`, `personas`, `trust`), and click **Run workflow**.

Alternatively, run from the command line using the GitHub CLI:
```bash
gh workflow run qa.yml -f layer=all
```
