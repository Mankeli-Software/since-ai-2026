"""Vision extraction checks V1-V5 (plan §5.1, §5.2; issue #34). Pure: no model calls, no I/O.

`agent/extract.py` reads a launch-monitor screenshot into a flat `ExtractedSession`; this module
decides, deterministically, which cells the golfer must confirm. Every cell flag carries
`shot_index = cell.row` and `field = cell.field`, so the screenshot route maps flags straight to
`flagged_cells` (see `flagged_cells()`). V6 (always show the "this is what we read" table) is v1
and lives with the route/UI, not here.

| Rule | Function | Severity |
|---|---|---|
| V1 schema | `v1_schema_check` (raw output), `v1_cell_integrity` (parsed) | reject, retry once |
| V2 unit labels | `v2_unit_labels` | confirm |
| V3 shot rules | `v3_shot_rules` (injected S1-S13 rules on the read shots) | the rules' own |
| V4 cells to confirm | `v4_cells_to_confirm` | confirm, highlighted |
| V5 double read | `v5_double_read` | confirm |
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any, TypedDict

from pydantic import ValidationError

from app.evidence.plausibility.thresholds import (
    S1_BOUNDS,
    S3_SMASH_TOL,
    S6_TOTAL_BELOW_CARRY_YD,
    S13_F2P_TOL_DEG,
)
from app.schemas.evidence import Cell, ExtractedSession, Flag, Shot, ShotField

ShotRule = Callable[[list[Shot]], list[Flag]]
"""A shot-level rule from `plausibility/shots.py` (S1-S13): shots in, flags out. Its flags'
`shot_index` is the position in the list it was given; V3 maps that back to the screen row."""

# --------------------------------------------------------------------------- thresholds
# Plan §5.2. Rule definitions live in `thresholds.py` (one copy, shared with the shot rules).

V4_MIN_CONFIDENCE = 0.8  # V4: cell confidence < 0.8 -> confirm

# Cell-level parity bits for V4 (plan §5.2 V3: "the checksums work like parity bits"): the S1 hard
# 7-iron bounds and the S3 / S6 / S13 tolerances, applied to single read cells so a misread is
# highlighted even before the full shot rules run. A value outside them on a screenshot is far
# more likely a misread digit than a real shot, hence confirm (not reject).
S1_CELL_BOUNDS = S1_BOUNDS
# A screen showing TrackMan's absolute Dynamic Lie (about 58-66 deg) is converted by the parser
# (dynamicLie - club_lie, plan §5.1), so it is not a misread.
ABSOLUTE_DYNAMIC_LIE_DEG = (45.0, 80.0)
# Decimal-point slips tried, in order, to suggest a corrected value ("1520" read for "152.0").
DECIMAL_SLIPS = (0.1, 0.01, 10.0)

# Rule hits that point at a misread cell (plan §5.2 V4: "hit by S3 or S5"), and which cells.
_RULE_HIT_FIELDS: dict[str, tuple[ShotField, ...]] = {
    "S3": ("smash_factor", "ball_speed_mph", "club_speed_mph"),
    "S5": ("carry_yd",),
}

# V5: two reads of the same cell agree when they are this close.
V5_REL_TOL = 1e-3
V5_ABS_TOL = 1e-3

# V2: unit tokens that mean the screen is not in mph / yd.
_METRIC_UNIT_TOKENS = frozenset(
    {"m", "meter", "meters", "metre", "metres", "km/h", "kmh", "kph", "m/s", "mps"}
)
_SAFE_STRING = re.compile(r"^[\w %./°-]{0,32}$")  # evidence/CLAUDE.md: cap strings from uploads
_UNSAFE_CHARS = re.compile(r"[^\w %./°-]")

_TOP_LEVEL_KEYS = frozenset(ExtractedSession.model_fields)
_CELL_KEYS = frozenset(Cell.model_fields)


def _safe(s: str) -> str | None:
    """Strip characters outside the upload-string whitelist and cap at 32."""
    s = _UNSAFE_CHARS.sub("", s).strip()[:32]
    return s if s and _SAFE_STRING.fullmatch(s) else None


def _cell_flag(cell: Cell, code: str, severity: str, message_id: str, **kw: Any) -> Flag:
    return Flag.model_validate(
        {
            "code": code,
            "severity": severity,
            "field": cell.field,
            "value": cell.value if math.isfinite(cell.value) else None,
            "shot_index": cell.row,
            "message_id": message_id,
            **kw,
        }
    )


def _usable_cells(session: ExtractedSession) -> dict[tuple[int, str], Cell]:
    """(row, field) -> cell, first read wins; non-finite values dropped (V1 flags them)."""
    out: dict[tuple[int, str], Cell] = {}
    for c in session.cells:
        if math.isfinite(c.value) and (c.row, c.field) not in out:
            out[(c.row, c.field)] = c
    return out


def cells_to_shots(session: ExtractedSession, *, club: str = "own_7i") -> list[Shot]:
    """The read cells as pack-schema `Shot`s, one per screen row in row order
    (`shot_no = row`). Unread cells stay None, like a home-radar export."""
    rows: dict[int, dict[str, float]] = {}
    for (row, field), cell in sorted(_usable_cells(session).items()):
        rows.setdefault(row, {})[field] = cell.value
    return [
        Shot(session="import", club=club, shot_no=row, **vals)  # type: ignore[arg-type]
        for row, vals in sorted(rows.items())
    ]


# --------------------------------------------------------------------------- V1


def v1_schema_check(raw: Any) -> tuple[ExtractedSession | None, list[Flag]]:
    """V1 on the raw model output (dict, JSON str/bytes, or an `ExtractedSession`): it must match
    the strict flat schema with no extra keys. On failure: `(None, [V1 reject])`, and the
    extractor retries once. The flag carries only an error count, never the model's text."""
    if isinstance(raw, ExtractedSession):
        return raw, []
    reject = Flag(
        code="V1",
        severity="reject",
        message_id="v1_schema_mismatch",
        expected="flat ExtractedSession; retry once",
    )
    try:
        data = json.loads(raw) if isinstance(raw, str | bytes | bytearray) else raw
    except ValueError:
        return None, [reject]
    if not isinstance(data, Mapping):
        return None, [reject]
    extra = set(data) - _TOP_LEVEL_KEYS
    cells = data.get("cells")
    if isinstance(cells, list):
        for c in cells:
            if isinstance(c, Mapping):
                extra |= set(c) - _CELL_KEYS
    if extra:
        return None, [reject.model_copy(update={"value": float(len(extra))})]
    try:
        session = ExtractedSession.model_validate(data)
    except ValidationError as e:
        return None, [reject.model_copy(update={"value": float(e.error_count())})]
    return session, []


def v1_cell_integrity(session: ExtractedSession) -> list[Flag]:
    """V1 on a parsed session: no cells at all, a non-finite value, confidence outside 0..1,
    a negative row, or the same (row, field) read twice. Each bad cell is rejected."""
    if not session.cells:
        return [
            Flag(
                code="V1",
                severity="reject",
                message_id="v1_no_cells",
                expected="at least one cell; retry once",
            )
        ]
    flags: list[Flag] = []
    seen: set[tuple[int, str]] = set()
    for c in session.cells:
        if not math.isfinite(c.value):
            flags.append(_cell_flag(c, "V1", "reject", "v1_value_not_finite"))
        elif not (0.0 <= c.confidence <= 1.0) or not math.isfinite(c.confidence):
            flags.append(_cell_flag(c, "V1", "reject", "v1_confidence_out_of_range"))
        elif c.row < 0:
            flags.append(_cell_flag(c, "V1", "reject", "v1_negative_row"))
        elif (c.row, c.field) in seen:
            flags.append(_cell_flag(c, "V1", "reject", "v1_duplicate_cell"))
        seen.add((c.row, c.field))
    return flags


# --------------------------------------------------------------------------- V2


def _unit_tokens(label: str) -> set[str]:
    return set(re.findall(r"[a-z/]+", label.lower()))


def v2_unit_labels(session: ExtractedSession) -> list[Flag]:
    """V2: no unit labels on the screen -> confirm the units (mph / yd assumed; S10 and G2 infer
    them later). Metric labels (m, km/h, m/s) -> confirm, so values are converted, not misused."""
    labels = [s for s in (lbl.strip() for lbl in session.unit_labels_seen) if s]
    if not labels:
        return [
            Flag(
                code="V2",
                severity="confirm",
                message_id="v2_units_missing",
                expected="mph, yd",
            )
        ]
    return [
        Flag(
            code="V2",
            severity="confirm",
            value=_safe(lbl),
            message_id="v2_units_metric",
            expected="mph, yd",
        )
        for lbl in labels
        if _unit_tokens(lbl) & _METRIC_UNIT_TOKENS
    ]


# --------------------------------------------------------------------------- V3


def v3_shot_rules(
    session: ExtractedSession, rules: Sequence[ShotRule], *, club: str = "own_7i"
) -> list[Flag]:
    """V3: every read shot runs through the shot rules (S1-S13 from `plausibility/shots.py`,
    passed in so this module does not depend on them). Returned flags keep their own code and
    severity; `shot_index` is mapped from list position back to the screen row."""
    shots = cells_to_shots(session, club=club)
    rows = [s.shot_no for s in shots]
    out: list[Flag] = []
    for rule in rules:
        for f in rule(shots):
            idx = f.shot_index
            row = rows[idx] if idx is not None and 0 <= idx < len(rows) else idx
            out.append(f.model_copy(update={"shot_index": row}))
    return out


# --------------------------------------------------------------------------- V4


def _decimal_slip(field: str, value: float) -> float | None:
    lo, hi = S1_CELL_BOUNDS[field]
    for k in DECIMAL_SLIPS:
        x = round(value * k, 4)
        if lo <= x <= hi:
            return x
    return None


def _out_of_bounds(c: Cell) -> bool:
    bounds = S1_CELL_BOUNDS.get(c.field)
    if bounds is None:
        return False
    if c.field == "impact_toe_up_deg" and (
        ABSOLUTE_DYNAMIC_LIE_DEG[0] <= c.value <= ABSOLUTE_DYNAMIC_LIE_DEG[1]
    ):
        return False
    return not (bounds[0] <= c.value <= bounds[1])


_Checked = list[tuple[Cell, str | None, float | None]]  # (cell, expected, suggested_value)


def _row_checksums(row: Mapping[str, Cell]) -> list[tuple[str, _Checked]]:
    """The broken checksums in one screen row: S3 smash, S13 face-to-path, S6 total < carry.
    Every cell in a broken checksum is returned; the golfer picks which one was misread."""
    out: list[tuple[str, _Checked]] = []
    club, ball, smash = (
        row.get("club_speed_mph"),
        row.get("ball_speed_mph"),
        row.get("smash_factor"),
    )
    if club and ball and smash and club.value > 0 and smash.value > 0:
        ratio = ball.value / club.value
        if abs(smash.value - ratio) > S3_SMASH_TOL:
            out.append(
                (
                    "v4_smash_checksum",
                    [
                        (smash, f"ball/club = {ratio:.2f}", round(ratio, 2)),
                        (ball, f"smash x club = {smash.value * club.value:.1f}", None),
                        (club, f"ball/smash = {ball.value / smash.value:.1f}", None),
                    ],
                )
            )
    face, path, f2p = (
        row.get("face_angle_deg"),
        row.get("club_path_deg"),
        row.get("face_to_path_deg"),
    )
    if face and path and f2p:
        diff = face.value - path.value
        if abs(f2p.value - diff) > S13_F2P_TOL_DEG:
            out.append(
                (
                    "v4_face_to_path_checksum",
                    [
                        (f2p, f"face - path = {diff:+.1f}", round(diff, 1)),
                        (face, None, None),
                        (path, None, None),
                    ],
                )
            )
    carry, total = row.get("carry_yd"), row.get("total_yd")
    if carry and total and total.value < carry.value - S6_TOTAL_BELOW_CARRY_YD:
        out.append(
            (
                "v4_total_below_carry",
                [
                    (total, f">= carry {carry.value:g} - 3", None),
                    (carry, f"<= total {total.value:g} + 3", None),
                ],
            )
        )
    return out


def v4_cells_to_confirm(session: ExtractedSession, rule_flags: Iterable[Flag] = ()) -> list[Flag]:
    """V4: highlight each cell the golfer must confirm, one flag per (row, field), most specific
    reason first: out of the S1 bounds (with a decimal-slip suggestion), a broken checksum
    (S3 smash, S13 face-to-path, S6 total < carry), a hit by the shot rules S3 / S5 (from V3),
    then confidence < 0.8."""
    cells = _usable_cells(session)
    flags: list[Flag] = []
    done: set[tuple[int, str]] = set()

    def add(c: Cell, message_id: str, **kw: Any) -> None:
        if (c.row, c.field) in done:
            return
        done.add((c.row, c.field))
        flags.append(_cell_flag(c, "V4", "confirm", message_id, **kw))

    # Out of the hard bounds: almost always a misread digit or a dropped decimal point.
    for c in cells.values():
        if _out_of_bounds(c):
            lo, hi = S1_CELL_BOUNDS[c.field]
            add(
                c,
                "v4_out_of_bounds",
                expected=f"{lo:g} to {hi:g}",
                suggested_value=_decimal_slip(c.field, c.value),
            )

    # Checksums inside one row (parity bits). A checksum is skipped when one of its cells is
    # already out of bounds: that cell is the misread, the others need not light up.
    for row in sorted({r for r, _ in cells}):
        row_cells = {f: c for (r, f), c in cells.items() if r == row}
        for message_id, checked in _row_checksums(row_cells):
            if any((row, c.field) in done for c, _, _ in checked):
                continue
            for c, expected, suggested in checked:
                add(c, message_id, expected=expected, suggested_value=suggested)

    # Cells hit by the shot rules S3 / S5 (V3 output, already mapped to screen rows).
    for f in rule_flags:
        fields = _RULE_HIT_FIELDS.get(f.code)
        if not fields or f.shot_index is None:
            continue
        if f.field in fields:
            fields = (f.field,)  # type: ignore[assignment]
        for field in fields:
            c = cells.get((f.shot_index, field))
            if c:
                add(c, "v4_rule_hit", expected=f"passes {f.code}")

    # Low read confidence.
    for c in cells.values():
        if c.confidence < V4_MIN_CONFIDENCE:
            add(c, "v4_low_confidence", expected=f"confidence >= {V4_MIN_CONFIDENCE}")

    return flags


# --------------------------------------------------------------------------- V5


def v5_double_read(session: ExtractedSession, second: ExtractedSession) -> list[Flag]:
    """V5: two independent reads (e.g. Sonnet = `session`, Haiku = `second`). A cell read in
    only one, or read differently, is confirmed; `suggested_value` is the other read."""
    a, b = _usable_cells(session), _usable_cells(second)
    flags: list[Flag] = []
    for key in sorted(a.keys() | b.keys()):
        ca, cb = a.get(key), b.get(key)
        if ca and cb:
            if not math.isclose(ca.value, cb.value, rel_tol=V5_REL_TOL, abs_tol=V5_ABS_TOL):
                flags.append(
                    _cell_flag(
                        ca, "V5", "confirm", "v5_double_read_mismatch", suggested_value=cb.value
                    )
                )
        elif ca:
            flags.append(_cell_flag(ca, "V5", "confirm", "v5_double_read_missing"))
        elif cb:
            flags.append(
                _cell_flag(
                    cb,
                    "V5",
                    "confirm",
                    "v5_double_read_missing",
                    value=None,
                    suggested_value=cb.value,
                )
            )
    return flags


# --------------------------------------------------------------------------- entry point


def validate_extraction(
    session: ExtractedSession,
    *,
    second_read: ExtractedSession | None = None,
    shot_rules: Sequence[ShotRule] = (),
    club: str = "own_7i",
    import_id: str | None = None,
) -> list[Flag]:
    """Run V1 (cell integrity), V2, V3, V4 and, with `second_read`, V5 on one extracted session.

    Cell flags carry `shot_index = cell.row` and `field = cell.field`; pass the result to
    `flagged_cells()` for the review table. Run `v1_schema_check` on the raw model output first
    when the extractor did not already validate it.
    """
    flags = v1_cell_integrity(session)
    flags += v2_unit_labels(session)
    rule_flags = v3_shot_rules(session, shot_rules, club=club) if shot_rules else []
    flags += rule_flags
    flags += v4_cells_to_confirm(session, rule_flags)
    if second_read is not None:
        flags += v5_double_read(session, second_read)
    if import_id is not None:
        flags = [f.model_copy(update={"import_id": import_id}) for f in flags]
    return flags


class FlaggedCell(TypedDict):
    """One highlighted cell for the `extraction_review` block (plan §4, `flagged_cells`)."""

    row: int
    field: str
    confidence: float
    codes: list[str]


def flagged_cells(session: ExtractedSession, flags: Iterable[Flag]) -> list[FlaggedCell]:
    """Flags that point at a read cell -> `[{row, field, confidence, codes}]`, in row order."""
    cells = _usable_cells(session)
    out: dict[tuple[int, str], FlaggedCell] = {}
    for f in flags:
        if f.shot_index is None or f.field is None:
            continue
        c = cells.get((f.shot_index, f.field))
        if c is None:
            continue
        entry = out.setdefault(
            (c.row, c.field),
            {"row": c.row, "field": c.field, "confidence": c.confidence, "codes": []},
        )
        if f.code not in entry["codes"]:
            entry["codes"].append(f.code)
    return [out[k] for k in sorted(out)]
