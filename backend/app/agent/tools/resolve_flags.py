from contextlib import suppress

from pydantic import BaseModel, TypeAdapter

from app.agent.tools._common import commit_state
from app.core.errors import NotFoundError
from app.core.tooling import ToolContext, fitter_tool
from app.evidence import resolve, session_flags
from app.schemas.evidence import Flag, ImportReport, ResolveFlagsRequest, Shot

_SHOTS = TypeAdapter(list[Shot])


class ResolveFlagsOut(BaseModel):
    resolved: list[str]
    changed_fields: list[str]
    shots_removed: int
    shots_converted: int
    pending: list[str]


@fitter_tool("resolve_flags")
async def resolve_flags(ctx: ToolContext, args: ResolveFlagsRequest) -> ResolveFlagsOut:
    """Apply the golfer's outlier_review answer: pass its `action` and `codes` (and `import_id`
    for shot flags). keep = their value stands; confirm_value = use the measured/suggested value;
    exclude = drop that value or those shots. Then call run_fit to refresh the result."""
    s = ctx.session
    report_flags: list[Flag] = []
    parsed: dict[str, list[Shot]] = {}
    for iid in {args.import_id, *(f.import_id for f in s.state.pending_flags)} - {None}:
        try:
            imp = await ctx.store.get_import(s.id, iid)  # type: ignore[arg-type]
        except NotFoundError:
            continue
        parsed[iid] = _SHOTS.validate_json(imp.parsed_shots_json)  # type: ignore[index]
        if iid == args.import_id:
            with suppress(ValueError):  # a screenshot review, not an ImportReport
                report_flags = ImportReport.model_validate_json(imp.report_json).report.flags
    out = resolve.resolve(
        s, args, resolve.targets(args, s.state.pending_flags, report_flags), parsed
    )
    s.flags, pending = session_flags.refresh(s)
    changed = bool(out.changed_fields or out.shots_removed or out.shots_converted)
    s.evidence_version += int(changed)
    await commit_state(ctx, pending_flags=pending, evidence_version=s.evidence_version)
    return ResolveFlagsOut(
        resolved=[f.code for f in out.resolved],
        changed_fields=out.changed_fields,
        shots_removed=out.shots_removed,
        shots_converted=out.shots_converted,
        pending=[f.code for f in pending],
    )
