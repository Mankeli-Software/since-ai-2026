"""`POST /api/sessions/{id}/imports/screenshot` (plan §3.8, #15/#19).

multipart `file` (<= 8 MB, downscaled to 1568 px before vision) + `kind` -> `ExtractionReview`, the
"this is what we read" table (V6). Nothing is used until the golfer confirms through
`/imports/{import_id}/confirm` (EVIDENCE). The raw upload is never stored: only the numbers read
are kept, as the pending import's review.
"""

import secrets
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile

from app.agent.extract import MAX_UPLOAD_BYTES, extractor
from app.agent.guard import bind, check_vision
from app.api.deps import SessionDep, StoreDep
from app.api.guard_deps import DemoKeyHeader
from app.core.errors import InvalidInputError
from app.evidence.plausibility.extraction import validate_extraction
from app.schemas.evidence import ExtractedSession
from app.schemas.extraction import (
    ExtractionReview,
    FlaggedCell,
    ReviewCell,
    ReviewRow,
    RoundStatsRead,
    ScreenshotKind,
)
from app.schemas.flags import Flag
from app.schemas.session import StoredImport

router = APIRouter(tags=["evidence"])

LOW_CONFIDENCE = 0.8  # V4 (plan §5.2); round stats only, launch monitors use validate_extraction
_LOW_CONF_MSG = "v4_low_confidence"


def _flagged_cells(s: ExtractedSession, flags: list[Flag]) -> list[FlaggedCell]:
    """One entry per flagged cell. A plausibility hit (S rules, V4 checksums, V5) outranks a
    plain low-confidence one, so the table shows the reason that matters most."""
    conf = {(c.row, c.field): c.confidence for c in s.cells}
    out: dict[tuple[int, str], FlaggedCell] = {}
    for f in flags:
        key = (f.shot_index, f.field)
        if f.shot_index is None or f.field is None or key not in conf:
            continue  # table-level flags (V1, V2) stay in `review.flags`
        low = f.message_id == _LOW_CONF_MSG
        prev = out.get(key)
        if prev is not None and (low or prev.reason == "plausibility"):
            continue
        out[key] = FlaggedCell(
            row=f.shot_index,
            field=f.field,
            reason="low_confidence" if low else "plausibility",
            confidence=conf[key],
            code=None if low else f.code,
            message_id=f.message_id,
            suggested_value=f.suggested_value,
        )
    return [out[k] for k in sorted(out)]


def _launch_monitor_review(
    import_id: str, s: ExtractedSession, synthetic: bool
) -> ExtractionReview:
    # V1 cell integrity, V2 units, V4 bounds/checksums/confidence (#34). Pure, no model calls.
    # TODO: pass the v1 S rules as `shot_rules=[...]` once #31 lands (V3).
    flags = validate_extraction(s, import_id=import_id)
    flagged = _flagged_cells(s, flags)
    hit = {(f.row, f.field) for f in flagged}
    columns = list(dict.fromkeys(c.field for c in s.cells))
    by_row: dict[int, list[ReviewCell]] = {}
    for c in sorted(s.cells, key=lambda c: (c.row, columns.index(c.field))):
        by_row.setdefault(c.row, []).append(
            ReviewCell(
                field=c.field,
                literal=c.literal,
                value=c.value,
                confidence=c.confidence,
                flagged=(c.row, c.field) in hit,
            )
        )
    return ExtractionReview(
        import_id=import_id,
        rows=[ReviewRow(row=r, cells=cells) for r, cells in sorted(by_row.items())],
        flagged_cells=flagged,
        kind="launch_monitor",
        source="fixture" if synthetic else "vision",
        synthetic=synthetic,
        monitor=s.monitor,
        columns=columns,
        unit_labels_seen=s.unit_labels_seen,
        headers_read=s.headers_read,
        flags=flags,
    )


def _round_stats_review(import_id: str, r: RoundStatsRead, synthetic: bool) -> ExtractionReview:
    """`{avg_score, n_rounds}` for EVIDENCE's `parsers/round_stats.py` -> score bucket (G13)."""
    cells = [
        ReviewCell(
            field="avg_score",
            literal="" if r.avg_score is None else f"{r.avg_score:g}",
            value=r.avg_score,
            confidence=r.confidence,
        ),
        ReviewCell(
            field="n_rounds",
            literal="" if r.n_rounds is None else str(r.n_rounds),
            value=None if r.n_rounds is None else float(r.n_rounds),
            confidence=r.confidence,
        ),
    ]
    flagged = []
    for c in cells:
        if c.value is None or c.confidence < LOW_CONFIDENCE:
            c.flagged = True
            flagged.append(
                FlaggedCell(row=1, field=c.field, reason="low_confidence", confidence=c.confidence)
            )
    return ExtractionReview(
        import_id=import_id,
        rows=[ReviewRow(row=1, cells=cells)],
        flagged_cells=flagged,
        kind="round_stats",
        source="fixture" if synthetic else "vision",
        synthetic=synthetic,
        monitor=r.app,
        columns=["avg_score", "n_rounds"],
        round_stats=r,
    )


@router.post("/api/sessions/{session_id}/imports/screenshot")
async def import_screenshot(
    session: SessionDep,
    store: StoreDep,
    file: UploadFile,
    kind: Annotated[ScreenshotKind, Form()],
    demo_key: DemoKeyHeader = None,
) -> ExtractionReview:
    check_vision(session, demo_key, live=not extractor.mock)  # 429s (#18)
    bind(session.id, session.budget)  # model_call log lines carry the session id
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if len(data) > MAX_UPLOAD_BYTES:
        raise InvalidInputError("Screenshot is larger than 8 MB.", code="file_too_large")
    if not data:
        raise InvalidInputError("The file is empty.", code="bad_image")

    import_id = "imp_" + secrets.token_urlsafe(9)
    synthetic = extractor.mock
    if kind == "launch_monitor":
        review = _launch_monitor_review(import_id, await extractor.extract(data, kind), synthetic)
    else:
        review = _round_stats_review(
            import_id, await extractor.extract_round_stats(data), synthetic
        )
    del data  # the raw image is dropped here; only the numbers above are kept

    await store.put_import(
        session.id,
        StoredImport(
            import_id=import_id,
            kind="screenshot" if kind == "launch_monitor" else "round_stats",
            report_json=review.model_dump_json(),
            status="pending",
            created_at=datetime.now(UTC),
        ),
    )
    return review
