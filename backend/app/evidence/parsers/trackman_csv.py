"""TrackMan CSV parser (plan §5.1, §5.4; issue #30). Pure: bytes in, `Shot`s out.

- Headers map to the pack's shots.csv columns through `aliases/<vendor>.json` (one file per launch
  monitor; the best-matching file wins). Unknown columns are ignored.
- The units row under the header (`[mph]`, `[yds]`, `m/s`, ...) is parsed and every value is
  converted to mph / yd / deg / rpm / mm. With no units row the export is assumed to be set to
  mph / yards / degrees (the pack's `trackman_column_map.csv` note).
- If the file has a `Club` column its rows are grouped by it, so one upload can carry several clubs.
  A value that is already a club slug (`own_7i`, `takomo_<head>_<shaft>_std`) is kept; an empty or
  7-iron value (`7 Iron`, `7i`) takes the club the golfer picked; any other club is left out and
  counted (irons only, 7-iron only in v1). Without a `Club` column every row is the picked club.
- Empty cells stay empty (home radars export only some columns). Summary rows (Average, Std. Dev)
  are skipped.
- **Dynamic Lie is absolute** on real TrackMan (about 58-66 deg) while the pack stores toe-up from
  standard. If the column's median sits in 45-80 deg: `impact_toe_up_deg = dynamicLie - club_lie`,
  with club_lie = 62 deg + the built lie of a Takomo test club (`_std` = 0), 62 deg for an own club.

No free text leaves this module: labels read from the file are capped to `^[\\w %./°-]{0,32}$`.
"""

from __future__ import annotations

import csv
import json
import math
import re
import statistics
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from app.schemas.evidence import Shot, ShotField

STANDARD_LIE_DEG = 62.0
ABSOLUTE_LIE_RANGE = (45.0, 80.0)
MAX_ROWS = 2000
MIN_MAPPED_COLUMNS = 2

_ALIASES_DIR = Path(__file__).with_name("aliases")
_SAFE = re.compile(r"[^\w %./°-]")
_SLUG = re.compile(r"^(own_7i|takomo_[a-z0-9-]+_[a-z0-9-]+_[a-z0-9.+-]+)$")
_SEVEN_IRON = re.compile(r"^(7\s*-?\s*(i|iron)|i\s*-?\s*7|iron\s*7|7)$", re.IGNORECASE)
_BUILT_LIE = re.compile(r"_(up|flat)(\d+(?:\.\d+)?)$")
_NUMBER = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)$")
_SUMMARY_ROWS = {"average", "avg", "avg.", "mean", "std. dev", "std. dev.", "std dev", "stdev"}
_SUMMARY_ROWS |= {"consistency", "total", "min", "max", "median"}

# Unit kind per pack column -> {unit token: factor to the pack unit}.
_SPEED = {"mph": 1.0, "km/h": 1 / 1.609344, "kmh": 1 / 1.609344, "kph": 1 / 1.609344}
_SPEED |= {"m/s": 2.23694, "mps": 2.23694}
_YARDS = {"yd": 1.0, "yds": 1.0, "yard": 1.0, "yards": 1.0, "m": 1.09361, "meters": 1.09361}
_YARDS |= {"metres": 1.09361, "ft": 1 / 3, "feet": 1 / 3}
_MM = {"mm": 1.0, "cm": 10.0, "m": 1000.0, "in": 25.4, "inch": 25.4, "inches": 25.4}
_DEG = {"deg": 1.0, "°": 1.0, "degrees": 1.0, "degree": 1.0}
_RPM = {"rpm": 1.0}
_RATIO: dict[str, float] = {}
_KIND: dict[str, dict[str, float]] = {
    "club_speed_mph": _SPEED,
    "ball_speed_mph": _SPEED,
    "carry_yd": _YARDS,
    "total_yd": _YARDS,
    "side_yd": _YARDS,
    "apex_yd": _YARDS,
    "impact_offset_mm": _MM,
    "impact_height_mm": _MM,
    "spin_rate_rpm": _RPM,
    "smash_factor": _RATIO,
}
_DEFAULT_UNIT = {id(_SPEED): "mph", id(_YARDS): "yd", id(_MM): "mm", id(_DEG): "deg"}
_DEFAULT_UNIT |= {id(_RPM): "rpm"}
# Directions can come as "L5.2" / "R3.1": + = right in the pack's frame.
_LR_FIELDS = {"launch_direction_deg", "side_yd", "club_path_deg", "face_angle_deg"}
_LR_FIELDS |= {"face_to_path_deg", "spin_axis_deg"}


@dataclass(frozen=True)
class TrackmanCsv:
    """Parse result: shots in the pack's schema plus what the import report shows."""

    shots: list[Shot]
    clubs: dict[str, int] = field(default_factory=dict)
    dropped_clubs: dict[str, int] = field(default_factory=dict)
    vendor: str | None = None
    columns: list[str] = field(default_factory=list)
    units_seen: list[str] = field(default_factory=list)
    dynamic_lie_absolute: bool = False


def cap(text: str) -> str:
    """Strip a string read from a file down to `^[\\w %./°-]{0,32}$`."""
    return _SAFE.sub("", text).strip()[:32]


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.lower())


@cache
def _alias_sets() -> tuple[tuple[str, dict[str, str], frozenset[str]], ...]:
    """(vendor, {normalised header: pack column}, {normalised club headers}), sorted by file."""
    out = []
    for path in sorted(_ALIASES_DIR.glob("*.json")):
        spec = json.loads(path.read_text(encoding="utf-8"))
        cols = {_norm(a): col for col, aliases in spec["columns"].items() for a in aliases}
        out.append((str(spec["vendor"]), cols, frozenset(_norm(c) for c in spec.get("club", []))))
    return tuple(out)


def _decode(raw: bytes) -> str:
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("trackman csv: unreadable text encoding")


def _rows(text: str) -> tuple[list[list[str]], str]:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if lines and lines[0].lower().startswith("sep="):
        lines = lines[1:]
    if not lines:
        raise ValueError("trackman csv: the file is empty")
    delim = max((",", ";", "\t"), key=lines[0].count)
    rows = [[c.strip() for c in r] for r in csv.reader(lines, delimiter=delim)]
    return rows, delim


def _unit_token(cell: str) -> str:
    return cell.strip().strip("[]()").strip().lower()


def _number(cell: str, column: str, decimal_comma: bool) -> float | None:
    s = cell.strip().replace("−", "-").replace(" ", "")
    if not s or s in {"-", "--", "n/a", "na", "N/A", "NA"}:
        return None
    sign = 1.0
    if column in _LR_FIELDS and s[:1] in {"L", "R", "l", "r"}:
        sign = -1.0 if s[0] in {"L", "l"} else 1.0
        s = s[1:]
    if decimal_comma or re.fullmatch(r"[+-]?\d+,\d+", s):
        s = s.replace(",", ".")
    s = s.rstrip("°")
    if not _NUMBER.match(s):
        return None  # garbage cell: left empty, the plausibility rules judge what is left
    x = sign * float(s)
    return x if math.isfinite(x) else None


def club_lie_deg(club: str) -> float:
    """62 deg + the built lie of a Takomo test club (`_std` = 0); 62 deg for an own club."""
    m = _BUILT_LIE.search(club)
    if not club.startswith("takomo_") or m is None:
        return STANDARD_LIE_DEG
    return STANDARD_LIE_DEG + (1 if m.group(1) == "up" else -1) * float(m.group(2))


def _club_of(value: str, picked: str) -> str | None:
    """Slug for a `Club` cell, or None when the row is another club (left out)."""
    v = value.strip()
    if not v or _SEVEN_IRON.match(v):
        return picked
    if _SLUG.match(v):
        return v
    return None


def parse_trackman_csv(raw: bytes, *, club: str = "own_7i") -> TrackmanCsv:
    """TrackMan (or alias-mapped launch-monitor) CSV export -> shots in the pack's schema.

    `club` is the club the golfer picked; it labels every row without a `Club` value. Raises
    `ValueError` when the file is not a recognisable launch-monitor CSV or has no shot rows.
    """
    if not _SLUG.match(club):
        raise ValueError("trackman csv: club must be own_7i or takomo_<head>_<shaft>_<lie>")
    rows, delim = _rows(_decode(raw))
    header = rows[0]
    norm = [_norm(h) for h in header]

    best: tuple[int, str, dict[int, str], int | None] = (0, "", {}, None)
    for vendor, cols, club_headers in _alias_sets():
        mapped: dict[int, str] = {}
        for i, h in enumerate(norm):
            col = cols.get(h)
            if col is not None and col not in mapped.values():
                mapped[i] = col
        club_idx = next((i for i, h in enumerate(norm) if h in club_headers), None)
        if len(mapped) > best[0]:
            best = (len(mapped), vendor, mapped, club_idx)
    n_mapped, vendor, mapped, club_idx = best
    if n_mapped < MIN_MAPPED_COLUMNS:
        raise ValueError("trackman csv: no launch-monitor columns found in the header")

    # Units row: the row under the header whose mapped cells hold no numbers.
    body = rows[1:]
    decimal_comma = delim == ";"
    units: dict[int, str] = {}
    units_seen: list[str] = []
    if body and all(
        _number(body[0][i], mapped[i], decimal_comma) is None for i in mapped if i < len(body[0])
    ):
        first = body[0]
        units = {i: _unit_token(first[i]) for i in mapped if i < len(first) and first[i].strip()}
        units_seen = [cap(first[i]) for i in sorted(units)]
        body = body[1:]

    factors: dict[int, float] = {}
    for i, col in mapped.items():
        table = _KIND.get(col, _DEG)
        if not table:  # smash factor: no unit
            factors[i] = 1.0
            continue
        token = units.get(i) or _DEFAULT_UNIT[id(table)]
        if token not in table:
            raise ValueError(f"trackman csv: unit {cap(token)!r} not understood for {col}")
        factors[i] = table[token]

    clubs: dict[str, int] = {}
    dropped: dict[str, int] = {}
    pending: list[tuple[str, dict[ShotField, float | None]]] = []
    for row in body[:MAX_ROWS]:
        if any(c.strip().lower() in _SUMMARY_ROWS for c in row[:3]):
            continue
        values: dict[ShotField, float | None] = {}
        for i, col in mapped.items():
            x = _number(row[i], col, decimal_comma) if i < len(row) else None
            values[col] = None if x is None else round(x * factors[i], 3)  # type: ignore[index]
        if all(v is None for v in values.values()):
            continue
        cell = row[club_idx] if club_idx is not None and club_idx < len(row) else ""
        slug = _club_of(cell, club)
        if slug is None:
            label = cap(cell) or "unknown"
            dropped[label] = dropped.get(label, 0) + 1
            continue
        clubs[slug] = clubs.get(slug, 0) + 1
        pending.append((slug, values))
    if not pending:
        raise ValueError("trackman csv: no 7-iron shot rows found")

    lies = [v["impact_toe_up_deg"] for _, v in pending if v.get("impact_toe_up_deg") is not None]
    absolute = (
        bool(lies) and ABSOLUTE_LIE_RANGE[0] <= statistics.median(lies) <= ABSOLUTE_LIE_RANGE[1]
    )  # type: ignore[type-var]

    shots: list[Shot] = []
    shot_no: dict[str, int] = {}
    for slug, values in pending:
        lie = values.get("impact_toe_up_deg")
        if absolute and lie is not None:
            values["impact_toe_up_deg"] = round(lie - club_lie_deg(slug), 2)
        shot_no[slug] = shot_no.get(slug, 0) + 1
        shots.append(
            Shot(session="trackman_fitting", club=slug, shot_no=shot_no[slug], **values)  # type: ignore[arg-type]
        )
    return TrackmanCsv(
        shots=shots,
        clubs=clubs,
        dropped_clubs=dropped,
        vendor=vendor,
        columns=[mapped[i] for i in sorted(mapped)],
        units_seen=units_seen,
        dynamic_lie_absolute=absolute,
    )
