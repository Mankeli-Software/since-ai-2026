import json
import statistics

from pydantic import BaseModel, Field

from app.core.tooling import ToolContext, fitter_tool
from app.schemas.flags import Flag


class GetImportReportIn(BaseModel):
    import_id: str = ""


class GetImportReportOut(BaseModel):
    status: str
    import_id: str
    shots_count: int = 0
    shots_summary: dict[str, float] = Field(default_factory=dict)
    flags: list[Flag] = Field(default_factory=list)


@fitter_tool("get_import_report")
async def get_import_report(ctx: ToolContext, args: GetImportReportIn) -> GetImportReportOut:
    """Get the quality report of an import: shot counts, quality, flag codes, and numeric means."""
    s = ctx.session
    shots = list(s.state.shots) if s.state and s.state.shots else []
    flags = list(s.flags) + list(s.state.pending_flags)

    summary: dict[str, float] = {}
    if shots:
        carries = [sh.carry_yd for sh in shots if sh.carry_yd is not None]
        speeds = [sh.club_speed_mph for sh in shots if sh.club_speed_mph is not None]
        if carries:
            summary["carry_yd_mean"] = round(float(statistics.mean(carries)), 1)
        if speeds:
            summary["club_speed_mph_median"] = round(float(statistics.median(speeds)), 1)

    # If store has stored import, load report_json
    if args.import_id and ctx.store:
        try:
            stored_imp = await ctx.store.get_import(s.id, args.import_id)
            if stored_imp and stored_imp.report_json:
                data = json.loads(stored_imp.report_json)
                if isinstance(data, dict):
                    for k, v in data.items():
                        if isinstance(v, (int, float)):
                            summary[k] = float(v)
        except Exception:
            pass

    return GetImportReportOut(
        status="ok",
        import_id=args.import_id or (s.state.import_ids[-1] if s.state.import_ids else ""),
        shots_count=len(shots),
        shots_summary=summary,
        flags=flags,
    )
