"""Apply the golfer's answer to an `outlier_review` (plan §5.3; issue #31). Pure: changes only the
FitSession it is given (profile, `state.shots`, flags); the route loads and saves.

- keep: the value stands (σ back to normal) / the shots stand.
- confirm_value: a profile field takes `suggested_value` (G11: the measured carry, source
  trackman); S10 converts that import's distances from metres to yards.
- exclude: a profile field becomes "I don't know" (the source is dropped); flagged shots leave
  `state.shots` (all of the import's shots for an import-wide flag).

Every flag answered is marked `resolved`, so `session_flags.refresh` never asks it again.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

from app.schemas.common import ProvenancedValue
from app.schemas.evidence import Flag, ResolveFlagsRequest, Shot
from app.schemas.session import FitSession

YD_PER_M = 1.09361
DISTANCE_FIELDS = ("carry_yd", "total_yd", "side_yd", "apex_yd")
GOLFER_PREFIX = "G"


@dataclass
class Resolution:
    resolved: list[Flag] = field(default_factory=list)
    changed_fields: list[str] = field(default_factory=list)
    shots_removed: int = 0
    shots_converted: int = 0


def _key(f: Flag) -> tuple[object, ...]:
    return (f.code, f.field, f.import_id, f.shot_index)


def targets(
    req: ResolveFlagsRequest, pending: Sequence[Flag], report_flags: Sequence[Flag] = ()
) -> list[Flag]:
    """Unresolved flags the answer is about: pending ones, plus the import report's own flags
    (S8 / S7 downweights are shown in the review but never pending) when `import_id` is given."""
    out: dict[tuple[object, ...], Flag] = {}
    for f in [*pending, *report_flags]:
        if f.resolved or f.severity == "info":
            continue
        if req.codes and f.code not in req.codes:
            continue
        if req.import_id is not None and f.import_id not in (req.import_id, None):
            continue
        out.setdefault(_key(f), f)
    return list(out.values())


def _set_profile(session: FitSession, name: str, value: object, code: str, source: str) -> None:
    old = session.profile.get(name)
    flags = sorted({*(old.flags if old else []), code})
    session.profile[name] = ProvenancedValue(
        source=source,  # type: ignore[arg-type]
        value=value,  # type: ignore[arg-type]
        unit=old.unit if old else None,
        flags=flags,  # type: ignore[arg-type]
    )


def resolve(
    session: FitSession,
    req: ResolveFlagsRequest,
    flags: Sequence[Flag],
    parsed: Mapping[str, Sequence[Shot]],
) -> Resolution:
    """Apply `req.action` to `flags` (from `targets`). `parsed` maps an import id to its parsed
    shots as stored, so a flag's `shot_index` finds the shot (club, shot_no) in `state.shots`."""
    res = Resolution()
    shots = list(session.state.shots)
    for f in flags:
        is_profile = f.code.startswith(GOLFER_PREFIX) and f.field in session.profile
        if req.action == "confirm_value" and is_profile and f.suggested_value is not None:
            old = session.profile[f.field]  # type: ignore[index]
            if f.code == "G11" and "claimed_7i_carry_yd" not in session.profile:
                session.profile["claimed_7i_carry_yd"] = old.model_copy()
            source = "trackman" if f.code == "G11" else old.source
            _set_profile(session, f.field, f.suggested_value, f.code, source)  # type: ignore[arg-type]
            res.changed_fields.append(f.field)  # type: ignore[arg-type]
        elif req.action == "exclude" and is_profile:
            old = session.profile[f.field]  # type: ignore[index]
            _set_profile(session, f.field, None, f.code, old.source)  # type: ignore[arg-type]
            res.changed_fields.append(f.field)  # type: ignore[arg-type]
        elif req.action == "exclude" and f.code.startswith("S") and f.import_id:
            if f.shot_index is not None and f.shot_index < len(parsed.get(f.import_id, ())):
                p = parsed[f.import_id][f.shot_index]
                gone = [
                    s
                    for s in shots
                    if (s.import_id, s.club, s.shot_no) == (f.import_id, p.club, p.shot_no)
                ]
            else:
                gone = [s for s in shots if s.import_id == f.import_id]
            shots = [s for s in shots if s not in gone]
            res.shots_removed += len(gone)
        elif req.action == "confirm_value" and f.code == "S10" and f.import_id:
            converted = []
            for s in shots:
                if s.import_id == f.import_id:
                    update = {
                        k: round(v * YD_PER_M, 1)
                        for k in DISTANCE_FIELDS
                        if (v := getattr(s, k)) is not None
                    }
                    s = s.model_copy(update=update)
                    res.shots_converted += 1
                converted.append(s)
            shots = converted
        res.resolved.append(f.model_copy(update={"resolved": True}))

    done = {_key(f) for f in res.resolved}
    session.flags = [
        f.model_copy(update={"resolved": True}) if _key(f) in done else f for f in session.flags
    ]
    session.state = session.state.model_copy(
        update={
            "shots": shots,
            "pending_flags": [
                f.model_copy(update={"resolved": True}) if _key(f) in done else f
                for f in session.state.pending_flags
            ],
        }
    )
    return res
