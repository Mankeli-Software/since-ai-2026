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
from app.api.deps import SessionDep, StoreDep
from app.core.errors import InvalidInputError
from app.schemas.evidence import ExtractedSession
from app.schemas.extraction import (
    ExtractionReview,
    FlaggedCell,
    ReviewCell,
    ReviewRow,
    RoundStatsRead,
    ScreenshotKind,
)
from app.schemas.session import StoredImport

router = APIRouter(tags=["evidence"])

LOW_CONFIDENCE = 0.8  # V4 (plan §5.2)


def _low_confidence_flags(s: ExtractedSession) -> list[FlaggedCell]:
    return [
        FlaggedCell(row=c.row, field=c.field, reason="low_confidence", confidence=c.confidence)
        for c in s.cells
        if c.confidence < LOW_CONFIDENCE
    ]


def _launch_monitor_review(
    import_id: str, s: ExtractedSession, synthetic: bool
) -> ExtractionReview:
    # ---- validate_extraction seam (#34) -------------------------------------------------------
    # TODO(#34): replace the next line with the pure V2-V4 checks, e.g.
    #   from app.evidence.plausibility.extraction import validate_extraction
    #   flagged = validate_extraction(s)  # -> list[FlaggedCell] (low_confidence + S1-S13 hits)
    # Until then only V4's confidence half runs here.
    flagged = _low_confidence_flags(s)
    # -------------------------------------------------------------------------------------------
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
) -> ExtractionReview:
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
