"""Which shot rules an import runs: the v1 rules, plus Wave 2 when `EVIDENCE_WAVE2=1` (#33). Pure.

The one place that reads the W2 setting for shots, so the trackman-csv, confirm and screenshot
routes cannot drift apart. The monitor (the CSV's vendor alias, or the screen's `monitor` read)
sets the W2 device tolerance; `stored_monitor` reads it back from a pending import so the confirm
step runs exactly the rules the review showed.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from functools import partial

from app.evidence.plausibility.extraction import cells_to_shots, validate_extraction
from app.evidence.plausibility.shots import V1_SHOT_RULES, ShotRule, apply_rules, check_shots
from app.evidence.plausibility.shots_w2 import wave2_import_flags, wave2_shot_rules
from app.evidence.settings import settings
from app.schemas.evidence import ExtractedSession, Flag, Shot


def run_shot_rules(
    shots: Sequence[Shot], *, monitor: str | None = None, import_id: str | None = None
) -> list[Flag]:
    """Flags for a parsed import (per club group, S14 on what survives the rejects), plus the
    W2 per-import flags (S17) when W2 is on."""
    if not settings.wave2:
        return check_shots(shots, import_id=import_id)
    flags = check_shots(shots, import_id=import_id, extra_rules=wave2_shot_rules(monitor))
    return flags + wave2_import_flags(shots, monitor, import_id=import_id)


def run_screenshot_rules(session: ExtractedSession, *, import_id: str | None = None) -> list[Flag]:
    """`validate_extraction` (V1-V4) with the S rules as V3: the v1 rules, or with W2 on the v1
    rules then W2 on the rows nothing rejected (`apply_rules`), plus S17."""
    if not settings.wave2:
        return validate_extraction(session, shot_rules=V1_SHOT_RULES, import_id=import_id)
    rules: tuple[ShotRule, ...] = (
        partial(apply_rules, extra_rules=wave2_shot_rules(session.monitor)),
    )
    flags = validate_extraction(session, shot_rules=rules, import_id=import_id)
    return flags + wave2_import_flags(cells_to_shots(session), session.monitor, import_id=import_id)


def stored_monitor(report_json: str) -> str | None:
    """The monitor a stored import was checked with: an `ImportReport`'s `vendor` or an
    `ExtractionReview`'s `monitor`."""
    try:
        data = json.loads(report_json)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    value = data.get("vendor") or data.get("monitor")
    return value if isinstance(value, str) else None
