"""`POST /api/sessions/{id}/imports/trackman-csv` (plan §5.1, §5.4; issue #30).

multipart `file` (<= 2 MB, a TrackMan CSV export) + `club` (the club the golfer picked; a `Club`
column in the file overrides it per row) -> a pending `ImportReport`. Nothing is used until the
golfer confirms through `/imports/{import_id}/confirm`.

Consent copy for the upload form (one line, WEB-APP shows it before the upload):
"We read the shot numbers from your file and then delete it. Only the numbers are kept."

The raw file is never stored: only the parsed shots and the report are kept with the import.
"""

import secrets
import statistics
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.api.deps import SessionDep, StoreDep
from app.core.errors import InvalidInputError
from app.evidence.fuse import shot_quality, usable_shots
from app.evidence.parsers.trackman_csv import parse_trackman_csv
from app.evidence.plausibility.shots import check_shots
from app.evidence.plausibility.shots_w2 import (
    ShotContext,
    wave2_session_flags,
    wave2_shot_rules,
)
from app.evidence.settings import settings
from app.schemas.evidence import ImportReport, Shot, ShotQualityReport
from app.schemas.session import StoredImport

router = APIRouter(tags=["evidence"])

MAX_CSV_BYTES = 2 * 1024 * 1024
SUMMARY_FIELDS = ("club_speed_mph", "ball_speed_mph", "carry_yd", "impact_toe_up_deg")


def _means(shots: list[Shot], prefix: str = "") -> dict[str, float]:
    out: dict[str, float] = {}
    for f in SUMMARY_FIELDS:
        xs = [v for s in shots if (v := getattr(s, f)) is not None]
        if xs:
            out[prefix + f] = round(statistics.fmean(xs), 2)
    return out


def _report(
    shots: list[Shot], clubs: dict[str, int], import_id: str, vendor: str | None
) -> ShotQualityReport:
    """v1 S rules (S1, S3, S7, S8, S10, S14; plus W2 with EVIDENCE_WAVE2=1) + quality; means
    over the usable shots, per club when the file carries several. Codes and numbers only."""
    ctx = ShotContext(monitor=vendor)
    extra = wave2_shot_rules(ctx) if settings.wave2 else ()
    flags = check_shots(shots, import_id=import_id, extra_rules=extra)
    if settings.wave2:
        flags += wave2_session_flags(shots, ctx, import_id=import_id)
    usable = usable_shots(shots, flags)
    if len(clubs) == 1:
        summary = _means(usable)
    else:
        summary = {}
        for club in clubs:
            summary |= _means([s for s in usable if s.club == club], prefix=f"{club}:")
    return shot_quality(shots, flags, summary)


@router.post("/api/sessions/{session_id}/imports/trackman-csv")
async def import_trackman_csv(
    session: SessionDep,
    store: StoreDep,
    file: UploadFile,
    club: Annotated[str, Form(max_length=64)] = "own_7i",
) -> ImportReport:
    data = await file.read(MAX_CSV_BYTES + 1)
    await file.close()
    if len(data) > MAX_CSV_BYTES:
        raise InvalidInputError("The CSV is larger than 2 MB.", code="file_too_large")
    if not data.strip():
        raise InvalidInputError("The file is empty.", code="bad_csv")
    try:
        parsed = await run_in_threadpool(parse_trackman_csv, data, club=club)
    except ValueError as e:
        raise InvalidInputError(str(e), code="bad_csv") from e
    finally:
        del data  # the raw file is dropped here; only the parsed numbers are kept

    import_id = "imp_" + secrets.token_urlsafe(9)
    only_club = next(iter(parsed.clubs)) if len(parsed.clubs) == 1 else None
    report = ImportReport(
        import_id=import_id,
        kind="trackman_csv",
        club=only_club,
        shots=parsed.shots,
        report=_report(parsed.shots, parsed.clubs, import_id, parsed.vendor),
        status="pending",
        clubs=parsed.clubs,
        dropped_clubs=parsed.dropped_clubs,
        vendor=parsed.vendor,
        units_seen=parsed.units_seen,
        dynamic_lie_absolute=parsed.dynamic_lie_absolute,
    )
    await store.put_import(
        session.id,
        StoredImport(
            import_id=import_id,
            kind="trackman_csv",
            club=only_club,
            parsed_shots_json="[" + ",".join(s.model_dump_json() for s in parsed.shots) + "]",
            report_json=report.model_dump_json(exclude={"shots", "state"}),
            status="pending",
            created_at=datetime.now(UTC),
        ),
    )
    return report
