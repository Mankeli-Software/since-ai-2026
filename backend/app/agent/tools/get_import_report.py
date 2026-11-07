from pydantic import BaseModel

from app.agent.tools._common import NOT_AVAILABLE
from app.core.tooling import ToolContext, fitter_tool


class GetImportReportIn(BaseModel):
    import_id: str


class GetImportReportOut(BaseModel):
    status: str
    import_id: str


@fitter_tool("get_import_report")
async def get_import_report(ctx: ToolContext, args: GetImportReportIn) -> GetImportReportOut:
    """Get the quality report of an import: shot counts, quality, flag codes and numeric means.
    Not available yet: tell the golfer you cannot read imports in this version."""
    # shortcut: stub. TODO(EVIDENCE #8-#12): return the stored ImportReport (numbers and flag
    # codes only, never free text).
    return GetImportReportOut(status=NOT_AVAILABLE, import_id=args.import_id)
