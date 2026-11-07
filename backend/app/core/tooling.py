"""The tool calling convention (plan §3.1): `ToolContext` + `@fitter_tool`.

One domain tool per file in `agent/tools/<name>.py`:

    from pydantic import BaseModel
    from app.core.tooling import ToolContext, fitter_tool

    class UpdateProfileIn(BaseModel): ...
    class UpdateProfileOut(BaseModel): ...

    @fitter_tool("update_profile")
    async def update_profile(ctx: ToolContext, args: UpdateProfileIn) -> UpdateProfileOut:
        \"\"\"Docstring = the tool description the model sees.\"\"\"
        ...

Engines wrap every registered tool the same way (`list_tools()` is sorted by name, so the tool
list is byte-stable for prompt caching). `ui_<name>` tools are generated from `schemas/ui/` by
`ui_tool_specs()`, never hand-written. `run_tool()` runs any tool by hand with no engine.
"""

import inspect
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from functools import cache
from typing import Any, Literal, get_type_hints

from pydantic import BaseModel

from app.schemas.chat import StreamEvent, UiEvent
from app.schemas.ports import SessionStore
from app.schemas.session import Budget, FitSession
from app.schemas.ui import UI_BLOCK_MODELS, UIBlockBase

ToolKind = Literal["domain", "ui_input", "ui_display"]
Emit = Callable[[StreamEvent], Awaitable[None]]


@dataclass
class ToolContext:
    session: FitSession  # mutable for this turn only; committed atomically at turn end
    emit: Emit  # pushes text/ui/stage/state events; the emitter stamps `seq` (pass seq=0)
    store: SessionStore | None = None
    budget: Budget = field(default_factory=Budget)


ToolFn = Callable[[ToolContext, Any], Awaitable[Any]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    kind: ToolKind
    description: str
    input_model: type[BaseModel]
    output_model: type | None
    fn: ToolFn


_TOOLS: dict[str, ToolSpec] = {}


def fitter_tool(name: str, kind: ToolKind = "domain") -> Callable[[ToolFn], ToolFn]:
    """Register `async def fn(ctx: ToolContext, args: SomeModel) -> Out` as a tool."""

    def decorator(fn: ToolFn) -> ToolFn:
        if not inspect.iscoroutinefunction(fn):
            raise TypeError(f"tool {name!r} must be async")
        if name in _TOOLS:
            raise ValueError(f"tool {name!r} registered twice")
        hints = get_type_hints(fn)
        params = list(inspect.signature(fn).parameters)
        if len(params) != 2:
            raise TypeError(f"tool {name!r} must take (ctx: ToolContext, args: Model)")
        input_model = hints.get(params[1])
        if not (isinstance(input_model, type) and issubclass(input_model, BaseModel)):
            raise TypeError(f"tool {name!r}: args must be annotated with a Pydantic model")
        _TOOLS[name] = ToolSpec(
            name=name,
            kind=kind,
            description=inspect.cleandoc(fn.__doc__ or name),
            input_model=input_model,
            output_model=hints.get("return"),
            fn=fn,
        )
        return fn

    return decorator


def list_tools() -> list[ToolSpec]:
    """Registered domain tools, sorted by name. Import `agent/tools/*` (registry.discover) first."""
    return [_TOOLS[n] for n in sorted(_TOOLS)]


def _ui_tool_fn(model: type[UIBlockBase]) -> ToolFn:
    ui_type = model.model_fields["type"].default

    async def run(ctx: ToolContext, args: Any) -> str:
        block = args if isinstance(args, model) else model.model_validate(args)
        # Per-session counter: deterministic for the scripted engine, never repeats in a session
        # (it is committed with the turn). Engines may pass their own tool_use id instead.
        tool_id = f"{ui_type}-{ctx.session.ui_block_seq}"
        ctx.session.ui_block_seq += 1
        await ctx.emit(
            UiEvent(seq=0, id=tool_id, block=block, interactive=model.kind == "ui_input")
        )
        return "rendered"

    return run


@cache
def _ui_tools() -> dict[str, ToolSpec]:
    """One `ui_<type>` spec per `schemas/ui/<type>.py`, built once (UI_BLOCK_MODELS is fixed at
    import time), keyed and sorted by name."""
    specs: dict[str, ToolSpec] = {}
    for model in UI_BLOCK_MODELS:
        ui_type = model.model_fields["type"].default
        name = f"ui_{ui_type}"
        specs[name] = ToolSpec(
            name=name,
            kind=model.kind,
            description=inspect.cleandoc(model.__doc__ or ui_type),
            input_model=model,
            output_model=str,
            fn=_ui_tool_fn(model),
        )
    return dict(sorted(specs.items()))


def ui_tool_specs() -> list[ToolSpec]:
    """One `ui_<type>` tool per `schemas/ui/<type>.py`, sorted. Input kinds interrupt the turn."""
    return list(_ui_tools().values())


def get_tool(name: str) -> ToolSpec:
    spec = _TOOLS.get(name) or _ui_tools().get(name)
    if spec is None:
        raise KeyError(f"unknown tool {name!r}")
    return spec


async def run_tool(
    name: str,
    args: dict[str, Any] | BaseModel,
    session: FitSession,
    store: SessionStore | None = None,
) -> tuple[Any, list[StreamEvent]]:
    """Run one tool by hand (no engine, no LLM). Returns (output, emitted events)."""
    spec = get_tool(name)
    events: list[StreamEvent] = []

    async def emit(ev: StreamEvent) -> None:
        events.append(ev.model_copy(update={"seq": len(events)}))

    parsed = args if isinstance(args, spec.input_model) else spec.input_model.model_validate(args)
    ctx = ToolContext(session=session, emit=emit, store=store, budget=session.budget)
    out = await spec.fn(ctx, parsed)
    return out, events
