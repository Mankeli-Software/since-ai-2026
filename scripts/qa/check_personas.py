"""Layer 3: Persona end-to-end checks (check_personas.py).

Verifies Mikko (the demo spine), Hannu, Lars, Anders, scripted turn streams,
confidence gate bands, and beginner skip logic.
"""

from __future__ import annotations

from pathlib import Path

from app.confidence.gate import gate_for
from app.confidence.next_question import next_question
from app.fitting.beginner import BEGINNER_SKIPS, is_beginner, with_beginner_defaults
from app.fitting.mapping import missing_inputs
from app.schemas.fit import FitEvidence, IntakeAnswers

from scripts.qa._lib import QARunner, load_expected, parse_sse_events

ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = ROOT / "fixtures"
FROZEN_EVENTS = {
    "turn_start",
    "text",
    "ui",
    "stage",
    "state",
    "mascot",
    "done",
    "error",
}


def check_persona_mikko(runner: QARunner) -> None:
    """Mikko (DEMO-01), the spine: own_7i -> G11 -> test_club -> 201t-mkii -> flight -> stock advice -> save/resume."""
    client = runner.client
    exp = load_expected()["mikko"]

    # 1. Create session from demo
    r_init = client.get(f"/api/demo/{exp['golfer_id']}")
    assert r_init.status_code == 200
    demo = r_init.json()
    sid = demo["session_id"]
    token = demo["resume_token"]
    c0 = demo["state"]["confidence"]
    gate0 = demo["state"]["gate"]
    assert c0 is not None and c0 > 0.50
    assert gate0 in ("provisional", "confident")

    # 2. Import own_7i.csv
    csv_own = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-01" / "own_7i.csv"
    ).read_bytes()
    r_imp1 = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("own_7i.csv", csv_own, "text/csv")},
        data={"club": "own_7i"},
    )
    assert r_imp1.status_code == 200
    imp1_id = r_imp1.json()["import_id"]

    r_conf1 = client.post(f"/api/sessions/{sid}/imports/{imp1_id}/confirm")
    assert r_conf1.status_code == 200
    state1 = r_conf1.json()["state"]
    pending_codes = [f["code"] for f in state1.get("pending_flags", [])]
    assert "G11" in pending_codes, (
        f"Expected G11 flag to fire for Mikko, got: {pending_codes}"
    )

    # 3. Assert measured speed gives bucket 3 and confidence rises >= 0.15
    fit1 = client.get(f"/api/sessions/{sid}/fit").json()
    assert fit1["recs"][0]["shaft"] == exp["shaft"]
    c1 = state1["confidence"]
    assert c1 is not None and round(c1 - c0, 2) >= exp["c_delta_min"], (
        f"Confidence rise {c1 - c0:.4f} is less than {exp['c_delta_min']}"
    )

    # 4. Import test-club CSV (takomo_201.csv)
    csv_201 = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-01" / "takomo_201.csv"
    ).read_bytes()
    r_imp2 = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("takomo_201.csv", csv_201, "text/csv")},
        data={"club": "takomo_201-mkii_kbs-tour-regular_std"},
    )
    assert r_imp2.status_code == 200
    imp2_id = r_imp2.json()["import_id"]
    r_conf2 = client.post(f"/api/sessions/{sid}/imports/{imp2_id}/confirm")
    assert r_conf2.status_code == 200

    # 5. Best head is 201t-mkii, runner-up is 201-mkii, same shaft, lie +2 -> +3
    fit2 = client.get(f"/api/sessions/{sid}/fit").json()
    r0 = fit2["recs"][0]
    r1 = fit2["recs"][1]
    assert r0["head"] == exp["best_head"]
    assert r1["head"] == exp["runner_up_head"]
    assert r0["shaft"] == r1["shaft"] == exp["shaft"]
    assert r0["lie_deg"] == exp["test_club_lie_deg"]
    assert any("lie: evidence" in t for t in r0["trace"]), (
        f"Expected 'lie: evidence' in trace, got: {r0['trace']}"
    )

    # 6. Flight returns carry and dispersion for both heads
    r_flight = client.post("/api/flight", json={"session_id": sid})
    assert r_flight.status_code == 200
    flight = r_flight.json()
    heads_flight = {h["head"]: h for h in flight.get("per_head", [])}
    assert exp["best_head"] in heads_flight
    assert exp["runner_up_head"] in heads_flight
    assert heads_flight[exp["best_head"]]["summary"]["carry"]["mean"] > 100

    # 7. Stock advice returns stock vs custom (custom non-returnable)
    r_stock = client.get(f"/api/sessions/{sid}/stock-advice")
    assert r_stock.status_code == 200
    stock = r_stock.json()
    assert stock["lean"] == exp["stock_advice_lean"]
    assert stock["fitted"]["purchase"] == "custom"
    assert stock["stock"]["purchase"] == "stock"
    assert stock["stock_return_days"] == exp["stock_return_days"]
    why_purchase = next(
        (w for w in fit2.get("why", []) if w.get("part") == "purchase"), None
    )
    assert why_purchase is not None
    assert "non-returnable" in why_purchase["plain"].lower()

    # 8. Save and resume
    client.post(f"/api/sessions/{sid}/save", json={"email": "mikko@example.com"})
    r_res = client.get(f"/api/resume/{token}")
    assert r_res.status_code == 200
    resumed = r_res.json()
    assert resumed["session_id"] == sid
    assert resumed["state"]["version"] == fit2.get(
        "version", resumed["state"]["version"]
    )


def check_persona_hannu(runner: QARunner) -> None:
    """Hannu (DEMO-09): ball-line readings, close calls for lie and flex, points to simulator, no text says 'shots'."""
    client = runner.client
    exp = load_expected()["hannu"]

    r_init = client.get(f"/api/demo/{exp['golfer_id']}")
    sid = r_init.json()["session_id"]

    r_bl = client.post(
        f"/api/sessions/{sid}/imports/ball-line",
        json={"readings_deg": exp["ball_line_readings"], "club": "own_7i"},
    )
    assert r_bl.status_code == 200
    rep = r_bl.json()["report"]
    assert round(rep["summary"]["mean_deg"], 2) == exp["ball_line_mean_deg"]

    fit = client.get(f"/api/sessions/{sid}/fit").json()
    close_calls = {c["part"]: c for c in fit.get("close_calls", [])}
    assert "lie" in close_calls, "Expected close call on lie for Hannu"
    assert "flex" in close_calls, "Expected close call on flex for Hannu"

    lie_cc = close_calls["lie"]
    assert lie_cc["ours"] == exp["close_call_lie_ours"]
    assert lie_cc["alt"] == exp["close_call_lie_alt"]
    assert "simulator" in lie_cc["next_step"].lower()
    assert "shot" not in lie_cc["next_step"].lower(), (
        "Lie next step should not mention 'shots' for ball-line"
    )


def check_persona_lars(runner: QARunner) -> None:
    """Lars (DEMO-04): close call between 301-cb and 301-mb with trade-offs."""
    client = runner.client
    exp = load_expected()["lars"]

    r_init = client.get(f"/api/demo/{exp['golfer_id']}")
    sid = r_init.json()["session_id"]

    fit = client.get(f"/api/sessions/{sid}/fit").json()
    close_calls = {c["part"]: c for c in fit.get("close_calls", [])}
    assert "head" in close_calls, "Expected head close call for Lars"
    head_cc = close_calls["head"]
    assert head_cc["ours"] == exp["close_call_head_ours"]
    assert head_cc["alt"] == exp["close_call_head_alt"]
    assert "launch monitor" in head_cc["next_step"].lower()


def check_persona_anders(runner: QARunner) -> None:
    """Anders (DEMO-13): lie +1, custom set, stock stays a real option in stock-advice."""
    client = runner.client
    exp = load_expected()["anders"]

    r_init = client.get(f"/api/demo/{exp['golfer_id']}")
    sid = r_init.json()["session_id"]

    fit = client.get(f"/api/sessions/{sid}/fit").json()
    rec0 = fit["recs"][0]
    assert rec0["lie_deg"] == exp["recommended_lie_deg"]
    assert rec0["purchase"] == exp["recommended_purchase"]

    stock = client.get(f"/api/sessions/{sid}/stock-advice").json()
    assert stock["lean"] == exp["stock_advice_lean"]
    assert stock["p_stock"] > 0, "Stock build should remain a real option for Anders"
    assert stock["stock_return_days"] == exp["stock_return_days"]


def check_scripted_chat_stream(runner: QARunner) -> None:
    """Scripted chat: for each persona, post turns to /turn until done with valid SSE events."""
    client = runner.client
    for pid in ("DEMO-01", "DEMO-09", "DEMO-04", "DEMO-13"):
        sess = client.post(
            "/api/sessions", json={"engine": "scripted", "demo_golfer_id": pid}
        ).json()
        sid = sess["session_id"]

        done = False
        for _turn_idx in range(12):
            s_curr = client.get(f"/api/sessions/{sid}").json()
            if s_curr.get("status") == "done":
                done = True
                break

            with client.stream(
                "POST",
                f"/api/sessions/{sid}/turn",
                json={"message": {"kind": "text", "text": "continue"}},
                headers={"accept": "text/event-stream"},
            ) as response:
                assert response.status_code == 200
                events = parse_sse_events(response.iter_lines())

            assert len(events) > 0, f"No SSE events received for {pid}"
            types = [e[0] for e in events]
            for t in types:
                assert t in FROZEN_EVENTS, f"Invalid event type: {t}"
            assert "error" not in types, f"Turn returned error event: {events}"
            assert events[-1][0] == "done", (
                f"Turn did not end with 'done' event: {events[-1][0]}"
            )

            seqs = [e[1] for e in events]
            assert seqs == sorted(seqs), f"Non-monotonic seqs for {pid}: {seqs}"

            input_blocks = [
                e
                for e in events
                if e[0] == "ui" and e[2].get("block", {}).get("kind") == "ui_input"
            ]
            assert len(input_blocks) <= 1, (
                f"More than one input component in single turn for {pid}: {len(input_blocks)}"
            )

        assert done or client.get(f"/api/sessions/{sid}").json().get("status") in (
            "active",
            "done",
        )


def check_confidence_bands() -> None:
    """Confidence bands: assert gate for C < 0.30, 0.30-0.50 (low), 0.50-0.70, >= 0.70."""
    g, s = gate_for(0.20)
    assert g == "no_result" and s is None

    g, s = gate_for(0.40)
    assert g == "provisional" and s == "low"

    g, s = gate_for(0.60)
    assert g == "provisional" and s is None

    g, s = gate_for(0.80)
    assert g == "confident" and s is None


def check_beginner_skips() -> None:
    """Beginner (L26): "Not sure" defaults for flight, tempo and characteristics, applied in one
    shared place (`fitting.beginner`) without touching the caller's intake, so nothing is missing
    once the 8 basics are in. Several years in is never a beginner, however few rounds."""
    intake = IntakeAnswers(
        age=30,
        sex="male",
        handedness="right",
        years_playing="new",
        rounds_per_year="Under 10",
        score_bucket=5,
        reported_7i_carry_yd=110,
        glove="M",
        height_cm=175,
        wrist_to_floor_cm=84,
    )
    ev = FitEvidence()
    nq = next_question(intake, ev, None, answered=[])
    assert nq is not None and nq.field not in BEGINNER_SKIPS, nq.field
    assert intake.flight is None and intake.tempo is None, "caller's intake was mutated"

    filled = with_beginner_defaults(intake)
    assert filled.flight == "mid"
    assert filled.tempo == "moderate"
    assert filled.characteristics == ["forgiveness"]
    assert missing_inputs(filled, ev) == [], missing_inputs(filled, ev)

    seasonal = intake.model_copy(update={"years_playing": "10_plus", "score_bucket": 3})
    assert not is_beginner(seasonal)


def register_persona_checks(runner: QARunner) -> None:
    """Register all layer 3 checks on the runner."""
    checks = [
        ("persona_mikko_spine", lambda: check_persona_mikko(runner)),
        ("persona_hannu_ball_line", lambda: check_persona_hannu(runner)),
        ("persona_lars_close_call", lambda: check_persona_lars(runner)),
        ("persona_anders_custom_stock", lambda: check_persona_anders(runner)),
        ("scripted_chat_stream", lambda: check_scripted_chat_stream(runner)),
        ("confidence_bands_gate", check_confidence_bands),
        ("beginner_skips_defaults", check_beginner_skips),
    ]
    for name, func in checks:
        runner.run_check("personas", name, func)
