"""QA harness helper library.

Provides a minimal runner, check recording, TestClient helpers, and SSE parser.
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
QA_DIR = Path(__file__).resolve().parent
EXPECTED_FILE = QA_DIR / "expected.json"


class SkipCheck(Exception):
    """Raised when a check must be skipped with a reason."""


@dataclass
class CheckResult:
    layer: str
    name: str
    status: str  # "PASS", "FAIL", "SKIP"
    duration_ms: float
    message: str = ""


class QARunner:
    """Collects and runs test checks."""

    def __init__(
        self, selected_layer: str = "all", base_url: str | None = None
    ) -> None:
        self.selected_layer = selected_layer
        self.base_url = base_url
        self.results: list[CheckResult] = []
        self._client: Any = None

    @property
    def client(self) -> Any:
        if self._client is None:
            if self.base_url:
                import httpx

                self._client = httpx.Client(base_url=self.base_url, timeout=60.0)
            else:
                # In-process TestClient with mock mode default
                os.environ.setdefault("LLM_MODE", "mock")
                backend_path = str(ROOT / "backend")
                if backend_path not in sys.path:
                    sys.path.insert(0, backend_path)
                from app.main import create_app

                self._client = TestClient(create_app())
        return self._client

    def should_run(self, layer: str) -> bool:
        return self.selected_layer in ("all", layer)

    def run_check(self, layer: str, name: str, func: Callable[..., Any]) -> CheckResult:
        if not self.should_run(layer):
            return CheckResult(
                layer=layer,
                name=name,
                status="SKIP",
                duration_ms=0.0,
                message="filtered",
            )

        t0 = time.perf_counter()
        try:
            func()
            duration_ms = (time.perf_counter() - t0) * 1000
            res = CheckResult(
                layer=layer, name=name, status="PASS", duration_ms=duration_ms
            )
            print(f"PASS  [{layer}] {name} ({duration_ms:.1f}ms)")
        except SkipCheck as sc:
            duration_ms = (time.perf_counter() - t0) * 1000
            res = CheckResult(
                layer=layer,
                name=name,
                status="SKIP",
                duration_ms=duration_ms,
                message=str(sc),
            )
            print(f"SKIP  [{layer}] {name}: {sc}")
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.perf_counter() - t0) * 1000
            msg = f"{type(exc).__name__}: {exc}"
            res = CheckResult(
                layer=layer,
                name=name,
                status="FAIL",
                duration_ms=duration_ms,
                message=msg,
            )
            print(f"FAIL  [{layer}] {name} ({duration_ms:.1f}ms): {msg}")

        self.results.append(res)
        return res


def load_expected() -> dict[str, Any]:
    """Load reference values from expected.json."""
    return json.loads(EXPECTED_FILE.read_text(encoding="utf-8"))


def parse_sse_events(lines: Iterator[str]) -> list[tuple[str, int, dict[str, Any]]]:
    """Parse Server-Sent Events stream into (event_type, seq, data_dict) tuples."""
    events: list[tuple[str, int, dict[str, Any]]] = []
    current_event = "message"
    current_id = 0
    current_data = ""

    for line in lines:
        if isinstance(line, bytes):
            line = line.decode("utf-8")
        line = line.strip("\r\n")
        if not line:
            if current_data:
                try:
                    payload = json.loads(current_data)
                    seq = payload.get("seq", current_id)
                    events.append((current_event, int(seq), payload))
                except json.JSONDecodeError:
                    pass
                current_event = "message"
                current_id = 0
                current_data = ""
            continue

        if line.startswith("event: "):
            current_event = line[7:].strip()
        elif line.startswith("id: "):
            with_id = line[4:].strip()
            if with_id.isdigit():
                current_id = int(with_id)
        elif line.startswith("data: "):
            current_data = line[6:]

    if current_data:
        try:
            payload = json.loads(current_data)
            seq = payload.get("seq", current_id)
            events.append((current_event, int(seq), payload))
        except json.JSONDecodeError:
            pass

    return events


def format_summary_table(results: list[CheckResult]) -> str:
    """Format check results as a markdown table."""
    layers = sorted({r.layer for r in results})
    lines = [
        "| Layer | Total | Pass | Fail | Skip |",
        "|-------|-------|------|------|------|",
    ]
    tot_p = tot_f = tot_s = 0
    for lay in layers:
        r_lay = [r for r in results if r.layer == lay]
        p = sum(1 for r in r_lay if r.status == "PASS")
        f = sum(1 for r in r_lay if r.status == "FAIL")
        s = sum(1 for r in r_lay if r.status == "SKIP")
        tot_p += p
        tot_f += f
        tot_s += s
        lines.append(f"| {lay.capitalize()} | {len(r_lay)} | {p} | {f} | {s} |")

    lines.append(
        f"| **Total** | **{len(results)}** | **{tot_p}** | **{tot_f}** | **{tot_s}** |"
    )
    return "\n".join(lines)


def write_github_summary(results: list[CheckResult]) -> None:
    """Write markdown summary to GITHUB_STEP_SUMMARY if available."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    table = format_summary_table(results)
    content = f"### QA Harness Results\n\n{table}\n\n"
    failures = [r for r in results if r.status == "FAIL"]
    if failures:
        content += "#### Failures\n\n"
        for fail in failures:
            content += f"- **[{fail.layer}] {fail.name}**: {fail.message}\n"
    else:
        content += "All checks passed successfully.\n"

    try:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(content)
    except OSError:
        pass
