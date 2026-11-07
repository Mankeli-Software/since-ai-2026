"""Layer 4: Trust and safety checks (check_trust.py).

Verifies privacy boundaries, plain text safety (no URLs, no HTML),
forbidden language, deterministic numbers, safe data storage, and architecture boundaries.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from scripts.qa._lib import QARunner, parse_sse_events

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend" / "app"
FIXTURES_DIR = ROOT / "fixtures"

FORBIDDEN_WORDS = [
    "fuck",
    "shit",
    "bitch",
    "cunt",
    "asshole",
    "fix your swing",
    "taylormade",
    "callaway",
    "titleist",
    "mizuno",
    "ping",
    "pxg",
    "cobra",
    "srixon",
]

HTML_TAG_RE = re.compile(r"<[a-zA-Z/][^>]*>")
URL_RE = re.compile(r"https?://|www\.")


def check_no_email_in_public_session(runner: QARunner) -> None:
    """1. GET /api/sessions/{id} has no email key."""
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]
    client.post(f"/api/sessions/{sid}/save", json={"email": "private@example.com"})

    res = client.get(f"/api/sessions/{sid}")
    assert res.status_code == 200
    data = res.json()
    assert "email" not in data, (
        "email key must never be returned in public session payload"
    )


def check_chat_no_url_no_html_no_forbidden(runner: QARunner) -> None:
    """2 & 3. Chat text has no URL, no HTML tags, and no forbidden words."""
    client = runner.client
    for pid in ("DEMO-01", "DEMO-09", "DEMO-04", "DEMO-13"):
        sess = client.post(
            "/api/sessions", json={"engine": "scripted", "demo_golfer_id": pid}
        ).json()
        sid = sess["session_id"]

        for _ in range(5):
            s_curr = client.get(f"/api/sessions/{sid}").json()
            if s_curr.get("status") == "done":
                break

            with client.stream(
                "POST",
                f"/api/sessions/{sid}/turn",
                json={"message": {"kind": "text", "text": "continue"}},
                headers={"accept": "text/event-stream"},
            ) as r:
                events = parse_sse_events(r.iter_lines())

            for _ev_type, _seq, data in events:
                text = data.get("delta") or data.get("text") or ""
                if not text:
                    continue
                # No HTML tags
                assert not HTML_TAG_RE.search(text), (
                    f"Found HTML tag in chat text: {text!r}"
                )
                # No URLs
                assert not URL_RE.search(text), f"Found URL in chat text: {text!r}"
                # No forbidden words
                lower_text = text.lower()
                for bad in FORBIDDEN_WORDS:
                    assert bad not in lower_text, (
                        f"Found forbidden phrase {bad!r} in chat: {text!r}"
                    )


def check_chat_numbers_deterministic(runner: QARunner) -> None:
    """4. Every number in chat text appears in tool output, profile, or club name for that turn."""
    client = runner.client
    sess = client.post(
        "/api/sessions", json={"engine": "scripted", "demo_golfer_id": "DEMO-01"}
    ).json()
    sid = sess["session_id"]

    with client.stream(
        "POST",
        f"/api/sessions/{sid}/turn",
        json={"message": {"kind": "text", "text": "start"}},
        headers={"accept": "text/event-stream"},
    ) as r:
        events = parse_sse_events(r.iter_lines())

    chat_text = "".join(
        e[2].get("delta", "") for e in events if e[0] == "text" and "delta" in e[2]
    )
    # Check for standalone numbers in text
    nums = re.findall(r"\b\d+(?:\.\d+)?\b", chat_text)
    # Allowed baseline known numbers: e.g. 7 (from 7-iron), 3 (from par 3), 30 (from 30-day return)
    allowed_constants = {"7", "3", "30", "101", "201", "301"}
    for num in nums:
        assert num in allowed_constants or any(
            num in str(e[2]) for e in events if e[0] in ("ui", "state")
        ), f"Number {num} in chat text was not found in turn state or tool constants"


def check_raw_csv_not_stored(runner: QARunner) -> None:
    """5. Raw CSV text is never stored: the import record keeps only numbers."""
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
    assert imp_id.startswith("imp_")

    # Verify import report does not hold raw CSV string
    assert "raw_csv" not in imp
    assert "csv_text" not in imp
    # The shots field holds structured Shot objects
    assert isinstance(imp.get("shots"), list)
    for s in imp["shots"]:
        assert isinstance(s, dict)
        assert "club_speed_mph" in s or "carry_yd" in s


def check_no_forbidden_backend_imports() -> None:
    """6. backend/app/ does not import pandas, takomo_fit.score, or read labels.csv."""
    import_re = re.compile(
        r"^\s*(?:import\s+(?:pandas|takomo_fit\.score)|from\s+(?:pandas|takomo_fit\.score)\s+import)",
        re.MULTILINE,
    )
    labels_re = re.compile(r"labels\.csv")

    for py_file in BACKEND_DIR.glob("**/*.py"):
        content = py_file.read_text(encoding="utf-8")
        assert not import_re.search(content), (
            f"Forbidden import found in {py_file.relative_to(ROOT)}"
        )
        assert not labels_re.search(content), (
            f"Reference to labels.csv found in {py_file.relative_to(ROOT)}"
        )


def check_social_proof_labelled_example() -> None:
    """7. Social-proof stats are labelled 'example' in fixtures/social_proof.json."""
    proof_path = FIXTURES_DIR / "social_proof.json"
    assert proof_path.exists(), "fixtures/social_proof.json missing"
    data = json.loads(proof_path.read_text(encoding="utf-8"))
    for key, val in data.items():
        assert val.get("example") is True, (
            f"Social proof stat {key} not labelled example: true"
        )


def register_trust_checks(runner: QARunner) -> None:
    """Register all layer 4 checks on the runner."""
    checks = [
        (
            "no_email_in_public_session",
            lambda: check_no_email_in_public_session(runner),
        ),
        (
            "chat_no_url_no_html_no_forbidden",
            lambda: check_chat_no_url_no_html_no_forbidden(runner),
        ),
        (
            "chat_numbers_deterministic",
            lambda: check_chat_numbers_deterministic(runner),
        ),
        ("raw_csv_not_stored", lambda: check_raw_csv_not_stored(runner)),
        ("no_forbidden_backend_imports", check_no_forbidden_backend_imports),
        ("social_proof_labelled_example", check_social_proof_labelled_example),
    ]
    for name, func in checks:
        runner.run_check("trust", name, func)
