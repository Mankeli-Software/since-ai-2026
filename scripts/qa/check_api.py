"""Layer 2: API contract checks (check_api.py).

Verifies status codes, response shapes, and error cases for all API routes.
Also checks tinker performance against the 100 ms budget.
"""

from __future__ import annotations

import time
from pathlib import Path

from scripts.qa._lib import QARunner

ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = ROOT / "fixtures"


def check_route_health(runner: QARunner) -> None:
    client = runner.client
    r = client.get("/api/health")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    body = r.json()
    assert body.get("ok") is True, f"ok is not true: {body}"
    assert "version" in body and "llm_mode" in body and "store" in body

    # Error case: wrong method
    r_err = client.post("/api/health")
    assert r_err.status_code in (404, 405), f"Expected 404/405, got {r_err.status_code}"


def check_route_demo_list(runner: QARunner) -> None:
    client = runner.client
    r = client.get("/api/demo")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    body = r.json()
    assert isinstance(body, list) and len(body) >= 4
    for item in body:
        assert "golfer_id" in item and "name" in item and "synthetic" in item

    # Error case: method not allowed
    r_err = client.post("/api/demo")
    assert r_err.status_code in (404, 405)


def check_route_demo_detail(runner: QARunner) -> None:
    client = runner.client
    r = client.get("/api/demo/DEMO-01")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    body = r.json()
    assert body.get("golfer_id") == "DEMO-01"
    assert "session_id" in body and "resume_token" in body and "state" in body

    # Error case: unknown golfer id
    r_err = client.get("/api/demo/DEMO-99")
    assert r_err.status_code == 404, f"Expected 404, got {r_err.status_code}"
    assert r_err.json().get("code") == "not_found"


def check_route_demo_sample(runner: QARunner) -> None:
    client = runner.client
    r = client.get("/api/demo/DEMO-01/samples/own_7i")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assert "Club" in r.text or "Shot" in r.text

    # Error case: unknown sample
    r_err = client.get("/api/demo/DEMO-01/samples/nonexistent_sample")
    assert r_err.status_code == 404


def check_route_sessions_lifecycle(runner: QARunner) -> None:
    client = runner.client
    # Create
    r_create = client.post(
        "/api/sessions",
        json={"engine": "scripted", "demo_golfer_id": "DEMO-01"},
    )
    assert r_create.status_code == 201, f"Expected 201, got {r_create.status_code}"
    created = r_create.json()
    sid = created["session_id"]
    token = created["resume_token"]
    assert "state" in created

    # Create error: bad engine
    r_bad_eng = client.post("/api/sessions", json={"engine": "invalid_engine"})
    assert r_bad_eng.status_code == 422

    # Get session
    r_get = client.get(f"/api/sessions/{sid}")
    assert r_get.status_code == 200
    assert "email" not in r_get.json(), "email should not be in public session response"

    # Get unknown session
    r_unk = client.get("/api/sessions/unknown_session_id")
    assert r_unk.status_code == 404

    # Save session
    r_save = client.post(f"/api/sessions/{sid}/save", json={"email": "qa@example.com"})
    assert r_save.status_code == 200
    assert r_save.json().get("saved") is True

    # Save unknown session
    r_save_err = client.post("/api/sessions/unknown_session_id/save", json={})
    assert r_save_err.status_code == 404

    # Resume session
    r_resume = client.get(f"/api/resume/{token}")
    assert r_resume.status_code == 200
    assert r_resume.json().get("session_id") == sid

    # Resume unknown token
    r_res_err = client.get("/api/resume/unknown_resume_token")
    assert r_res_err.status_code == 404


def check_route_trackman_csv(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    csv_data = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-01" / "own_7i.csv"
    ).read_bytes()
    r = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("shots.csv", csv_data, "text/csv")},
        data={"club": "own_7i"},
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    imp = r.json()
    assert imp.get("status") == "pending"
    assert "import_id" in imp and "report" in imp

    # Error case 1: empty file
    r_empty = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("shots.csv", b"", "text/csv")},
    )
    assert r_empty.status_code == 422
    assert r_empty.json().get("code") == "bad_csv"

    # Error case 2: bad headers
    r_bad_hdr = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("shots.csv", b"col_a,col_b\n1,2\n", "text/csv")},
    )
    assert r_bad_hdr.status_code == 422
    assert r_bad_hdr.json().get("code") == "bad_csv"

    # Error case 3: file larger than 2MB
    r_big = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("shots.csv", b"x" * (2 * 1024 * 1024 + 100), "text/csv")},
    )
    assert r_big.status_code == 422
    assert r_big.json().get("code") == "file_too_large"


def check_route_confirm_import(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]
    csv_data = (
        FIXTURES_DIR / "demo" / "samples" / "DEMO-01" / "own_7i.csv"
    ).read_bytes()
    imp = client.post(
        f"/api/sessions/{sid}/imports/trackman-csv",
        files={"file": ("shots.csv", csv_data, "text/csv")},
        data={"club": "own_7i"},
    ).json()
    imp_id = imp["import_id"]

    r_conf = client.post(f"/api/sessions/{sid}/imports/{imp_id}/confirm")
    assert r_conf.status_code == 200, f"Expected 200, got {r_conf.status_code}"
    body = r_conf.json()
    assert body.get("status") == "confirmed"
    assert "state" in body

    # Error case: unknown import id
    r_err = client.post(f"/api/sessions/{sid}/imports/unknown_imp_id/confirm")
    assert r_err.status_code == 404


def check_route_ball_line(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-09"}
    ).json()
    sid = sess["session_id"]

    r = client.post(
        f"/api/sessions/{sid}/imports/ball-line",
        json={"readings_deg": [0.3, 0.8, 2.1, 2.5, 1.5], "club": "own_7i"},
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    body = r.json()
    assert body.get("status") == "confirmed"
    assert "report" in body and "state" in body

    # Error case: empty readings
    r_err = client.post(
        f"/api/sessions/{sid}/imports/ball-line",
        json={"readings_deg": [], "club": "own_7i"},
    )
    assert r_err.status_code == 422


def check_route_flags(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    # Recheck
    r_recheck = client.post(f"/api/sessions/{sid}/flags/recheck")
    assert r_recheck.status_code == 200
    assert "flags" in r_recheck.json()

    # Resolve
    r_resolve = client.post(
        f"/api/sessions/{sid}/flags/resolve",
        json={"action": "keep", "codes": ["G11"]},
    )
    assert r_resolve.status_code == 200

    # Error cases: unknown session
    assert client.post("/api/sessions/unknown_sid/flags/recheck").status_code == 404
    assert (
        client.post(
            "/api/sessions/unknown_sid/flags/resolve",
            json={"action": "keep", "codes": ["G11"]},
        ).status_code
        == 404
    )


def check_route_fit(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.get(f"/api/sessions/{sid}/fit")
    assert r.status_code == 200
    body = r.json()
    assert "recs" in body and "confidence" in body and "why" in body

    # Error case: session without enough inputs
    empty_sess = client.post("/api/sessions", json={"engine": "scripted"}).json()
    r_err = client.get(f"/api/sessions/{empty_sess['session_id']}/fit")
    assert r_err.status_code == 422
    assert r_err.json().get("code") == "missing_inputs"


def check_route_next_question(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.get(f"/api/sessions/{sid}/next-question")
    assert r.status_code == 200
    assert "kind" in r.json()

    # Error case: unknown session
    assert client.get("/api/sessions/unknown_sid/next-question").status_code == 404


def check_route_stock_advice(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.get(f"/api/sessions/{sid}/stock-advice")
    assert r.status_code == 200
    body = r.json()
    assert "lean" in body and "stock_return_days" in body

    # Error case: no fit yet
    empty_sess = client.post("/api/sessions", json={"engine": "scripted"}).json()
    assert (
        client.get(f"/api/sessions/{empty_sess['session_id']}/stock-advice").status_code
        == 422
    )


def check_route_catalog(runner: QARunner) -> None:
    client = runner.client
    r = client.get("/api/catalog")
    assert r.status_code == 200
    body = r.json()
    assert "heads" in body and "shafts" in body and "grips" in body


def check_route_flight(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.post("/api/flight", json={"session_id": sid})
    assert r.status_code == 200
    body = r.json()
    assert "per_head" in body

    # Error case: unknown session
    assert (
        client.post("/api/flight", json={"session_id": "unknown_sid"}).status_code
        == 404
    )


def check_route_tinker(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.post(
        "/api/tinker",
        json={"session_id": sid, "spec": {"head": "101-mkii"}},
    )
    assert r.status_code == 200
    body = r.json()
    assert "spec" in body and "buildable" in body

    # Error case: unknown session
    assert (
        client.post(
            "/api/tinker",
            json={"session_id": "unknown_sid", "spec": {"head": "101-mkii"}},
        ).status_code
        == 404
    )


def check_route_profile_patch(runner: QARunner) -> None:
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    r = client.patch(
        f"/api/sessions/{sid}/profile",
        json={"fields": {"reported_7i_carry_yd": {"value": 155, "unit": "yd"}}},
    )
    assert r.status_code == 200
    assert "state" in r.json() and "flags" in r.json()

    # Error case: invalid unit
    r_err = client.patch(
        f"/api/sessions/{sid}/profile",
        json={
            "fields": {"reported_7i_carry_yd": {"value": 155, "unit": "invalid_unit"}}
        },
    )
    assert r_err.status_code == 422


def check_tinker_under_100ms(runner: QARunner) -> None:
    """Check tinker performance budget (< 100 ms, plan §3.6)."""
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    # Warm-up request
    client.post("/api/tinker", json={"session_id": sid, "spec": {"grip": "midsize"}})

    # Measured run
    t0 = time.perf_counter()
    r = client.post(
        "/api/tinker",
        json={"session_id": sid, "spec": {"grip": "midsize"}},
    )
    duration_ms = (time.perf_counter() - t0) * 1000
    assert r.status_code == 200

    # 100 ms performance budget from plan §3.6
    assert duration_ms < 100.0, (
        f"Tinker took {duration_ms:.1f}ms, exceeding 100ms budget "
        "(real bug: simulate_flight trajectory generation in tinker exceeds budget)"
    )


def register_api_checks(runner: QARunner) -> None:
    """Register all layer 2 checks on the runner."""
    checks = [
        ("route_health", lambda: check_route_health(runner)),
        ("route_demo_list", lambda: check_route_demo_list(runner)),
        ("route_demo_detail", lambda: check_route_demo_detail(runner)),
        ("route_demo_sample", lambda: check_route_demo_sample(runner)),
        ("route_sessions_lifecycle", lambda: check_route_sessions_lifecycle(runner)),
        ("route_trackman_csv", lambda: check_route_trackman_csv(runner)),
        ("route_confirm_import", lambda: check_route_confirm_import(runner)),
        ("route_ball_line", lambda: check_route_ball_line(runner)),
        ("route_flags", lambda: check_route_flags(runner)),
        ("route_fit", lambda: check_route_fit(runner)),
        ("route_next_question", lambda: check_route_next_question(runner)),
        ("route_stock_advice", lambda: check_route_stock_advice(runner)),
        ("route_catalog", lambda: check_route_catalog(runner)),
        ("route_flight", lambda: check_route_flight(runner)),
        ("route_tinker", lambda: check_route_tinker(runner)),
        ("route_profile_patch", lambda: check_route_profile_patch(runner)),
        ("tinker_under_100ms", lambda: check_tinker_under_100ms(runner)),
    ]
    for name, func in checks:
        runner.run_check("api", name, func)
